export function hashOf(value: unknown): string {
  const json = JSON.stringify(value);
  let hash = 2166136261;

  for (let index = 0; index < json.length; index++) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
