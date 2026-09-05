import type { NavigationItem } from "../app/navigation";
import type { OpenVault } from "../api/vault-client";
import { VaultWelcome } from "../features/vault/VaultWelcome";

interface PlaceholderViewProps {
  details: NavigationItem;
  onVaultOpened: (vault: OpenVault) => void;
}

export function PlaceholderView({ details, onVaultOpened }: PlaceholderViewProps) {
  if (details.route !== "welcome") {
    return (
      <section className="placeholder-panel" aria-labelledby="placeholder-heading">
        <span className="phase-tag">PLANNED WORKSPACE</span>
        <p className="view-eyebrow">{details.eyebrow}</p>
        <h1 id="placeholder-heading">{details.label}</h1>
        <p>{details.description}</p>
        <div className="placeholder-grid" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className="implementation-note">
          This view is intentionally marked as a placeholder until its implementation phase.
        </p>
      </section>
    );
  }

  return (
    <section className="welcome-view" aria-labelledby="welcome-heading">
      <div className="welcome-copy">
        <span className="phase-tag">PIXEL-ART RPG WORKBENCH</span>
        <p className="view-eyebrow">Build once · animate clearly</p>
        <h1 id="welcome-heading">
          Cutout animation,
          <br />
          <em>pixel by pixel.</em>
        </h1>
        <p className="welcome-lead">
          Create reusable motion, dress readable characters, and export deterministic sprite
          packages—all from a local desktop vault.
        </p>
        <VaultWelcome onOpened={onVaultOpened} />
      </div>
      <div className="pixel-stage" aria-label="Decorative pixel character preview">
        <div className="stage-grid" />
        <div className="pixel-character" aria-hidden="true">
          <span className="pixel-head" />
          <span className="pixel-body" />
          <span className="pixel-arm pixel-arm-left" />
          <span className="pixel-arm pixel-arm-right" />
          <span className="pixel-leg pixel-leg-left" />
          <span className="pixel-leg pixel-leg-right" />
        </div>
        <div className="stage-label">
          <strong>80 PX</strong>
          <span>PROFILE PREVIEW</span>
        </div>
      </div>
      <div className="feature-strip">
        <article>
          <span>01</span>
          <strong>POSE</strong>
          <small>Readable key poses</small>
        </article>
        <article>
          <span>02</span>
          <strong>DRESS</strong>
          <small>Reusable PNG parts</small>
        </article>
        <article>
          <span>03</span>
          <strong>EXPORT</strong>
          <small>Portable game assets</small>
        </article>
      </div>
    </section>
  );
}
