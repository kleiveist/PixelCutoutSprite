import { z } from "zod";
import { APP_VIEW_IDS } from "../domain/navigation";
import { THEME_PREFERENCES } from "../domain/theme";
import { IsoDateTimeSchema, SchemaVersionSchema, StableIdSchema } from "./common.schema";

export const ThemePreferenceSchema = z.enum(THEME_PREFERENCES);

export const AppSettingsSchema = z.strictObject({
  schemaVersion: SchemaVersionSchema,
  kind: z.literal("appSettings"),
  theme: ThemePreferenceSchema,
  locale: z.enum(["de", "en"]),
  startView: z.enum(APP_VIEW_IDS),
  activeBaseProfileId: StableIdSchema.nullable(),
  updatedAt: IsoDateTimeSchema,
});

export function parseAppSettings(input: unknown): AppSettings {
  return AppSettingsSchema.parse(input);
}

export type AppSettings = z.infer<typeof AppSettingsSchema>;
