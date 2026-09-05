import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  npcClient,
  type NpcBindingView,
  type NpcClient,
  type NpcWorkspaceContext,
  type ReleasedMotionOption,
} from "../../api/npc-client";
import type { LocalOverride, RevisionRef } from "../../domain";
import { NpcDashboard } from "./NpcDashboard";
import { NpcDetail } from "./NpcDetail";
import { emptyNpcFilter, type NpcFilter } from "./npc-filter";
import "./NpcWorkspace.css";

export interface AreaSectionContext {
  areaId: string;
  npcId: string | null;
  bindingId: string | null;
}

export interface NpcSelectionContext {
  npcId: string | null;
  bindingId: string | null;
}

interface NpcWorkspaceProps {
  sessionId: string;
  areaId: string;
  readOnly?: boolean;
  initialNpcId?: string;
  initialBindingId?: string;
  client?: NpcClient;
  onDirtyChange?: (dirty: boolean) => void;
  onSelectionChange?: (selection: NpcSelectionContext) => void;
  onSectionChange?: (
    section: "animations" | "npcs" | "export",
    context: AreaSectionContext,
  ) => void;
  onStatus?: (message: string) => void;
}

export function NpcWorkspace({
  sessionId,
  areaId,
  readOnly = false,
  initialNpcId,
  initialBindingId,
  client = npcClient,
  onDirtyChange,
  onSelectionChange,
  onSectionChange,
  onStatus,
}: NpcWorkspaceProps) {
  const workspaceIdentity = `${sessionId}\u0000${areaId}`;
  const initialWorkspaceIdentity = useRef(workspaceIdentity);
  const initialSelection = useRef<NpcSelectionContext>({
    npcId: initialNpcId ?? null,
    bindingId: initialBindingId ?? null,
  });
  if (initialWorkspaceIdentity.current !== workspaceIdentity) {
    initialWorkspaceIdentity.current = workspaceIdentity;
    initialSelection.current = {
      npcId: initialNpcId ?? null,
      bindingId: initialBindingId ?? null,
    };
  }
  const [context, setContext] = useState<NpcWorkspaceContext | null>(null);
  const [selection, setSelection] = useState<NpcSelectionContext>(initialSelection.current);
  const [filter, setFilter] = useState<NpcFilter>(emptyNpcFilter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overrideDrafts, setOverrideDrafts] = useState<
    Readonly<Record<string, readonly LocalOverride[]>>
  >({});
  const dirtyBindingIds = useMemo(() => new Set(Object.keys(overrideDrafts)), [overrideDrafts]);

  const load = useCallback(
    async (preferredId?: string, savedBindingId?: string) => {
      const next = await client.inspect(sessionId, areaId);
      setContext(next);
      setOverrideDrafts((current) => reconcileOverrideDrafts(current, next, savedBindingId));
      setSelection((current) =>
        normalizeSelection(
          next,
          preferredId ?? current.npcId ?? initialSelection.current.npcId,
          preferredId ? null : (current.bindingId ?? initialSelection.current.bindingId),
        ),
      );
      return next;
    },
    [areaId, client, sessionId],
  );

  useEffect(() => {
    let active = true;
    setContext(null);
    setSelection(initialSelection.current);
    setOverrideDrafts({});
    setError(null);
    setNotice(null);
    client
      .inspect(sessionId, areaId)
      .then((next) => {
        if (!active) return;
        setContext(next);
        setSelection((current) =>
          normalizeSelection(
            next,
            current.npcId ?? initialSelection.current.npcId,
            current.bindingId ?? initialSelection.current.bindingId,
          ),
        );
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [areaId, client, sessionId]);

  const selected = useMemo(
    () => context?.npcs.find((npc) => npc.character.id === selection.npcId) ?? null,
    [context, selection.npcId],
  );
  const navigationUnsafe = !readOnly && (dirtyBindingIds.size > 0 || busy);
  useEffect(() => {
    onDirtyChange?.(navigationUnsafe);
    return () => {
      if (navigationUnsafe) onDirtyChange?.(false);
    };
  }, [navigationUnsafe, onDirtyChange]);
  useEffect(() => {
    if (!navigationUnsafe) return;
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [navigationUnsafe]);
  useEffect(() => {
    if (context) onSelectionChange?.(selection);
  }, [context, onSelectionChange, selection]);

  function selectNpc(id: string): void {
    if (id === selection.npcId) return;
    if (busy) {
      onStatus?.("Wait for the current NPC change to finish");
      return;
    }
    if (
      dirtyBindingIds.size > 0 &&
      !window.confirm("Discard unsaved binding-local corrections and open another NPC?")
    ) {
      onStatus?.("NPC selection cancelled · save local corrections first");
      return;
    }
    setOverrideDrafts({});
    setSelection(normalizeSelection(context, id, null));
  }

  function changeOverrides(view: NpcBindingView, overrides: LocalOverride[]): void {
    setOverrideDrafts((current) => {
      const next = { ...current };
      if (overridesEqual(overrides, view.binding.local_overrides)) delete next[view.binding.id];
      else next[view.binding.id] = overrides;
      return next;
    });
  }

  async function mutate<T>(
    action: () => Promise<T>,
    message: string,
    preferredId?: (result: T) => string,
    savedBindingId?: string,
  ): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      await load(preferredId?.(result), savedBindingId);
      setNotice(message);
      onStatus?.(message);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!context && !error) {
    return <p className="npc-workspace-loading">Loading NPCs…</p>;
  }

  if (!context) {
    return (
      <section className="npc-workspace-error" role="alert">
        <h1>NPC workspace could not open</h1>
        <p>{error}</p>
      </section>
    );
  }

  const areaContext = {
    areaId: context.area_id,
    npcId: selection.npcId,
    bindingId: selection.bindingId,
  };

  return (
    <section className="npc-workspace" aria-label={`${context.area_name} NPC workspace`}>
      <header className="area-mode-bar">
        <div>
          <span>Current area</span>
          <strong>{context.area_name}</strong>
        </div>
        <nav aria-label="Area workspace modes">
          <button type="button" onClick={() => onSectionChange?.("animations", areaContext)}>
            Animations
          </button>
          <button
            type="button"
            aria-current="page"
            onClick={() => onSectionChange?.("npcs", areaContext)}
          >
            NPCs
          </button>
          <button type="button" onClick={() => onSectionChange?.("export", areaContext)}>
            Export
          </button>
        </nav>
        {readOnly && <span className="npc-read-only">Read-only vault</span>}
      </header>
      {(error || notice) && (
        <div
          className={error ? "npc-workspace-message is-error" : "npc-workspace-message"}
          role={error ? "alert" : "status"}
        >
          {error ?? notice}
        </div>
      )}
      <div className="npc-workspace-body">
        <NpcDashboard
          context={context}
          filter={filter}
          selectedId={selection.npcId}
          onFilterChange={setFilter}
          onSelect={selectNpc}
        />
        <NpcDetail
          npc={selected}
          selectedBindingId={selection.bindingId}
          overrideDrafts={overrideDrafts}
          hasDirtyDrafts={dirtyBindingIds.size > 0}
          busy={busy}
          readOnly={readOnly}
          onBindingSelect={(bindingId) => setSelection((current) => ({ ...current, bindingId }))}
          onOverridesChange={changeOverrides}
          onAddBinding={(motion: ReleasedMotionOption, variantKey: string | null) => {
            if (!selected) return;
            void mutate(
              () =>
                client.addBinding(sessionId, areaId, {
                  character_id: selected.character.id,
                  template_ref: motion.template_ref,
                  variant_action_key: variantKey,
                }),
              `Assigned ${variantKey || motion.default_action_key} r${motion.template_ref.revision}`,
            );
          }}
          onSaveOverrides={(view: NpcBindingView, overrides: LocalOverride[]) => {
            void mutate(
              () =>
                client.updateOverrides(sessionId, areaId, {
                  binding_id: view.binding.id,
                  expected_revision: view.binding.revision,
                  local_overrides: overrides,
                }),
              `Saved local ${view.binding.action_key} corrections`,
              undefined,
              view.binding.id,
            );
          }}
          onAdopt={(view: NpcBindingView, templateRef: RevisionRef) => {
            void mutate(
              () =>
                client.adoptRevision(
                  sessionId,
                  areaId,
                  view.binding.id,
                  view.binding.revision,
                  templateRef,
                ),
              `Adopted ${view.binding.action_key} r${templateRef.revision}`,
            );
          }}
          onReviewBinding={(view: NpcBindingView) => {
            void mutate(
              () => client.reviewBinding(sessionId, areaId, view.binding.id, view.binding.revision),
              `Reviewed ${view.binding.action_key} binding`,
            );
          }}
          onReviewNpc={() => {
            if (!selected) return;
            void mutate(
              () =>
                client.setStatus(
                  sessionId,
                  areaId,
                  selected.character.id,
                  selected.character.revision,
                  "reviewed",
                ),
              `Reviewed ${selected.character.name}`,
            );
          }}
          onDuplicate={(name: string) => {
            if (!selected) return;
            if (dirtyBindingIds.size > 0) {
              onStatus?.("Save or discard local corrections before duplicating this NPC");
              return;
            }
            void mutate(
              () => client.duplicate(sessionId, areaId, selected.character.id, name),
              `Duplicated ${selected.character.name} as ${name}`,
              (result) => result.character.id,
            );
          }}
          onRename={(name: string) => {
            if (!selected) return;
            void mutate(
              () =>
                client.rename(
                  sessionId,
                  areaId,
                  selected.character.id,
                  selected.character.revision,
                  name,
                ),
              `Renamed NPC to ${name}`,
            );
          }}
          onKeepCurrent={(view: NpcBindingView) => {
            const message = `Kept pinned ${view.binding.action_key} r${view.binding.template_ref.revision}`;
            setNotice(message);
            onStatus?.(message);
          }}
          onExport={(bindingId) =>
            onSectionChange?.("export", {
              ...areaContext,
              npcId: selected?.character.id ?? null,
              bindingId,
            })
          }
        />
      </div>
    </section>
  );
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function normalizeSelection(
  context: NpcWorkspaceContext | null,
  preferredNpcId: string | null,
  preferredBindingId: string | null,
): NpcSelectionContext {
  const npc =
    context?.npcs.find((candidate) => candidate.character.id === preferredNpcId) ??
    context?.npcs[0] ??
    null;
  const binding =
    npc?.bindings.find((candidate) => candidate.binding.id === preferredBindingId) ??
    npc?.bindings[0] ??
    null;
  return {
    npcId: npc?.character.id ?? null,
    bindingId: binding?.binding.id ?? null,
  };
}

function reconcileOverrideDrafts(
  current: Readonly<Record<string, readonly LocalOverride[]>>,
  context: NpcWorkspaceContext,
  savedBindingId?: string,
): Readonly<Record<string, readonly LocalOverride[]>> {
  const persisted = new Map(
    context.npcs.flatMap((npc) =>
      npc.bindings.map((view) => [view.binding.id, view.binding.local_overrides] as const),
    ),
  );
  return Object.fromEntries(
    Object.entries(current).filter(
      ([bindingId, overrides]) =>
        bindingId !== savedBindingId &&
        persisted.has(bindingId) &&
        !overridesEqual(overrides, persisted.get(bindingId)!),
    ),
  );
}

function overridesEqual(left: readonly LocalOverride[], right: readonly LocalOverride[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
