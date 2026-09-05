interface AppHeaderProps {
  onHelp: () => void;
}

export function AppHeader({ onHelp }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-lockup" aria-label="PixelCutoutSprite Studio">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span>
          <strong>PixelCutoutSprite</strong>
          <small>STUDIO</small>
        </span>
      </div>
      <div className="header-actions">
        <span className="desktop-badge">LOCAL DESKTOP</span>
        <button
          className="icon-button"
          type="button"
          onClick={onHelp}
          aria-label="Open shortcut help"
        >
          ?
        </button>
      </div>
    </header>
  );
}
