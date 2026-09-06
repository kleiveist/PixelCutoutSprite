import { formatAnimationEntry, getAnimationEntries, getDirectionCount } from "../promptContext";
import { createPromptModuleResult, localize } from "../promptFormatting";
import type { PromptModuleBuilder } from "../promptEngine.types";

export const buildAnimationModule: PromptModuleBuilder = (context) => {
  const { language } = context;
  const entries = getAnimationEntries(context);
  const directionCount = getDirectionCount(context.profile);

  if (entries.length === 0) {
    return createPromptModuleResult("animation");
  }

  const formattedEntries = entries.map((entry) => formatAnimationEntry(entry, language));
  const frameLines = entries.flatMap((entry) =>
    entry.frames === undefined
      ? []
      : [
          `${localize(language, "Animation", "Animation")} ${entry.name}: ${String(entry.frames)} ${localize(
            language,
            directionCount === null ? "frames total" : "frames per direction",
            directionCount === null ? "Frames insgesamt" : "Frames je Richtung",
          )}`,
        ],
  );
  const configuredFrameTotal = entries.reduce((total, entry) => total + (entry.frames ?? 0), 0);
  const productionFrameTotal =
    directionCount === null ? configuredFrameTotal : configuredFrameTotal * directionCount;

  return createPromptModuleResult("animation", {
    heading: localize(language, "Animation", "Animation"),
    main: [
      localize(
        language,
        `Create clean, loop-ready animation sequences for: ${formattedEntries.join(", ")}. Preserve volume, anchor, palette, and silhouette from frame to frame.`,
        `Saubere, schleifenfähige Animationssequenzen erstellen für: ${formattedEntries.join(", ")}. Volumen, Anker, Palette und Silhouette von Frame zu Frame erhalten.`,
      ),
    ],
    negative: [
      localize(
        language,
        "frame-to-frame scale, palette, or anchor drift",
        "Skalierungs-, Paletten- oder Ankerdrift zwischen Frames",
      ),
      localize(
        language,
        "broken animation loops or duplicated frames",
        "gebrochene Animationsschleifen oder doppelte Frames",
      ),
    ],
    technical: [
      `${localize(language, "Sequences", "Sequenzen")}: ${formattedEntries.join(", ")}`,
      ...frameLines,
      ...(configuredFrameTotal === 0
        ? []
        : [
            `${localize(language, "Production frame count", "Produktions-Framezahl")}: ${String(productionFrameTotal)}`,
          ]),
    ],
  });
};
