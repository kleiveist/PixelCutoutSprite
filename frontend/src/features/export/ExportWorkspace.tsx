import { useEffect, useMemo, useRef, useState } from "react";

import {
  exportClient,
  type ExportClient,
  type NpcExportInspection,
  type StoredNpcExportProfile,
} from "../../api/export-client";
import { npcClient, type NpcClient, type NpcWorkspaceContext } from "../../api/npc-client";
import { ExportDialog, type ExportCharacterOption } from "./ExportDialog";
import {
  cloneExportProfile,
  DEFAULT_EXPORT_PROFILE,
  fromStoredExportProfile,
  toProfileSnapshot,
  type ExportProfile,
} from "./export-model";
import "./ExportDialog.css";

interface ExportWorkspaceProps {
  sessionId: string;
  areaId: string;
  readOnly?: boolean;
  initialNpcId?: string;
  initialBindingId?: string;
  client?: ExportClient;
  npcsClient?: NpcClient;
  onRunningChange?: (running: boolean) => void;
  onSelectionChange?: (selection: { npcId: string | null; bindingId: string | null }) => void;
  onStatus?: (message: string) => void;
}

interface ProfileEntry {
  profile: ExportProfile;
  revision: number | null;
}

export function ExportWorkspace({
  sessionId,
  areaId,
  readOnly = false,
  initialNpcId,
  initialBindingId,
  client = exportClient,
  npcsClient = npcClient,
  onRunningChange,
  onSelectionChange,
  onStatus,
}: ExportWorkspaceProps) {
  const initialNpc = useRef(initialNpcId);
  const [context, setContext] = useState<NpcWorkspaceContext | null>(null);
  const [characterId, setCharacterId] = useState(initialNpc.current ?? "");
  const [inspection, setInspection] = useState<NpcExportInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [profileEntries, setProfileEntries] = useState<ProfileEntry[]>(() => [
    { profile: cloneExportProfile(DEFAULT_EXPORT_PROFILE), revision: null },
  ]);
  const contextGeneration = useRef(0);
  const inspectionGeneration = useRef(0);
  const openButton = useRef<HTMLButtonElement>(null);

  const characters = useMemo<ExportCharacterOption[]>(
    () =>
      context?.npcs
        .filter((npc) => npc.character.status !== "archived")
        .map((npc) => ({ id: npc.character.id, name: npc.character.name })) ?? [],
    [context],
  );
  const profiles = useMemo(() => profileEntries.map((entry) => entry.profile), [profileEntries]);

  useEffect(() => {
    const generation = contextGeneration.current + 1;
    contextGeneration.current = generation;
    setLoading(true);
    setError(null);
    setContext(null);
    void npcsClient
      .inspect(sessionId, areaId)
      .then((next) => {
        if (contextGeneration.current !== generation) return;
        const nextCharacters = next.npcs.filter((npc) => npc.character.status !== "archived");
        const preferred =
          nextCharacters.find((npc) => npc.character.id === initialNpc.current)?.character.id ??
          nextCharacters[0]?.character.id ??
          "";
        setContext(next);
        setCharacterId(preferred);
      })
      .catch((reason: unknown) => {
        if (contextGeneration.current === generation) setError(messageFrom(reason));
      })
      .finally(() => {
        if (contextGeneration.current === generation) setLoading(false);
      });
    return () => {
      contextGeneration.current += 1;
    };
  }, [areaId, npcsClient, sessionId]);

  useEffect(() => {
    let active = true;
    setProfilesLoading(true);
    setProfileError(null);
    void client
      .listProfiles(sessionId, areaId)
      .then((stored) => {
        if (!active) return;
        setProfileEntries([
          { profile: cloneExportProfile(DEFAULT_EXPORT_PROFILE), revision: null },
          ...stored.map(profileEntry),
        ]);
      })
      .catch((reason: unknown) => {
        if (active) setProfileError(messageFrom(reason));
      })
      .finally(() => {
        if (active) setProfilesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [areaId, client, sessionId]);

  useEffect(() => {
    if (!characterId) {
      setInspection(null);
      setInspectionLoading(false);
      return;
    }
    const generation = inspectionGeneration.current + 1;
    inspectionGeneration.current = generation;
    setInspection(null);
    setInspectionLoading(true);
    setError(null);
    void client
      .inspect(sessionId, areaId, characterId)
      .then((next) => {
        if (inspectionGeneration.current === generation) setInspection(next);
      })
      .catch((reason: unknown) => {
        if (inspectionGeneration.current === generation) setError(messageFrom(reason));
      })
      .finally(() => {
        if (inspectionGeneration.current === generation) setInspectionLoading(false);
      });
    return () => {
      inspectionGeneration.current += 1;
    };
  }, [areaId, characterId, client, sessionId]);

  useEffect(() => {
    if (!running) return;
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [running]);

  function reportRunning(next: boolean): void {
    setRunning(next);
    onRunningChange?.(next);
  }

  async function saveProfile(profile: ExportProfile): Promise<ExportProfile> {
    const existing = profileEntries.find(
      (entry) => entry.profile.id === profile.id && entry.revision !== null,
    );
    const stored = await client.saveProfile(sessionId, areaId, {
      profile_id: existing?.profile.id ?? null,
      expected_revision: existing?.revision ?? null,
      profile: toProfileSnapshot(profile),
      root_motion_mode: profile.rootMotionMode,
      jump_mode: profile.jumpMode,
    });
    const saved = profileEntry(stored);
    setProfileEntries((current) => {
      if (existing)
        return current.map((entry) => (entry.profile.id === existing.profile.id ? saved : entry));
      return [...current, saved];
    });
    setProfileError(null);
    onStatus?.(`${saved.profile.name} saved in this area`);
    return saved.profile;
  }

  if (loading) return <p className="export-workspace-loading">Loading export sources…</p>;

  return (
    <section className="export-workspace" aria-labelledby="export-workspace-title">
      <header>
        <div>
          <span className="phase-tag">PORTABLE OUTPUT</span>
          <h1 id="export-workspace-title">PNG + JSON export</h1>
          <p>
            Build deterministic atlas pages from exact pinned NPC motions and the reference pixel
            compositor.
          </p>
        </div>
        {readOnly && <span className="export-workspace-read-only">Read-only vault</span>}
      </header>

      {error && (
        <p className="export-workspace-error" role="alert">
          {error}
        </p>
      )}
      {profileError && (
        <p className="export-workspace-error" role="alert">
          Stored profiles could not load: {profileError}
        </p>
      )}
      {characters.length === 0 ? (
        <div className="export-workspace-empty">
          <h2>No exportable NPCs</h2>
          <p>Create and name an NPC with at least one pinned animation assignment first.</p>
        </div>
      ) : (
        <div className="export-workspace-card">
          <div>
            <strong>{characters.find((character) => character.id === characterId)?.name}</strong>
            <span>
              {inspectionLoading
                ? "Inspecting pinned sources…"
                : `${inspection?.bindings.length ?? 0} assignment(s) ready to configure`}
            </span>
          </div>
          <button
            ref={openButton}
            className="primary-button"
            type="button"
            disabled={inspectionLoading || !inspection || running}
            onClick={() => setDialogOpen(true)}
          >
            Configure export
          </button>
        </div>
      )}

      <p className="export-workspace-note">
        {profilesLoading
          ? "Loading area export profiles…"
          : "Saved profiles belong to this area and travel with its vault."}
      </p>

      {dialogOpen && characters.length > 0 && (
        <ExportDialog
          characters={characters}
          inspection={inspection}
          inspectionLoading={inspectionLoading}
          initialCharacterId={characterId || initialNpcId}
          initialBindingId={initialBindingId}
          initialProfile={profiles[0]}
          savedProfiles={profiles}
          readOnly={readOnly}
          onCharacterChange={setCharacterId}
          onSelectionChange={(npcId, bindingId) => {
            setCharacterId(npcId);
            onSelectionChange?.({ npcId, bindingId });
          }}
          onStart={async (request, signal, report) => {
            const result = await client.run(sessionId, areaId, request, signal, report);
            onStatus?.(
              result.complete
                ? "PNG + JSON export published"
                : "Marked incomplete test export published",
            );
            return result;
          }}
          onSaveProfile={saveProfile}
          onRunningChange={reportRunning}
          onClose={() => {
            setDialogOpen(false);
            window.setTimeout(() => openButton.current?.focus(), 0);
          }}
        />
      )}
    </section>
  );
}

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function profileEntry(stored: StoredNpcExportProfile): ProfileEntry {
  return { profile: fromStoredExportProfile(stored), revision: stored.revision };
}
