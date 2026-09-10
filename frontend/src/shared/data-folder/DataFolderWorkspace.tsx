import { useEffect, useState, type ReactNode } from "react";
import { Modal, ModalHost } from "../dialogs";
import { useDataFolderBrowser } from "./useDataFolderBrowser";
import { DataFolderToolbar, type DataFolderViewSlot } from "./DataFolderToolbar";
import { useDataFolder, type ImageModule } from "./DataFolderProvider";
import styles from "./DataFolderToolbar.module.css";

export function DataFolderWorkspace({
  module,
  children,
  viewSlot,
}: {
  module: ImageModule;
  children: ReactNode;
  viewSlot?: DataFolderViewSlot;
}) {
  const browser = useDataFolderBrowser(module);
  const selection = useDataFolder().selections[module];
  const [narrow, setNarrow] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia("(max-width: 799px)").matches,
  );
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"files" | "view">("files");
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const media = matchMedia("(max-width: 799px)");
    const change = () => {
      setNarrow(media.matches);
      if (!media.matches) setOpen(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const toolbar = (
    <DataFolderToolbar browser={browser} viewSlot={viewSlot} tab={tab} onTabChange={setTab} />
  );
  return (
    <div className={styles.workspace} data-data-folder-module={module} data-docked={!narrow}>
      {narrow ? (
        <>
          <div className={styles.drawerTrigger}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              Dateien{viewSlot ? " / View" : ""} öffnen
            </button>
          </div>
          <ModalHost>
            <Modal
              open={open}
              title="Vault-Dateien"
              closeLabel="Dateinavigation schließen"
              onClose={() => setOpen(false)}
              className={styles.drawer}
            >
              {toolbar}
            </Modal>
          </ModalHost>
        </>
      ) : (
        <aside
          className={styles.dock}
          aria-label={`${module === "cutout" ? "Cutout" : "Sprite"}-Dateinavigation`}
        >
          {toolbar}
        </aside>
      )}
      <div className={styles.content}>
        {selection ? (
          <section className={styles.receipt} aria-label="Geprüfte Dateiauswahl">
            <strong>
              {selection.kind === "image"
                ? "Letzte geprüfte Bildauswahl"
                : "Letztes geprüftes Teile-Set"}
            </strong>
            <code>{selection.relativePath}</code>
            <span>
              {selection.kind === "image"
                ? `${selection.width} × ${selection.height} px`
                : `${selection.partCount} Teile · ${selection.generationId}${selection.complete ? "" : " · mit ausdrücklich ausgelassenen Teilen"}`}
            </span>
            <small>
              {module === "cutout"
                ? "Die Auswahl ist vorbereitet. Der neue Maskeneditor folgt in P38."
                : "Die Auswahl ist vorbereitet. Der Zusammenbau folgt in P41."}
            </small>
          </section>
        ) : null}
        {children}
      </div>
    </div>
  );
}
