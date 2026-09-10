import type { OpenVault, VaultClient } from "../shared/vault/vault-client";
import { VaultWelcome } from "../shared/vault/VaultWelcome";
import { useActiveVault } from "../shared/vault";
import { useDataFolder } from "../shared/data-folder";
import styles from "./CutoutWelcome.module.css";

interface CutoutWelcomeProps {
  client: VaultClient;
  onOpened: (vault: OpenVault) => Promise<void>;
  beforeOpen: () => Promise<void>;
}

export function CutoutWelcome({ client, onOpened, beforeOpen }: CutoutWelcomeProps) {
  const { activeVault } = useActiveVault();
  const selection = useDataFolder().selections.cutout;
  return (
    <section className={styles.welcome} aria-labelledby="cutout-welcome-title">
      <p className="view-eyebrow">PIXELCUTOUTSPRITE</p>
      <h1 id="cutout-welcome-title">Willkommen im Cutout-Studio</h1>
      <p>Wähle einen Vault und darin ein Originalbild als Ausgangspunkt für deine Schnittteile.</p>
      <VaultWelcome
        client={client}
        currentVault={activeVault}
        onOpened={onOpened}
        beforeOpen={beforeOpen}
      />
      {activeVault ? (
        <section className={styles.source} aria-label="Cutout-Arbeitsbereich">
          <h2>{activeVault.display_name}</h2>
          <p>
            {activeVault.mode === "read_write" ? "Vault geöffnet" : "Vault schreibgeschützt"} ·{" "}
            {activeVault.path}
          </p>
          {selection?.kind === "image" ? (
            <p>
              Bild ausgewählt: <strong>{selection.relativePath}</strong> · {selection.width} ×{" "}
              {selection.height} Pixel.
            </p>
          ) : (
            <p>Öffne „Dateien“ und wähle ein PNG-, JPEG- oder WebP-Bild per Klick oder Enter.</p>
          )}
          <p role="status">
            Wähle ein Originalbild, um Körperteile mit Rechteck, Lasso und Pinsel zu markieren.
            Bestätigte Masken und Entwürfe werden im Vault gespeichert.
          </p>
        </section>
      ) : null}
      <section aria-label="Ablauf zum Schneiden">
        <h2>So funktioniert der Schnittablauf</h2>
        <ol>
          <li>Originalbild aus den Vault-Dateien auswählen.</li>
          <li>Im Maskeneditor Körperteile markieren und die Auswahl bestätigen.</li>
          <li>Bestätigte Teile als PNGs mit Positionsdaten für PixelSpriteStudio erzeugen.</li>
        </ol>
      </section>
      <p>
        Bestehende Vault-Dateien bleiben erhalten. Originalbilder aus früheren Projekten kannst du
        über die Dateinavigation auswählen.
      </p>
    </section>
  );
}
