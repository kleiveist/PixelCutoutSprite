import type { StudioMode } from "../shared/navigation";
import { ForgeMarkIcon as PixelPromptStudioIcon } from "../prompt-studio/components/icons/ForgeMarkIcon";

interface AppHeaderProps {
  activeStudio: StudioMode;
  onOpenCutoutStudio: () => void;
  onOpenPromptStudio: () => void;
  onOpenSpriteStudio?: () => void;
  onSettings?: () => void;
  onHelp: () => void;
}

export function AppHeader({
  activeStudio,
  onOpenCutoutStudio,
  onOpenPromptStudio,
  onOpenSpriteStudio = () => undefined,
  onSettings = () => undefined,
  onHelp,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-studio-switcher" role="group" aria-label="Studio wechseln">
        <button
          type="button"
          className="brand-lockup studio-switch-button"
          aria-label="PixelCutoutSprite Studio öffnen"
          aria-pressed={activeStudio === "cutout"}
          onClick={onOpenCutoutStudio}
        >
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
        </button>
        <button
          type="button"
          className="prompt-lockup studio-switch-button"
          aria-label="PixelPromptStudio Generator öffnen"
          aria-pressed={activeStudio === "prompt"}
          onClick={onOpenPromptStudio}
        >
          <span className="prompt-mark" aria-hidden="true">
            <PixelPromptStudioIcon />
          </span>
          <span>
            <strong>PixelPromptStudio</strong>
            <small>GENERATOR</small>
          </span>
        </button>
        <button
          type="button"
          className="sprite-lockup studio-switch-button"
          aria-label="PixelSpriteStudio öffnen"
          aria-pressed={activeStudio === "sprite"}
          onClick={onOpenSpriteStudio}
        >
          <span className="sprite-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>PixelSpriteStudio</strong>
            <small>ASSEMBLY</small>
          </span>
        </button>
      </div>
      <div className="header-actions">
        <span className="desktop-badge">LOCAL DESKTOP</span>
        <button
          className="header-action-button"
          type="button"
          onClick={onSettings}
          aria-label="Globale Einstellungen öffnen"
        >
          <span aria-hidden="true">⚙</span>
          <span className="header-action-label">Einstellungen</span>
        </button>
        <button
          className="header-action-button"
          type="button"
          onClick={onHelp}
          aria-label="Open shortcut help"
        >
          <span aria-hidden="true">?</span>
          <span className="header-action-label">Hilfe</span>
        </button>
      </div>
    </header>
  );
}
