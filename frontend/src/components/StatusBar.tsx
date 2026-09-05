interface StatusBarProps {
  message: string;
  playing: boolean;
}

export function StatusBar({ message, playing }: StatusBarProps) {
  return (
    <footer className="status-bar" aria-live="polite">
      <span>
        <span className="signal-dot" /> {message}
      </span>
      <span className="status-meta">{playing ? "PREVIEW PLAYING" : "PREVIEW PAUSED"} · v0.1.0</span>
    </footer>
  );
}
