import { spawnSync } from 'node:child_process';
import { it, expect } from 'vitest';
const args = ['--conditions=react-server', '--import', 'tsx', 'scripts/admin-reset-password.ts'];
it('password_arguments_are_rejected_without_echoing_the_secret', () => {
  const secret = 'DO_NOT_LOG_PASSWORD_123',
    result = spawnSync(process.execPath, [...args, 'testuser', secret], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).not.toContain(secret);
  expect(result.stderr).toContain('사용법');
});
it('malformed_stdin_never_leaks_password_in_parser_errors', () => {
  const secret = 'DO_NOT_LOG_PASSWORD_456',
    result = spawnSync(process.execPath, [...args, 'testuser', '--stdin'], {
      encoding: 'utf8',
      input: '{"password":"' + secret + '",broken}',
    });
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).not.toContain(secret);
  expect(result.stderr).toContain('입력 형식');
});
