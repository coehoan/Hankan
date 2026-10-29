import 'server-only';
import { AppError } from '@/lib/errors';
import { parseAuthInput } from './validation';
import { usernameToEmail } from './identity';
export type PasswordDirectory = {
  list(page: number): Promise<{ users: { id: string; email?: string }[]; hasMore: boolean }>;
  setPassword(userId: string, password: string): Promise<void>;
  revokeSessions(email: string, password: string): Promise<void>;
};
export async function resetAccountPassword(
  username: string,
  password: string,
  confirmPassword: string,
  directory: PasswordDirectory,
): Promise<void> {
  const input = parseAuthInput('update-password', { password, confirmPassword });
  if (input.action !== 'update-password') return;
  const email = usernameToEmail(username);
  let page = 1;
  while (true) {
    const result = await directory.list(page);
    const target = result.users.find((user) => user.email === email);
    if (target) {
      await directory.setPassword(target.id, input.password);
      await directory.revokeSessions(email, input.password);
      return;
    }
    if (!result.hasMore) throw new AppError('not_found', '해당 아이디를 찾을 수 없어요.');
    page++;
  }
}
