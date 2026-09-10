import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useActiveVault } from "../vault";
import {
  DataFolderSession,
  nativeDataFolderClient,
  type DataFolderClient,
  type DataFolderSelection,
} from "./dataFolderClient";

export type ImageModule = "cutout" | "sprite";
interface DataFolderContextValue {
  readonly repository: DataFolderSession | null;
  readonly selections: Readonly<Record<ImageModule, DataFolderSelection | null>>;
  select(module: ImageModule, value: DataFolderSelection): void;
}
const Context = createContext<DataFolderContextValue | null>(null);
export function DataFolderProvider({
  children,
  client = nativeDataFolderClient,
}: {
  children: ReactNode;
  client?: DataFolderClient;
}) {
  const { session } = useActiveVault();
  return (
    <SessionProvider
      key={session ? `${session.sessionId}:${session.generation}` : "no-vault"}
      client={client}
    >
      {children}
    </SessionProvider>
  );
}
function SessionProvider({ children, client }: { children: ReactNode; client: DataFolderClient }) {
  const { session } = useActiveVault();
  const sessionId = session?.sessionId;
  const generation = session?.generation;
  const repository = useMemo(
    () =>
      sessionId && generation !== undefined
        ? new DataFolderSession({ sessionId, generation }, client)
        : null,
    [client, generation, sessionId],
  );
  const owner = useMemo(() => ({ leases: 0, repository }), [repository]);
  useEffect(() => {
    owner.leases += 1;
    return () => {
      owner.leases -= 1;
      // React StrictMode reattaches effects synchronously; a real unmount still
      // releases this session's queue/cache before the next event loop turn.
      queueMicrotask(() => {
        if (owner.leases === 0) owner.repository?.dispose();
      });
    };
  }, [owner]);
  const [selections, setSelections] = useState<Record<ImageModule, DataFolderSelection | null>>({
    cutout: null,
    sprite: null,
  });
  const select = useCallback(
    (module: ImageModule, value: DataFolderSelection) => {
      if (value.session.sessionId !== sessionId || value.session.generation !== generation) return;
      setSelections((current) => ({ ...current, [module]: value }));
    },
    [generation, sessionId],
  );
  const value = useMemo(
    () => ({ repository, selections, select }),
    [repository, selections, select],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDataFolder() {
  const context = useContext(Context);
  if (!context) throw new Error("DataFolderProvider fehlt.");
  return context;
}
