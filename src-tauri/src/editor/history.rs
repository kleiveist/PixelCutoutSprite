#[derive(Debug, Clone, PartialEq)]
pub struct EditCommand<T> {
    pub label: String,
    pub before: T,
    pub after: T,
}

#[derive(Debug, Clone)]
pub struct CommandHistory<T> {
    current: T,
    undo: Vec<EditCommand<T>>,
    redo: Vec<EditCommand<T>>,
}

impl<T: Clone + PartialEq> CommandHistory<T> {
    pub fn new(initial: T) -> Self {
        Self {
            current: initial,
            undo: Vec::new(),
            redo: Vec::new(),
        }
    }

    pub fn current(&self) -> &T {
        &self.current
    }

    /// Records a completed interaction. Pointer previews should not call this until pointer-up,
    /// which makes one drag exactly one undo step.
    pub fn commit(&mut self, label: impl Into<String>, next: T) -> bool {
        if next == self.current {
            return false;
        }
        let command = EditCommand {
            label: label.into(),
            before: self.current.clone(),
            after: next.clone(),
        };
        self.current = next;
        self.undo.push(command);
        self.redo.clear();
        true
    }

    pub fn undo(&mut self) -> Option<&T> {
        let command = self.undo.pop()?;
        self.current = command.before.clone();
        self.redo.push(command);
        Some(&self.current)
    }

    pub fn redo(&mut self) -> Option<&T> {
        let command = self.redo.pop()?;
        self.current = command.after.clone();
        self.undo.push(command);
        Some(&self.current)
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
}
