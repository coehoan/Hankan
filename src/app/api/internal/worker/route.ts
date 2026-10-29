import { timingSafeEqual } from 'node:crypto';
import { runCycle } from '@/jobs/worker';
export const maxDuration = 300;
const reply = (status: number) =>
  Response.json(
    { ok: status === 200 },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  );
export async function POST(request: Request) {
  const secret = process.env.WORKER_SECRET;
  if (!secret || secret.length < 32) return reply(503);
  const actual = Buffer.from(request.headers.get('authorization') ?? ''),
    expected = Buffer.from('Bearer ' + secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reply(401);
  try {
    await runCycle();
    return reply(200);
  } catch {
    return reply(503);
  }
}
