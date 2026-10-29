import { expect, it } from 'vitest';
import { localDateAt, nextNotificationAt } from './schedule';
import { urgencyOf } from '@/features/inventory/domain';
const defaults = {
  now: '2026-10-26T00:00:00Z',
  timezone: 'Asia/Seoul',
  localTime: '20:30',
  lastSentLocalDate: null,
};
it.each([
  [{}, '2026-10-26T11:30:00Z'],
  [{ now: '2026-10-26T10:00:00Z', localTime: '18:00' }, '2026-10-27T09:00:00Z'],
  [{ lastSentLocalDate: '2026-10-26' }, '2026-10-27T11:30:00Z'],
  [{ now: '2026-10-26T11:30:00Z' }, '2026-10-27T11:30:00Z'],
  [{ now: '2026-10-26T14:59:00Z', localTime: '00:05' }, '2026-10-26T15:05:00Z'],
  [{ now: '2026-10-26T15:00:00Z', localTime: '00:05' }, '2026-10-26T15:05:00Z'],
  [{ now: '2026-12-31T14:59:30Z', localTime: '00:00' }, '2026-12-31T15:00:00Z'],
  [{ now: '2028-02-28T15:00:00Z', localTime: '09:00' }, '2028-02-29T00:00:00Z'],
  [{ timezone: 'Asia/Kathmandu', localTime: '09:00' }, '2026-10-26T03:15:00Z'],
  [
    { now: '2026-03-08T05:00:00Z', timezone: 'America/New_York', localTime: '02:30' },
    '2026-03-08T07:30:00Z',
  ],
  [
    { now: '2026-11-01T04:00:00Z', timezone: 'America/New_York', localTime: '01:30' },
    '2026-11-01T06:30:00Z',
  ],
])('computes_next_utc_notification %j', (patch, want) =>
  expect(nextNotificationAt({ ...defaults, ...patch })).toBe(want),
);
it.each(['24:00', '09:60', '9:00', '12:30:00', '-1:00', '20:30 ', ''])(
  'rejects_invalid_local_time %s',
  (localTime) => expect(() => nextNotificationAt({ ...defaults, localTime })).toThrow(),
);
it.each(['Not/AZone', '', '+09:00'])('rejects_invalid_timezone %s', (timezone) =>
  expect(() => nextNotificationAt({ ...defaults, timezone })).toThrow(),
);
it.each([{ now: 'bad' }, { now: '2026-10-26T00:00:00' }, { lastSentLocalDate: '2026-02-30' }])(
  'rejects_invalid_schedule_data %j',
  (patch) => expect(() => nextNotificationAt({ ...defaults, ...patch })).toThrow(),
);
it('uses_users_day_at_midnight_for_today_three_and_four_day_expiry', () => {
  expect(localDateAt('2026-10-26T14:59:59Z', 'Asia/Seoul')).toBe('2026-10-26');
  const today = localDateAt('2026-10-26T15:00:00Z', 'Asia/Seoul');
  expect(today).toBe('2026-10-27');
  expect(urgencyOf('2026-10-27', today)).toBe('soon');
  expect(urgencyOf('2026-10-30', today)).toBe('soon');
  expect(urgencyOf('2026-10-31', today)).toBe('normal');
});
