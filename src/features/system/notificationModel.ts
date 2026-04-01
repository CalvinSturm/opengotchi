import { z } from 'zod';

export const petNotificationDtoSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(280),
});

export type PetNotificationDTO = z.infer<typeof petNotificationDtoSchema>;
