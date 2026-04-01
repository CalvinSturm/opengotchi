import { describe, expect, it } from 'vitest';

import { settingsDtoSchema } from './model';

describe('settings dto mapping', () => {
  it('parses the documented IPC shape', () => {
    const dto = settingsDtoSchema.parse({
      version: 1,
      alwaysOnTop: false,
      notificationsEnabled: true,
    });

    expect(dto.alwaysOnTop).toBe(false);
    expect(dto.notificationsEnabled).toBe(true);
  });
});
