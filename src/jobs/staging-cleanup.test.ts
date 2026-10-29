import { expect, it } from 'vitest';
import { expiredStagedPaths } from './staging-cleanup';
it('staging_cleanup_preserves_the_entire_upload_token_window', () => {
  expect(
    expiredStagedPaths(
      [
        { name: 'old', created_at: '2026-10-28T00:00:00Z' },
        { name: 'boundary', created_at: '2026-10-28T00:05:00Z' },
        { name: 'recent', created_at: '2026-10-28T02:00:00Z' },
        { name: 'future', created_at: '2026-10-29T00:00:00Z' },
        { name: 'unknown', created_at: null },
      ],
      '2026-10-28T02:10:00Z',
    ),
  ).toEqual(['old']);
});
