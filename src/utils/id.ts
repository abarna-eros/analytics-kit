/** Pseudonymous id generation. No personal data is ever derived from the user. */

function getCrypto(): Crypto | undefined {
  return typeof globalThis !== 'undefined' &&
    typeof (globalThis as { crypto?: Crypto }).crypto !== 'undefined'
    ? globalThis.crypto
    : undefined;
}

/** RFC 4122 v4 identifier, using `crypto` when available. */
export function generateId(): string {
  const cryptoApi = getCrypto();

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    // Set the version (4) and variant (RFC 4122) bits.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort for exotic runtimes; still unique enough for a client-side id.
  const random = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${random()}${random()}-${random()}-4${random().slice(1)}-a${random().slice(1)}-${random()}${random()}${random()}`;
}

/** Short, non-cryptographic id used for queue entries. */
export function generateShortId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
