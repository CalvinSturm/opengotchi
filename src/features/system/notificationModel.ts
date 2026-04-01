import { z } from 'zod';

export const petNotificationDtoSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(280),
});

export const petReminderDtoSchema = z.object({
  key: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(280),
});

export const petReminderSyncDtoSchema = z.object({
  notificationsEnabled: z.boolean(),
  reminder: petReminderDtoSchema.nullable(),
});

export type PetNotificationDTO = z.infer<typeof petNotificationDtoSchema>;
export type PetReminderDTO = z.infer<typeof petReminderDtoSchema>;
export type PetReminderSyncDTO = z.infer<typeof petReminderSyncDtoSchema>;
