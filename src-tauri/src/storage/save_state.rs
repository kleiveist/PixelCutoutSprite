use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SaveState {
    Clean,
    Dirty,
    Saving,
    Saved,
    Failed,
    Conflict,
}

impl SaveState {
    pub fn after_edit(self) -> Self {
        Self::Dirty
    }

    pub fn begin_save(self) -> Option<Self> {
        matches!(self, Self::Dirty | Self::Failed | Self::Conflict).then_some(Self::Saving)
    }

    pub fn finish(self, succeeded: bool) -> Self {
        if self != Self::Saving {
            return self;
        }
        if succeeded {
            Self::Saved
        } else {
            Self::Failed
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AutosavePolicy {
    pub idle_millis: u64,
}

impl Default for AutosavePolicy {
    fn default() -> Self {
        Self { idle_millis: 2_000 }
    }
}
