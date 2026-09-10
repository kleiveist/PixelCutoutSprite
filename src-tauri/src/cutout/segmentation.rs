//! Deterministic local assistance: source alpha, bounded ROI, then seeded geodesic costs.
//! No anatomical classifier, network, external executable, or downloaded model.
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::time::Instant;

use super::{invalid, Mask, Runs, MAX_MASK_RUNS};
use crate::storage::StorageError;
use image::RgbaImage;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SelectionParameters {
    pub alpha_threshold: u8,
    pub tolerance: u8,
    pub edge_weight: u8,
}
impl Default for SelectionParameters {
    fn default() -> Self {
        Self {
            alpha_threshold: 1,
            tolerance: 40,
            edge_weight: 4,
        }
    }
}
impl SelectionParameters {
    pub fn validate(&self) -> Result<(), StorageError> {
        if self.alpha_threshold == 0 || self.edge_weight > 8 {
            return Err(invalid("Alpha muss 1–255 und das Kantengewicht 0–8 sein."));
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefineResult {
    pub draft: Option<Runs>,
    pub advice: String,
    pub uncertain: bool,
    pub selected_pixels: u32,
    pub examined_pixels: u32,
    pub elapsed_ms: u64,
    pub estimated_working_bytes: u64,
}

pub struct RefineControl<'a> {
    pub cancelled: &'a AtomicBool,
    pub progress: &'a AtomicU8,
}
impl RefineControl<'_> {
    fn check(&self, progress: u8) -> Result<(), StorageError> {
        self.progress.fetch_max(progress.min(99), Ordering::Relaxed);
        if self.cancelled.load(Ordering::Relaxed) {
            Err(invalid("CANCELLED: Auswahlhilfe abgebrochen."))
        } else {
            Ok(())
        }
    }
}
#[derive(Clone, Copy)]
struct Bounds {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}
struct Grid<'a> {
    image: &'a RgbaImage,
    bounds: Bounds,
    flags: Vec<u8>,
}
const ALLOWED: u8 = 1;
const NEGATIVE: u8 = 2;
const POSITIVE: u8 = 4;
const VISITED: u8 = 8;
impl Grid<'_> {
    fn source_index(&self, local: usize) -> usize {
        ((self.bounds.y as usize + local / self.bounds.width as usize)
            * self.image.width() as usize)
            + self.bounds.x as usize
            + local % self.bounds.width as usize
    }
    fn local_index(&self, source: u32) -> Option<usize> {
        let x = source % self.image.width();
        let y = source / self.image.width();
        (x >= self.bounds.x
            && x < self.bounds.x + self.bounds.width
            && y >= self.bounds.y
            && y < self.bounds.y + self.bounds.height)
            .then(|| ((y - self.bounds.y) * self.bounds.width + x - self.bounds.x) as usize)
    }
    fn color(&self, local: usize) -> [i16; 3] {
        let i = self.source_index(local) * 4;
        let r = i16::from(self.image.as_raw()[i]);
        let g = i16::from(self.image.as_raw()[i + 1]);
        let b = i16::from(self.image.as_raw()[i + 2]);
        // Integer YCoCg: brightness and two chroma axes; deterministic without floating point.
        [(r + 2 * g + b) / 4, (r - b) / 2, (-r + 2 * g - b) / 4]
    }
    fn neighbors(&self, index: usize) -> impl Iterator<Item = usize> + use<> {
        let width = self.bounds.width as usize;
        [
            index.checked_sub(width),
            (index + width < self.flags.len()).then_some(index + width),
            (index % width > 0).then(|| index - 1),
            (index % width + 1 < width).then_some(index + 1),
        ]
        .into_iter()
        .flatten()
    }
}
fn difference(a: [i16; 3], b: [i16; 3]) -> u32 {
    a.iter()
        .zip(b)
        .map(|(&a, b)| u32::from(a.abs_diff(b)))
        .sum::<u32>()
        / 3
}
fn bounds(runs: &Runs, width: u32) -> Option<Bounds> {
    let mut left = width;
    let mut right = 0;
    let mut top = u32::MAX;
    let mut bottom = 0;
    for &[start, length] in runs {
        let end = start + length - 1;
        let row = start / width;
        let end_row = end / width;
        top = top.min(row);
        bottom = bottom.max(end_row + 1);
        if row == end_row {
            left = left.min(start % width);
            right = right.max(end % width + 1);
        } else {
            left = 0;
            right = width;
        }
    }
    (right > left && bottom > top).then(|| Bounds {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    })
}
fn mark(
    grid: &mut Grid<'_>,
    runs: &Runs,
    flag: u8,
    control: &RefineControl<'_>,
) -> Result<(), StorageError> {
    for &[start, length] in runs {
        for index in start..start + length {
            if index % 4096 == 0 {
                control.check(10)?;
            }
            if let Some(local) = grid.local_index(index) {
                if grid.flags[local] & ALLOWED != 0 {
                    grid.flags[local] |= flag;
                }
            }
        }
    }
    Ok(())
}

/// At most one heap entry per pixel. Decrease-key prevents duplicate heap growth.
struct IndexedHeap {
    entries: Vec<u32>,
    positions: Vec<u32>,
}
impl IndexedHeap {
    fn new(size: usize) -> Self {
        Self {
            entries: Vec::with_capacity(size),
            positions: vec![u32::MAX; size],
        }
    }
    fn less(a: u32, b: u32, distances: &[u32]) -> bool {
        (distances[a as usize], a) < (distances[b as usize], b)
    }
    fn swap(&mut self, a: usize, b: usize) {
        self.entries.swap(a, b);
        self.positions[self.entries[a] as usize] = a as u32;
        self.positions[self.entries[b] as usize] = b as u32;
    }
    fn update(&mut self, index: usize, distances: &[u32]) {
        let mut position = self.positions[index];
        if position == u32::MAX {
            position = self.entries.len() as u32;
            self.entries.push(index as u32);
            self.positions[index] = position;
        }
        let mut position = position as usize;
        while position > 0 {
            let parent = (position - 1) / 2;
            if !Self::less(self.entries[position], self.entries[parent], distances) {
                break;
            }
            self.swap(position, parent);
            position = parent;
        }
    }
    fn pop(&mut self, distances: &[u32]) -> Option<usize> {
        let result = *self.entries.first()?;
        let last = self.entries.pop().unwrap();
        self.positions[result as usize] = u32::MAX;
        if !self.entries.is_empty() {
            self.entries[0] = last;
            self.positions[last as usize] = 0;
            let mut position = 0;
            loop {
                let left = position * 2 + 1;
                if left >= self.entries.len() {
                    break;
                }
                let right = left + 1;
                let child = if right < self.entries.len()
                    && Self::less(self.entries[right], self.entries[left], distances)
                {
                    right
                } else {
                    left
                };
                if !Self::less(self.entries[child], self.entries[position], distances) {
                    break;
                }
                self.swap(position, child);
                position = child;
            }
        }
        Some(result as usize)
    }
}
fn palette(
    grid: &Grid<'_>,
    flag: u8,
    control: &RefineControl<'_>,
) -> Result<Vec<[i16; 3]>, StorageError> {
    let mut count = 0;
    for (index, &value) in grid.flags.iter().enumerate() {
        if index % 4096 == 0 {
            control.check(10)?;
        }
        if value & flag != 0 && (flag == NEGATIVE || value & NEGATIVE == 0) {
            count += 1;
        }
    }
    let stride = (count / 1024).max(1);
    let mut seen = 0;
    let mut colors = Vec::new();
    for (index, &value) in grid.flags.iter().enumerate() {
        if index % 4096 == 0 {
            control.check(10)?;
        }
        if value & flag == 0 || (flag != NEGATIVE && value & NEGATIVE != 0) {
            continue;
        }
        seen += 1;
        if seen % stride != 0 {
            continue;
        }
        let color = grid.color(index);
        if colors.len() < 32 && !colors.iter().any(|&old| difference(old, color) < 3) {
            colors.push(color);
        }
    }
    Ok(colors)
}
fn geodesic(
    grid: &Grid<'_>,
    seed: u8,
    colors: &[[i16; 3]],
    parameters: SelectionParameters,
    control: &RefineControl<'_>,
    start_progress: u8,
) -> Result<Vec<u32>, StorageError> {
    let mut distances = vec![u32::MAX; grid.flags.len()];
    let is_seed = |index: usize| {
        grid.flags[index] & seed != 0 && (seed == NEGATIVE || grid.flags[index] & NEGATIVE == 0)
    };
    let mut heap = IndexedHeap::new(grid.flags.len());
    for (index, distance) in distances.iter_mut().enumerate() {
        if is_seed(index) {
            *distance = 0;
        }
    }
    for index in 0..grid.flags.len() {
        if index % 4096 == 0 {
            control.check(start_progress)?;
        }
        if is_seed(index)
            && grid
                .neighbors(index)
                .any(|neighbor| grid.flags[neighbor] & ALLOWED != 0 && !is_seed(neighbor))
        {
            heap.update(index, &distances);
        }
    }
    let mut examined = 0;
    while let Some(index) = heap.pop(&distances) {
        examined += 1;
        if examined % 2048 == 0 {
            control.check(
                start_progress
                    + ((examined as u64 * 30 / grid.flags.len().max(1) as u64).min(30)) as u8,
            )?;
        }
        let current_color = grid.color(index);
        for neighbor in grid.neighbors(index) {
            if grid.flags[neighbor] & ALLOWED == 0
                || (seed == POSITIVE && grid.flags[neighbor] & NEGATIVE != 0)
            {
                continue;
            }
            let color = grid.color(neighbor);
            let seed_distance = colors
                .iter()
                .map(|&seed| difference(seed, color))
                .min()
                .unwrap_or(0);
            if seed_distance > u32::from(parameters.tolerance) && !is_seed(neighbor) {
                continue;
            }
            let cost = 1
                + difference(current_color, color) * u32::from(parameters.edge_weight) / 32
                + seed_distance / 8;
            let candidate = distances[index].saturating_add(cost);
            if candidate < distances[neighbor] {
                distances[neighbor] = candidate;
                heap.update(neighbor, &distances);
            }
        }
    }
    Ok(distances)
}
fn append(runs: &mut Runs, index: u32) -> Result<(), StorageError> {
    if let Some(last) = runs.last_mut() {
        if last[0] + last[1] == index {
            last[1] += 1;
            return Ok(());
        }
    }
    if runs.len() >= MAX_MASK_RUNS {
        return Err(invalid("Die Auswahl ist zu stark fragmentiert. Bitte eine kleinere ROI oder manuelle Maske verwenden."));
    }
    runs.push([index, 1]);
    Ok(())
}
fn contains(runs: &Runs, index: u32) -> bool {
    let position = runs.partition_point(|&[start, _]| start <= index);
    position > 0 && index < runs[position - 1][0] + runs[position - 1][1]
}

pub fn refine(
    image: &RgbaImage,
    mask: &Mask,
    parameters: SelectionParameters,
    control: &RefineControl<'_>,
) -> Result<RefineResult, StorageError> {
    let started = Instant::now();
    parameters.validate()?;
    mask.validate(image.width() * image.height())?;
    control.check(1)?;
    let mut result = RefineResult {
        draft: None,
        advice: String::new(),
        uncertain: true,
        selected_pixels: 0,
        examined_pixels: 0,
        elapsed_ms: 0,
        estimated_working_bytes: image.as_raw().len() as u64,
    };
    let Some(bounds) = bounds(&mask.roi, image.width()) else {
        result.advice =
            "Zuerst ein Rechteck oder Lasso als erlaubten Bereich markieren.".to_owned();
        return Ok(result);
    };
    let mut grid = Grid {
        image,
        bounds,
        flags: vec![0; (bounds.width * bounds.height) as usize],
    };
    for &[start, length] in &mask.roi {
        for index in start..start + length {
            if index % 4096 == 0 {
                control.check(5)?;
            }
            if image.as_raw()[index as usize * 4 + 3] >= parameters.alpha_threshold {
                let local = grid.local_index(index).unwrap();
                grid.flags[local] = ALLOWED;
            }
        }
    }
    mark(&mut grid, &mask.negative, NEGATIVE, control)?;
    mark(&mut grid, &mask.positive, POSITIVE, control)?;
    let positive_colors = palette(&grid, POSITIVE, control)?;
    let negative_colors = palette(&grid, NEGATIVE, control)?;
    let has_positive = !positive_colors.is_empty();
    let has_negative = !negative_colors.is_empty();
    result.examined_pixels = grid.flags.len() as u32;
    result.estimated_working_bytes += grid.flags.len() as u64 * if has_positive { 18 } else { 6 };
    let mut selected = vec![false; grid.flags.len()];
    if !has_positive {
        let mut components = 0;
        let mut queue = Vec::with_capacity(grid.flags.len());
        for index in 0..grid.flags.len() {
            if index % 4096 == 0 {
                control.check(30)?;
            }
            if grid.flags[index] & (ALLOWED | NEGATIVE | VISITED) != ALLOWED {
                continue;
            }
            components += 1;
            if components > 1 {
                result.advice = "Mehrere sichtbare Inseln: bitte den gewünschten Teil mit Pinsel + markieren. Es wird keine Insel zufällig gewählt.".to_owned();
                result.examined_pixels = grid.flags.len() as u32;
                result.elapsed_ms = started.elapsed().as_millis() as u64;
                return Ok(result);
            }
            grid.flags[index] |= VISITED;
            queue.push(index as u32);
            let mut cursor = 0;
            while cursor < queue.len() {
                if cursor % 4096 == 0 {
                    control.check(45)?;
                }
                let index = queue[cursor] as usize;
                cursor += 1;
                selected[index] = true;
                for next in grid.neighbors(index) {
                    if grid.flags[next] & (ALLOWED | NEGATIVE | VISITED) == ALLOWED {
                        grid.flags[next] |= VISITED;
                        queue.push(next as u32);
                    }
                }
            }
        }
        result.advice = "Transparente Außenkontur entfernt. Innere Körperteilgrenzen bitte prüfen und bei Bedarf mit Pinsel +/− korrigieren.".to_owned();
    } else {
        let positive = geodesic(&grid, POSITIVE, &positive_colors, parameters, control, 15)?;
        let negative = if has_negative {
            Some(geodesic(
                &grid,
                NEGATIVE,
                &negative_colors,
                parameters,
                control,
                50,
            )?)
        } else {
            None
        };
        for (index, selected) in selected.iter_mut().enumerate() {
            if index % 4096 == 0 {
                control.check(85)?;
            }
            *selected = grid.flags[index] & NEGATIVE == 0
                && positive[index] != u32::MAX
                && negative
                    .as_ref()
                    .is_none_or(|costs| positive[index] < costs[index]);
        }
        result.advice = "Lokale Farb-/Kantenhilfe angewendet. Mehrfarbige Teilflächen können weitere positive Seeds benötigen; ohne sichtbare Grenze helfen negative Seeds oder manuelle Korrektur.".to_owned();
    }
    let selected_count = selected.iter().filter(|&&value| value).count();
    let roi_count = mask.roi.iter().map(|run| run[1]).sum::<u32>();
    result.uncertain = selected_count == 0
        || (!has_positive && selected_count as u32 == roi_count)
        || (has_positive && !has_negative)
        || positive_colors
            .iter()
            .any(|&a| negative_colors.iter().any(|&b| difference(a, b) < 8));
    if positive_colors.len() == 32 || negative_colors.len() == 32 {
        result.uncertain = true;
        result.advice.push_str(" Die Farbpalette erreicht ihr Limit von 32 Repräsentanten je Seed-Klasse; komplexe Bereiche bitte manuell prüfen.");
    }
    if selected_count == 0 {
        result.advice = "Keine sichtbare Auswahl gefunden. ROI, Alpha-Schwelle und positive/negative Seeds prüfen; der bisherige Entwurf bleibt erhalten.".to_owned();
        result.elapsed_ms = started.elapsed().as_millis() as u64;
        return Ok(result);
    }
    let mut output = Vec::new();
    // A single source-order scan merges protected pixels outside the ROI, excludes every
    // hard negative, and preserves source alpha > 0 in deliberately protected overlaps.
    for index in 0..image.width() * image.height() {
        if index % 4096 == 0 {
            control.check(92)?;
        }
        if contains(&mask.negative, index) {
            continue;
        }
        let include = grid.local_index(index).is_some_and(|local| selected[local])
            || (contains(&mask.protected, index) && image.as_raw()[index as usize * 4 + 3] > 0);
        if include {
            append(&mut output, index)?;
        }
    }
    result.selected_pixels = output.iter().map(|run| run[1]).sum();
    result.examined_pixels = grid.flags.len() as u32;
    result.draft = Some(output);
    result.elapsed_ms = started.elapsed().as_millis() as u64;
    control.check(99)?;
    Ok(result)
}
