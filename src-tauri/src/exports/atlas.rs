use image::RgbaImage;

use crate::domain::{AtlasSize, PixelRect, PixelSize};

use super::ExportError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AtlasOptions {
    pub max_page_size_px: AtlasSize,
    pub padding_px: u16,
    pub extrude_edges: bool,
    pub max_pages: u16,
    pub memory_budget_bytes: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AtlasPlacement {
    pub frame_index: usize,
    pub page_index: usize,
    pub rect_px: PixelRect,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PlannedAtlasPage {
    pub page_index: usize,
    pub size_px: AtlasSize,
    pub first_frame: usize,
    pub frame_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AtlasPlan {
    pub pages: Vec<PlannedAtlasPage>,
    pub placements: Vec<AtlasPlacement>,
    pub estimated_decoded_bytes: u64,
    pub peak_page_bytes: u64,
}

#[derive(Debug, Clone, Copy)]
pub struct AtlasBuilder {
    frame_size_px: PixelSize,
    options: AtlasOptions,
    cell_width: u16,
    cell_height: u16,
    columns: usize,
    rows: usize,
}

impl AtlasBuilder {
    pub fn new(frame_size_px: PixelSize, options: AtlasOptions) -> Result<Self, ExportError> {
        frame_size_px
            .validate("atlas.frame_size_px")
            .map_err(ExportError::Contract)?;
        options
            .max_page_size_px
            .validate("atlas.max_page_size_px")
            .map_err(ExportError::Contract)?;
        if options.max_pages == 0 || options.padding_px > 64 || options.memory_budget_bytes == 0 {
            return Err(ExportError::InvalidProfile(
                "max_pages and memory budget must be positive; padding must be 0..=64".to_owned(),
            ));
        }
        if options.extrude_edges && options.padding_px == 0 {
            return Err(ExportError::InvalidProfile(
                "edge extrusion requires at least one pixel of padding".to_owned(),
            ));
        }
        let padding = options
            .padding_px
            .checked_mul(2)
            .ok_or(ExportError::FrameDoesNotFit)?;
        let cell_width = frame_size_px
            .0
            .checked_add(padding)
            .ok_or(ExportError::FrameDoesNotFit)?;
        let cell_height = frame_size_px
            .1
            .checked_add(padding)
            .ok_or(ExportError::FrameDoesNotFit)?;
        let columns = usize::from(options.max_page_size_px.0 / cell_width);
        let rows = usize::from(options.max_page_size_px.1 / cell_height);
        if columns == 0 || rows == 0 {
            return Err(ExportError::FrameDoesNotFit);
        }
        Ok(Self {
            frame_size_px,
            options,
            cell_width,
            cell_height,
            columns,
            rows,
        })
    }

    pub fn plan(&self, frame_count: usize) -> Result<AtlasPlan, ExportError> {
        if frame_count == 0 {
            return Err(ExportError::InvalidRequest(
                "an atlas needs at least one rendered frame".to_owned(),
            ));
        }
        let capacity = self
            .columns
            .checked_mul(self.rows)
            .ok_or_else(|| ExportError::InvalidProfile("atlas capacity overflow".to_owned()))?;
        let page_count = frame_count.div_ceil(capacity);
        if page_count > usize::from(self.options.max_pages) {
            return Err(ExportError::PageLimit {
                required: page_count,
                limit: self.options.max_pages,
            });
        }

        let mut pages = Vec::with_capacity(page_count);
        let mut placements = Vec::with_capacity(frame_count);
        let mut remaining = frame_count;
        let mut first_frame = 0;
        let mut total_page_bytes = 0_u64;
        let mut peak_page_bytes = 0_u64;
        for page_index in 0..page_count {
            let count = remaining.min(capacity);
            let used_rows = count.div_ceil(self.columns);
            let used_columns = count.min(self.columns);
            let width = checked_axis(used_columns, self.cell_width)?;
            let height = checked_axis(used_rows, self.cell_height)?;
            let size_px = AtlasSize(width, height);
            let page_bytes = decoded_bytes(width, height)?;
            total_page_bytes = total_page_bytes
                .checked_add(page_bytes)
                .ok_or_else(|| ExportError::InvalidProfile("atlas size overflow".to_owned()))?;
            peak_page_bytes = peak_page_bytes.max(page_bytes);
            pages.push(PlannedAtlasPage {
                page_index,
                size_px,
                first_frame,
                frame_count: count,
            });
            for local_index in 0..count {
                let column = local_index % self.columns;
                let row = local_index / self.columns;
                placements.push(AtlasPlacement {
                    frame_index: first_frame + local_index,
                    page_index,
                    rect_px: PixelRect(
                        checked_axis(column, self.cell_width)? + self.options.padding_px,
                        checked_axis(row, self.cell_height)? + self.options.padding_px,
                        self.frame_size_px.0,
                        self.frame_size_px.1,
                    ),
                });
            }
            remaining -= count;
            first_frame += count;
        }
        let all_frame_bytes = decoded_bytes(self.frame_size_px.0, self.frame_size_px.1)?
            .checked_mul(frame_count as u64)
            .ok_or_else(|| ExportError::InvalidProfile("frame memory overflow".to_owned()))?;
        let estimated_decoded_bytes = total_page_bytes
            .checked_add(all_frame_bytes)
            .ok_or_else(|| ExportError::InvalidProfile("export memory overflow".to_owned()))?;
        if estimated_decoded_bytes > self.options.memory_budget_bytes {
            return Err(ExportError::MemoryLimit {
                required: estimated_decoded_bytes,
                budget: self.options.memory_budget_bytes,
            });
        }
        Ok(AtlasPlan {
            pages,
            placements,
            estimated_decoded_bytes,
            peak_page_bytes,
        })
    }

    pub fn blank_page(&self, page: &PlannedAtlasPage) -> RgbaImage {
        RgbaImage::new(u32::from(page.size_px.0), u32::from(page.size_px.1))
    }

    pub fn place(
        &self,
        page: &mut RgbaImage,
        placement: &AtlasPlacement,
        frame: &RgbaImage,
    ) -> Result<(), ExportError> {
        if frame.dimensions()
            != (
                u32::from(self.frame_size_px.0),
                u32::from(self.frame_size_px.1),
            )
        {
            return Err(ExportError::InvalidBuild(
                "spooled frame changed dimensions before atlas packing".to_owned(),
            ));
        }
        let PixelRect(x, y, width, height) = placement.rect_px;
        let right = u32::from(x) + u32::from(width);
        let bottom = u32::from(y) + u32::from(height);
        if right > page.width() || bottom > page.height() {
            return Err(ExportError::InvalidBuild(
                "planned frame rectangle is outside its atlas page".to_owned(),
            ));
        }
        for source_y in 0..frame.height() {
            for source_x in 0..frame.width() {
                page.put_pixel(
                    u32::from(x) + source_x,
                    u32::from(y) + source_y,
                    *frame.get_pixel(source_x, source_y),
                );
            }
        }
        if self.options.extrude_edges {
            self.extrude(page, placement, frame);
        }
        Ok(())
    }

    fn extrude(&self, page: &mut RgbaImage, placement: &AtlasPlacement, frame: &RgbaImage) {
        let padding = i32::from(self.options.padding_px);
        let PixelRect(x, y, width, height) = placement.rect_px;
        for local_y in -padding..i32::from(height) + padding {
            for local_x in -padding..i32::from(width) + padding {
                if (0..i32::from(width)).contains(&local_x)
                    && (0..i32::from(height)).contains(&local_y)
                {
                    continue;
                }
                let source_x = local_x.clamp(0, i32::from(width) - 1) as u32;
                let source_y = local_y.clamp(0, i32::from(height) - 1) as u32;
                let target_x = (i32::from(x) + local_x) as u32;
                let target_y = (i32::from(y) + local_y) as u32;
                page.put_pixel(target_x, target_y, *frame.get_pixel(source_x, source_y));
            }
        }
    }
}

fn checked_axis(cells: usize, cell_size: u16) -> Result<u16, ExportError> {
    let pixels = cells
        .checked_mul(usize::from(cell_size))
        .ok_or_else(|| ExportError::InvalidProfile("atlas axis overflow".to_owned()))?;
    u16::try_from(pixels)
        .map_err(|_| ExportError::InvalidProfile("atlas axis exceeds 4096 pixels".to_owned()))
}

fn decoded_bytes(width: u16, height: u16) -> Result<u64, ExportError> {
    u64::from(width)
        .checked_mul(u64::from(height))
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| ExportError::InvalidProfile("decoded RGBA size overflow".to_owned()))
}
