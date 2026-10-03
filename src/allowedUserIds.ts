const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export function parseAllowedUserIds(env: NodeJS.ProcessEnv = process.env): ReadonlySet<number> {
  const raw = env.ALLOWED_USER_IDS;
  const ids = new Set<number>();
  if (!raw) return ids;
  for (const part of raw.split(",")) {
    const item = part.trim();
    if (!item || !/^[0-9]+$/.test(item)) continue;
    const id = BigInt(item);
    if (id > MAX_SAFE) continue;
    ids.add(Number(id));
  }
  return ids;
}
