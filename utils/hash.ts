export { hashOf } from '@/shared/hash';
import { hashOf as sharedHash } from '@/shared/hash';

export function exportHashOf(project: {
  geometry: unknown;
  estimate_total: unknown;
  estimate_selection: unknown;
}): string {
  return sharedHash([
    project.geometry,
    String(project.estimate_total ?? ''),
    project.estimate_selection ?? null,
  ]);
}
