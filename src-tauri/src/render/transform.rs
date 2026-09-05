use crate::domain::Transform2D;

/// A double-precision affine transform. Composition is kept in floating point and rounded only
/// when the final image samples a target pixel.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RenderTransform {
    pub offset_x: f64,
    pub offset_y: f64,
    pub rotation_deg: f64,
}

impl RenderTransform {
    pub const IDENTITY: Self = Self {
        offset_x: 0.0,
        offset_y: 0.0,
        rotation_deg: 0.0,
    };

    pub fn new(offset_x: f64, offset_y: f64, rotation_deg: f64) -> Result<Self, RenderError> {
        let value = Self {
            offset_x,
            offset_y,
            rotation_deg,
        };
        if [offset_x, offset_y, rotation_deg]
            .into_iter()
            .all(f64::is_finite)
        {
            Ok(value)
        } else {
            Err(RenderError::InvalidTransform)
        }
    }

    pub(crate) fn affine(self) -> Affine {
        Affine::translation(self.offset_x, self.offset_y)
            .multiply(Affine::rotation(self.rotation_deg.to_radians()))
    }

    pub(crate) fn is_finite(self) -> bool {
        [self.offset_x, self.offset_y, self.rotation_deg]
            .into_iter()
            .all(f64::is_finite)
    }
}

impl From<Transform2D> for RenderTransform {
    fn from(value: Transform2D) -> Self {
        Self {
            offset_x: f64::from(value.offset_px.0),
            offset_y: f64::from(value.offset_px.1),
            rotation_deg: f64::from(value.rotation_deg),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Affine {
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub tx: f64,
    pub ty: f64,
}

impl Affine {
    pub const IDENTITY: Self = Self {
        a: 1.0,
        b: 0.0,
        c: 0.0,
        d: 1.0,
        tx: 0.0,
        ty: 0.0,
    };

    pub fn translation(x: f64, y: f64) -> Self {
        Self {
            tx: x,
            ty: y,
            ..Self::IDENTITY
        }
    }

    pub fn rotation(radians: f64) -> Self {
        let cosine = radians.cos();
        let sine = radians.sin();
        Self {
            a: cosine,
            b: sine,
            c: -sine,
            d: cosine,
            tx: 0.0,
            ty: 0.0,
        }
    }

    /// Returns `self × child`, so `child` is applied first.
    pub fn multiply(self, child: Self) -> Self {
        Self {
            a: self.a * child.a + self.c * child.b,
            b: self.b * child.a + self.d * child.b,
            c: self.a * child.c + self.c * child.d,
            d: self.b * child.c + self.d * child.d,
            tx: self.a * child.tx + self.c * child.ty + self.tx,
            ty: self.b * child.tx + self.d * child.ty + self.ty,
        }
    }

    pub fn point(self, x: f64, y: f64) -> (f64, f64) {
        (
            self.a * x + self.c * y + self.tx,
            self.b * x + self.d * y + self.ty,
        )
    }

    pub fn inverse(self) -> Option<Self> {
        let determinant = self.a * self.d - self.b * self.c;
        if determinant.abs() < f64::EPSILON {
            return None;
        }
        let result = Self {
            a: self.d / determinant,
            b: -self.b / determinant,
            c: -self.c / determinant,
            d: self.a / determinant,
            tx: 0.0,
            ty: 0.0,
        };
        Some(Self {
            tx: -(result.a * self.tx + result.c * self.ty),
            ty: -(result.b * self.tx + result.d * self.ty),
            ..result
        })
    }

    pub fn is_integer_translation(self) -> bool {
        const EPSILON: f64 = 1.0e-9;
        (self.a - 1.0).abs() < EPSILON
            && self.b.abs() < EPSILON
            && self.c.abs() < EPSILON
            && (self.d - 1.0).abs() < EPSILON
            && (self.tx - self.tx.round()).abs() < EPSILON
            && (self.ty - self.ty.round()).abs() < EPSILON
    }
}

use super::RenderError;
