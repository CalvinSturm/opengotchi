import { buildAlertNotification, type PetAlert } from '../pet/simulation/petSimulation';
import type { PetReminderSyncDTO } from './notificationModel';

export function buildPetReminderSyncPayload(input: {
  notificationsEnabled: boolean;
  petName: string;
  primaryAlert: PetAlert | null;
}): PetReminderSyncDTO {
  const { notificationsEnabled, petName, primaryAlert } = input;

  if (!notificationsEnabled || !primaryAlert) {
    return {
      notificationsEnabled,
      reminder: null,
    };
  }

  return {
    notificationsEnabled,
    reminder: {
      key: primaryAlert.code,
      ...buildAlertNotification(petName, primaryAlert),
    },
  };
}
