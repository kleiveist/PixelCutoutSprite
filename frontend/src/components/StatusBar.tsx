interface StatusBarProps {
  message: string;
}

export function StatusBar({ message }: StatusBarProps) {
  return (
    <footer className="status-bar" aria-live="polite">
      <span>
        <span className="signal-dot" /> {message}
      </span>
      <span className="status-meta">LOCAL DESKTOP · v0.1.0</span>
    </footer>
  );
}
