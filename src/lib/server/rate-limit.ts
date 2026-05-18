const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length <= limit;
}
