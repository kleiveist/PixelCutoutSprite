export function SpriteStudioWelcome() {
  return (
    <section className="studio-welcome" aria-labelledby="sprite-studio-title">
      <p className="view-eyebrow">PIXELSPRITESTUDIO</p>
      <h1 id="sprite-studio-title">Sprites aus geprüften Teilen zusammensetzen.</h1>
      <p>
        Dieser Bereich ist als ehrlicher Zwischenstand sichtbar. Das automatische Laden eines
        Teilemanifests und die View-Ebenen folgen in P41/P42.
      </p>
      <p className="implementation-note" role="status">
        Noch nicht funktionsbereit · keine Szene wird vorgetäuscht oder gespeichert.
      </p>
    </section>
  );
}
