import { describe, expect, it } from 'vitest';

import { buildPetReminderSyncPayload } from './reminderSync';

describe('pet reminder sync payload', () => {
  it('builds a reminder payload from the current primary alert', () => {
    const payload = buildPetReminderSyncPayload({
      notificationsEnabled: true,
      petName: 'Byte',
      primaryAlert: {
        code: 'hungry',
        severity: 'warning',
        label: 'Hungry',
        message: 'Satiety is low. Feeding is overdue.',
      },
    });

    expect(payload).toEqual({
      notificationsEnabled: true,
      reminder: {
        key: 'hungry',
        title: 'Byte needs attention',
        body: 'Satiety is low. Feeding is overdue.',
      },
    });
  });

  it('clears the reminder when notifications are disabled or no alert exists', () => {
    expect(
      buildPetReminderSyncPayload({
        notificationsEnabled: false,
        petName: 'Byte',
        primaryAlert: {
          code: 'sick',
          severity: 'critical',
          label: 'Needs medicine',
          message: 'Your pet feels sick and needs treatment.',
        },
      }),
    ).toEqual({
      notificationsEnabled: false,
      reminder: null,
    });

    expect(
      buildPetReminderSyncPayload({
        notificationsEnabled: true,
        petName: 'Byte',
        primaryAlert: null,
      }),
    ).toEqual({
      notificationsEnabled: true,
      reminder: null,
    });
  });
});
