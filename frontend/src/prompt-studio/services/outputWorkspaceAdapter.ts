export interface OutputTextFile {
  readonly filename: string;
  readonly contents: string;
  readonly mimeType: "text/markdown;charset=utf-8" | "application/json;charset=utf-8";
}

export interface OutputWorkspaceAdapter {
  readonly copyText: (text: string) => Promise<void>;
  readonly downloadTextFile: (file: OutputTextFile) => Promise<void>;
  readonly selectJsonFile?: () => Promise<Readonly<{ filename: string; contents: string }> | null>;
}

/**
 * Keeps clipboard and download browser APIs outside the React workspace so
 * user actions stay mockable and the output UI remains environment-agnostic.
 */
export function createBrowserOutputWorkspaceAdapter(
  browserWindow: Window = window,
  browserDocument: Document = document,
  objectUrlApi: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
): OutputWorkspaceAdapter {
  return {
    async copyText(text) {
      const clipboard = browserWindow.navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== "function") {
        throw new Error("Clipboard API is unavailable.");
      }
      await clipboard.writeText(text);
    },
    async downloadTextFile(file) {
      if (
        typeof objectUrlApi.createObjectURL !== "function" ||
        typeof objectUrlApi.revokeObjectURL !== "function"
      ) {
        throw new Error("Browser download API is unavailable.");
      }

      const objectUrl = objectUrlApi.createObjectURL(
        new Blob([file.contents], { type: file.mimeType }),
      );
      const link = browserDocument.createElement("a");
      link.href = objectUrl;
      link.download = file.filename;
      link.hidden = true;
      browserDocument.body.append(link);

      try {
        link.click();
      } finally {
        link.remove();
        objectUrlApi.revokeObjectURL(objectUrl);
      }
    },
  };
}
