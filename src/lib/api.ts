// Shared API helpers — every fetch carries XTransformPort implicitly (only used for non-3000 services)
// All API calls here use relative paths and Next.js default port 3000.

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText} ${text}`)
  }
  return res.json() as Promise<T>
}