import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { initializePromptStudioRuntime } from "./prompt-studio/services";
import "./styles/global.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("PixelCutoutSprite Studio could not find its application root.");
}
const rootElement = root;

async function renderApplication(): Promise<void> {
  const prompt = await initializePromptStudioRuntime();
  createRoot(rootElement).render(
    <StrictMode>
      <App
        promptStorageAdapter={prompt.storageAdapter}
        promptOutputAdapter={prompt.outputAdapter}
        promptStartupMigration={prompt.migration}
        flushPromptStorage={prompt.flushStorage}
      />
    </StrictMode>,
  );
}

void renderApplication().catch((reason: unknown) => {
  rootElement.textContent = `PixelCutoutSprite Studio could not initialize local prompt storage: ${
    reason instanceof Error ? reason.message : String(reason)
  }`;
});
