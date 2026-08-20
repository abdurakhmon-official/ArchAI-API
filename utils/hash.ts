export { hashOf } from '@/shared/hash';
import { hashOf as sharedHash } from '@/shared/hash';

export function exportHashOf(project: {
  geometry: unknown;
  estimateTotal: unknown;
  estimateSelection: unknown;
}): string {
  return sharedHash([
    project.geometry,
    String(project.estimateTotal ?? ''),
    project.estimateSelection ?? null,
  ]);
}
