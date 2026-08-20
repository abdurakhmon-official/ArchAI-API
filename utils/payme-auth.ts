/**
 * Payme Basic-auth tekshiruvi.
 *
 * Payme `Authorization: Basic base64(Paycom:<kalit>)` yuboradi. Login
 * qat'iy `Paycom` bo'lishi shart — spetsifikatsiya shunday, o'zgartirib
 * bo'lmaydi.
 */
function verifyPaymeAuth(header: string | undefined, secretKey: string): boolean {
  if (!secretKey) return false;

  const token = (header ?? '').replace(/^Basic\s+/i, '');
  const decoded = Buffer.from(token, 'base64').toString('utf8');
  const [login, key] = decoded.split(':');

  return login === 'Paycom' && key === secretKey;
}

export { verifyPaymeAuth };
