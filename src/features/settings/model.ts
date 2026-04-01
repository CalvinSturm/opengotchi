import { z } from 'zod';

export const SETTINGS_VERSION = 1 as const;

export const settingsDtoSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  alwaysOnTop: z.boolean(),
  notificationsEnabled: z.boolean(),
});

export type SettingsDTO = z.infer<typeof settingsDtoSchema>;

export function createDefaultSettings(): SettingsDTO {
  return {
    version: SETTINGS_VERSION,
    alwaysOnTop: false,
    notificationsEnabled: true,
  };
}
