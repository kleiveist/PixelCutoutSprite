import type { ReactNode } from "react";
import { DataFolderWorkspace } from "../shared/data-folder";
import { useActiveVault } from "../shared/vault";

/** P36 integration boundary. The legacy Cutout routes are removed separately in P37. */
export function CutoutDataWorkspace({ children }: { children: ReactNode }) {
  const { activeVault } = useActiveVault();
  if (activeVault?.recovery.length) return children;
  return <DataFolderWorkspace module="cutout">{children}</DataFolderWorkspace>;
}
