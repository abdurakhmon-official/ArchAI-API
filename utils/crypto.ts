/**
 * Constant-time string comparison.
 *
 * Used to verify the Click payment signature — a length-dependent
 * short-circuit (`===`) would leak timing information an attacker could
 * use to forge a valid signature byte by byte. Do not "simplify" this
 * back to `===`.
 */
function timingSafeEqual(first: string, second: string): boolean {
  if (first.length !== second.length) return false;

  let diff = 0;
  for (let index = 0; index < first.length; index++) {
    diff |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }

  return diff === 0;
}

export { timingSafeEqual };
