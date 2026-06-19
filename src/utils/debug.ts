const enabled = process.env.DEBUG === '1' || process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'test';

export function log(scope: string, msg: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  const ts = new Date().toISOString();
  const extra = data ? ' ' + JSON.stringify(data) : '';
  console.log(`[${ts}] [ScamGuard:${scope}]  ${msg}${extra}`);
}

export function warn(scope: string, msg: string, err?: unknown): void {
  const ts = new Date().toISOString();
  const errStr = err instanceof Error ? `${err.message}` : String(err ?? '');
  console.warn(`[${ts}] [ScamGuard:${scope}] WARN  ${msg}${errStr ? ' — ' + errStr : ''}`);
}

export function error(scope: string, msg: string, err?: unknown): void {
  const ts = new Date().toISOString();
  const errStr = err instanceof Error ? `${err.stack ?? err.message}` : String(err ?? '');
  console.error(`[${ts}] [ScamGuard:${scope}] ERROR ${msg}${errStr ? '\n' + errStr : ''}`);
}
