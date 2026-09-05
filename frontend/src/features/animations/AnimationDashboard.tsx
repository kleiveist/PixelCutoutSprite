import { useCallback, useEffect, useMemo, useState } from "react";

import { motionClient, type MotionClient } from "../../api/motion-client";
import {
  emptyMotionFilters,
  filterMotionCards,
  type MotionCard,
  type MotionOpenTarget,
} from "../../domain/animations";
import type { PixelPoint, PixelSize } from "../../domain/common";
import { MotionCardView } from "./MotionCardView";
import { MotionCreateDialog } from "./MotionCreateDialog";
import { MotionFilters } from "./MotionFilters";
import { LiveMotionCardPreview } from "./LiveMotionCardPreview";
import { MotionReleaseDialog } from "./MotionReleaseDialog";
import "./animations.css";

interface AnimationDashboardProps {
  sessionId: string;
  areaId: string;
  characterId?: string | null;
  defaultFrameSize: PixelSize;
  defaultGroundOrigin: PixelPoint;
  client?: MotionClient;
  onOpen: (target: MotionOpenTarget) => void;
  onOpenNpcs?: () => void;
  onStatus?: (message: string) => void;
  onPublishingChange?: (publishing: boolean) => void;
}

export function AnimationDashboard({
  sessionId,
  areaId,
  characterId = null,
  defaultFrameSize,
  defaultGroundOrigin,
  client = motionClient,
  onOpen,
  onOpenNpcs,
  onStatus,
  onPublishingChange,
}: AnimationDashboardProps) {
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<MotionClient["dashboard"]>> | null>(
    null,
  );
  const [filters, setFilters] = useState(emptyMotionFilters);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<MotionCard | null>(null);
  const [releasing, setReleasing] = useState<MotionCard | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDashboard(await client.dashboard(sessionId, areaId));
      setError(null);
    } catch (reason) {
      setError(message(reason));
    }
  }, [areaId, client, sessionId]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    onPublishingChange?.(publishing);
    return () => {
      if (publishing) onPublishingChange?.(false);
    };
  }, [onPublishingChange, publishing]);
  const cards = useMemo(
    () => filterMotionCards(dashboard?.motions ?? [], filters),
    [dashboard?.motions, filters],
  );

  async function duplicate(motion: MotionCard): Promise<void> {
    const copy = await client.duplicate(sessionId, motion.id);
    onStatus?.(`${copy.name} created with a new template identity`);
    await load();
  }
  async function archive(motion: MotionCard): Promise<void> {
    await client.setArchived(sessionId, motion.id, motion.revision, motion.status !== "archived");
    await load();
  }
  async function publish(motion: MotionCard): Promise<void> {
    setPublishing(true);
    try {
      const release = await client.publish(sessionId, motion.id);
      onStatus?.(`${motion.name} dummy released as immutable r${release.revision}`);
      setReleasing(null);
      await load();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="animations-view" aria-labelledby="animations-title">
      <header className="animations-header">
        <div>
          <span>REUSABLE MOTION</span>
          <h1 id="animations-title">Animations</h1>
        </div>
        <button
          className="primary-button"
          disabled={!dashboard?.writable || publishing}
          type="button"
          onClick={() => setCreating(true)}
        >
          New animation
        </button>
      </header>
      <nav className="area-mode-tabs" aria-label="Area workspace">
        <button type="button" aria-current="page">
          Animations
        </button>
        <button type="button" disabled={publishing} onClick={onOpenNpcs}>
          NPCs
        </button>
      </nav>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {dashboard && !dashboard.writable && (
        <p role="status">This vault is read-only. Templates can be inspected but not changed.</p>
      )}
      <MotionFilters
        value={filters}
        profileIds={(dashboard?.profiles ?? []).map((profile) => profile.id)}
        onChange={setFilters}
      />
      <button
        type="button"
        className="filter-reset"
        onClick={() => setFilters(emptyMotionFilters())}
      >
        Reset filters
      </button>
      <div className="motion-grid">
        {cards.map((motion) => (
          <MotionCardView
            key={motion.id}
            motion={motion}
            disabled={!dashboard?.writable || publishing}
            busy={publishing}
            onOpen={onOpen}
            preview={
              <LiveMotionCardPreview client={client} sessionId={sessionId} motion={motion} />
            }
            onResolveOpen={() => client.resolveOpen(sessionId, motion.id, characterId)}
            onOpenDummy={() => onOpen({ kind: "dummy_editor", template_id: motion.id })}
            onDuplicate={() => void duplicate(motion).catch((reason) => setError(message(reason)))}
            onPublish={() => setReleasing(motion)}
            onArchive={() => void archive(motion).catch((reason) => setError(message(reason)))}
            onRemove={() => setRemoving(motion)}
          />
        ))}
      </div>
      {dashboard && cards.length === 0 && (
        <p className="motion-empty">No animations match this view.</p>
      )}
      <MotionCreateDialog
        areaId={areaId}
        defaultFrameSize={defaultFrameSize}
        defaultGroundOrigin={defaultGroundOrigin}
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (request) => {
          const motion = await client.create(sessionId, request);
          setCreating(false);
          await load();
          onOpen({ kind: "dummy_editor", template_id: motion.id });
        }}
      />
      {removing && (
        <div className="motion-dialog-backdrop" role="presentation">
          <div
            className="motion-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-motion-title"
          >
            <h2 id="remove-motion-title">Remove {removing.name}?</h2>
            <p>
              The template moves to project trash. Released revisions are not silently reassigned.
            </p>
            <footer>
              <button type="button" onClick={() => setRemoving(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void client
                    .remove(sessionId, removing.id, removing.revision)
                    .then(async () => {
                      setRemoving(null);
                      await load();
                    })
                    .catch((reason) => setError(message(reason)));
                }}
              >
                Move to trash
              </button>
            </footer>
          </div>
        </div>
      )}
      {releasing && (
        <MotionReleaseDialog
          motion={releasing}
          busy={publishing}
          onCancel={() => setReleasing(null)}
          onConfirm={() => void publish(releasing).catch((reason) => setError(message(reason)))}
        />
      )}
    </section>
  );
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
