import { parseUsername } from './validation';
// Stable internal authentication identifier; no mailbox or message delivery.
export function usernameToEmail(username: string): string {
  return parseUsername(username) + '@accounts.hankan.invalid';
}
