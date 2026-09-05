import { useCallback, useEffect, useMemo, useState } from "react";

import type { AreaClient } from "../../api/area-client";
import type {
  AreaCard,
  AreaDashboardData,
  AreaDetails,
  HumanoidProfilePreview,
} from "../../domain/areas";
import type { Direction } from "../../domain/common";

interface DashboardModelOptions {
  client: AreaClient;
  sessionId: string | null;
  projectId: string | null;
  onStatus?: (message: string) => void;
}

interface ActionOptions extends DashboardModelOptions {
  height: number;
  validHeight: boolean;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
  setPreview: (preview: HumanoidProfilePreview | null) => void;
  setSelected: (details: AreaDetails | null) => void;
}

interface CreateActionOptions extends ActionOptions {
  labelIds: string[];
  name: string;
  reload: () => Promise<void>;
}

interface ReviseActionOptions extends ActionOptions {
  selected: AreaDetails | null;
  reload: () => Promise<void>;
}

export interface AreaDashboardModel {
  name: string;
  setName: (name: string) => void;
  height: number;
  setHeight: (height: number) => void;
  direction: Direction;
  setDirection: (direction: Direction) => void;
  labelIds: string[];
  setLabelIds: (labelIds: string[]) => void;
  preview: HumanoidProfilePreview | null;
  dashboard: AreaDashboardData | null;
  selected: AreaDetails | null;
  activeDirection: HumanoidProfilePreview["direction_previews"][number] | null;
  loadingAreas: boolean;
  busy: boolean;
  error: string | null;
  validHeight: boolean;
  hasProjectContext: boolean;
  canWrite: boolean;
  createArea: () => Promise<void>;
  openArea: (area: AreaCard) => Promise<void>;
  reviseSelected: () => Promise<void>;
}

export function useAreaDashboardModel(options: DashboardModelOptions): AreaDashboardModel {
  const { client, projectId, sessionId } = options;
  const [name, setName] = useState("NPCs");
  const [height, setHeight] = useState(80);
  const [direction, setDirection] = useState<Direction>("s");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<AreaDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validHeight = Number.isInteger(height) && height >= 16 && height <= 512;
  const hasProjectContext = Boolean(sessionId && projectId);
  const [preview, setPreview] = useProfilePreview(client, height, validHeight, setError);
  const { dashboard, loadingAreas, reload } = useProjectDashboard(options, setError);
  const actionOptions = {
    ...options,
    height,
    setBusy,
    setError,
    setPreview,
    setSelected,
    validHeight,
  };
  const createArea = useCreateArea({ ...actionOptions, labelIds, name, reload });
  const openArea = useOpenArea({ ...actionOptions, setHeight, setLabelIds, setName });
  const reviseSelected = useReviseArea({ ...actionOptions, reload, selected });
  const activeDirection = useMemo(
    () => preview?.direction_previews.find((item) => item.direction === direction) ?? null,
    [direction, preview],
  );

  return {
    activeDirection,
    busy,
    canWrite: Boolean(hasProjectContext && dashboard?.writable && !busy),
    createArea,
    dashboard,
    direction,
    error,
    hasProjectContext,
    height,
    labelIds,
    loadingAreas,
    name,
    openArea,
    preview,
    reviseSelected,
    selected,
    setDirection,
    setHeight,
    setLabelIds,
    setName,
    validHeight,
  };
}

function useProfilePreview(
  client: AreaClient,
  height: number,
  validHeight: boolean,
  setError: (error: string | null) => void,
) {
  const [preview, setPreview] = useState<HumanoidProfilePreview | null>(null);
  useEffect(() => {
    let live = true;
    if (!validHeight) {
      setPreview(null);
      return () => {
        live = false;
      };
    }
    void client
      .preview(height)
      .then((value) => {
        if (live) setPreview(value);
      })
      .catch((reason: unknown) => {
        if (live) setError(message(reason));
      });
    return () => {
      live = false;
    };
  }, [client, height, setError, validHeight]);
  return [preview, setPreview] as const;
}

function useProjectDashboard(
  { client, projectId, sessionId }: DashboardModelOptions,
  setError: (error: string | null) => void,
) {
  const [dashboard, setDashboard] = useState<AreaDashboardData | null>(null);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const reload = useCallback(async () => {
    if (!sessionId || !projectId) {
      setDashboard(null);
      return;
    }
    setLoadingAreas(true);
    try {
      setDashboard(await client.dashboard(sessionId, projectId));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setLoadingAreas(false);
    }
  }, [client, projectId, sessionId, setError]);

  useEffect(() => {
    setError(null);
    void reload();
  }, [reload, setError]);
  return { dashboard, loadingAreas, reload };
}

function useCreateArea(options: CreateActionOptions): () => Promise<void> {
  const { client, height, labelIds, name, onStatus, projectId, reload, sessionId } = options;
  return useCallback(async () => {
    if (!sessionId || !projectId || !options.validHeight) return;
    options.setBusy(true);
    options.setError(null);
    try {
      const details = await client.create(sessionId, {
        default_frame_size_px: null,
        default_ground_origin_px: null,
        label_ids: labelIds,
        name: name.trim(),
        object_type: "humanoid",
        project_id: projectId,
        reference_height_px: height,
      });
      options.setSelected(details);
      options.setPreview(details.preview);
      await reload();
      onStatus?.(`${details.area.name} area created at ${height}px`);
    } catch (reason) {
      options.setError(message(reason));
    } finally {
      options.setBusy(false);
    }
  }, [client, height, labelIds, name, onStatus, options, projectId, reload, sessionId]);
}

function useOpenArea(
  options: ActionOptions & {
    setName: (name: string) => void;
    setHeight: (height: number) => void;
    setLabelIds: (labelIds: string[]) => void;
  },
): (area: AreaCard) => Promise<void> {
  const { client, onStatus, sessionId } = options;
  return useCallback(
    async (area: AreaCard) => {
      if (!sessionId) return;
      options.setBusy(true);
      options.setError(null);
      try {
        const details = await client.open(sessionId, area.id);
        options.setSelected(details);
        options.setName(details.area.name);
        options.setHeight(details.area.reference_height_px);
        options.setLabelIds(details.area.label_ids);
        options.setPreview(details.preview);
        onStatus?.(`${details.area.name} profile r${details.profile.revision} opened`);
      } catch (reason) {
        options.setError(message(reason));
      } finally {
        options.setBusy(false);
      }
    },
    [client, onStatus, options, sessionId],
  );
}

function useReviseArea(options: ReviseActionOptions): () => Promise<void> {
  const { client, height, onStatus, reload, selected, sessionId } = options;
  return useCallback(async () => {
    if (!sessionId || !selected || !options.validHeight) return;
    options.setBusy(true);
    options.setError(null);
    try {
      const details = await client.reviseProfile(sessionId, {
        area_id: selected.area.id,
        default_frame_size_px: null,
        default_ground_origin_px: null,
        expected_area_revision: selected.area.revision,
        reference_height_px: height,
      });
      options.setSelected(details);
      options.setPreview(details.preview);
      await reload();
      onStatus?.(`Profile r${details.profile.revision} published; older revisions stay pinned`);
    } catch (reason) {
      options.setError(message(reason));
    } finally {
      options.setBusy(false);
    }
  }, [client, height, onStatus, options, reload, selected, sessionId]);
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
