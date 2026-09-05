import type { OutfitLaunchContext, OutfitTarget } from "../../api/outfit-client";

interface OutfitTargetChooserProps {
  launch: OutfitLaunchContext;
  busy: boolean;
  writable: boolean;
  error: string | null;
  onStart: (target: OutfitTarget) => void;
  onResume: (draftId: string) => void;
  onOpenDummy: () => void;
}

export function OutfitTargetChooser({
  launch,
  busy,
  writable,
  error,
  onStart,
  onResume,
  onOpenDummy,
}: OutfitTargetChooserProps) {
  return (
    <section className="outfit-launch" aria-labelledby="outfit-launch-title">
      <header>
        <span>Released motion · r{launch.motion.revision}</span>
        <h1 id="outfit-launch-title">Equip {launch.template.name}</h1>
        <p>Choose an explicit NPC target. The editor never guesses from recent characters.</p>
      </header>
      {!writable && (
        <p role="status">
          This vault is read-only. You can inspect a saved draft, but cannot start or apply outfit
          changes.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="outfit-launch-grid">
        <button
          type="button"
          disabled={busy || !writable}
          onClick={() => onStart({ kind: "new_npc" })}
        >
          <strong>New NPC outfit</strong>
          <span>Start an unnamed, resumable draft.</span>
        </button>
        {launch.compatible_characters.map((character) => (
          <button
            type="button"
            disabled={busy || !writable}
            key={character.id}
            onClick={() => onStart({ kind: "existing_npc", character_id: character.id })}
          >
            <strong>Equip {character.name}</strong>
            <span>Reuse this NPC’s default appearance by stable ID.</span>
          </button>
        ))}
      </div>
      {launch.resumable_drafts.length > 0 && (
        <section aria-labelledby="resume-outfits-title">
          <h2 id="resume-outfits-title">Resume saved drafts</h2>
          <div className="outfit-resume-list">
            {launch.resumable_drafts.map((draft) => (
              <button
                type="button"
                disabled={busy}
                key={draft.id}
                onClick={() => onResume(draft.id)}
              >
                Draft r{draft.revision} · {draft.character_id ? "existing NPC" : "new NPC"} ·{" "}
                {new Date(draft.updated_at).toLocaleString()}
              </button>
            ))}
          </div>
        </section>
      )}
      <button type="button" className="outfit-link-button" onClick={onOpenDummy}>
        Motion looks wrong? Return to dummy editor
      </button>
    </section>
  );
}
