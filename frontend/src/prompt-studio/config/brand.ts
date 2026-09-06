export const BRAND = Object.freeze({
  productName: "PixelPromptStudio",
  shortName: "PixelPromptStudio",
  versionLabel: "V2",
  tagline: "Lokale, profilgestützte Prompt-Produktion für Pixelart-Assets",
  modules: Object.freeze({
    prompt: Object.freeze({
      productName: "PixelPromptStudio",
      shortLabel: "Prompt Generator",
    }),
  }),
} as const);

// Stable discriminator used by existing PixelForge Prompt Studio V2 exports.
export const PROMPT_EXPORT_APPLICATION_ID = "PixelForge Prompt Studio" as const;
export const EXPORT_APPLICATION_ID = PROMPT_EXPORT_APPLICATION_ID;
