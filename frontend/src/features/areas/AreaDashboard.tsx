import { areaClient, type AreaClient } from "../../api/area-client";
import { AreaLibrary } from "./AreaLibrary";
import { AreaProfileForm } from "./AreaProfileForm";
import { ProfilePreview } from "./ProfilePreview";
import { useAreaDashboardModel } from "./useAreaDashboard";

interface AreaDashboardProps {
  sessionId: string | null;
  projectId: string | null;
  client?: AreaClient;
  onStatus?: (message: string) => void;
}

export function AreaDashboard({
  sessionId,
  projectId,
  client = areaClient,
  onStatus,
}: AreaDashboardProps) {
  const model = useAreaDashboardModel({ client, onStatus, projectId, sessionId });

  return (
    <section className="areas-view" aria-labelledby="areas-heading">
      <header className="areas-heading">
        <div>
          <span className="phase-tag">HUMANOID PROFILE V1</span>
          <p className="view-eyebrow">Set up reusable body geometry</p>
          <h1 id="areas-heading">Areas</h1>
        </div>
        <p>
          Sixteen prepared cutout slots, eight views, integer scaling, and immutable profile
          revisions.
        </p>
      </header>

      {!model.hasProjectContext && (
        <p className="area-context-notice" role="status">
          Open a project from the Projects dashboard to save an area. The profile preview remains
          available here.
        </p>
      )}
      {model.hasProjectContext && model.dashboard && !model.dashboard.writable && (
        <p className="area-context-notice" role="status">
          This vault is read-only. Existing area profiles can still be inspected.
        </p>
      )}
      {model.error && (
        <p className="workspace-error" role="alert">
          {model.error}
        </p>
      )}

      <div className="area-workbench">
        <AreaProfileForm model={model} />
        <ProfilePreview
          activeDirection={model.activeDirection}
          direction={model.direction}
          preview={model.preview}
          validHeight={model.validHeight}
        />
      </div>

      <AreaLibrary model={model} />
    </section>
  );
}
