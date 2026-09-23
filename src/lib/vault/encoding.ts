const HEX = "0123456789abcdef";

/** UTF-8 encode (browser TextEncoder). */
export function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/** UTF-8 decode. */
export function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Concatenate byte arrays into a new buffer. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** CSPRNG bytes (Web Crypto). */
export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError("randomBytes length must be a non-negative integer");
  }
  const out = new Uint8Array(length);
  if (length > 0) {
    crypto.getRandomValues(out);
  }
  return out;
}

/** Overwrite sensitive bytes in place (best-effort in JS). */
export function zeroize(bytes: Uint8Array): void {
  bytes.fill(0);
}

export function bytesToHex(bytes: Uint8Array): string {
  const chars = new Array<string>(bytes.length * 2);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    chars[i * 2] = HEX[b >> 4]!;
    chars[i * 2 + 1] = HEX[b & 0x0f]!;
  }
  return chars.join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim();
  if (normalized.length % 2 !== 0) {
    throw new Error("Invalid hex string length");
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = normalized.slice(i * 2, i * 2 + 2);
    const value = Number.parseInt(byte, 16);
    if (Number.isNaN(value)) {
      throw new Error("Invalid hex string");
    }
    out[i] = value;
  }
  return out;
}

/** Standard base64 (no padding optional on decode). */
export function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function base64Decode(encoded: string): Uint8Array {
  const normalized = encoded.replace(/\s/g, "");
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** Domain-separated AAD as UTF-8 bytes (unit separator between segments). */
export function domainAad(domain: string, ...segments: (string | number)[]): Uint8Array {
  return utf8Encode([domain, ...segments.map(String)].join("\x1f"));
}

/** PostgREST / Supabase bytea wire format: \\x + hex. */
export function byteaToDb(bytes: Uint8Array): string {
  return `\\x${bytesToHex(bytes)}`;
}

function decodeHexBytea(value: string): Uint8Array {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("\\x")
    ? trimmed.slice(2)
    : trimmed.startsWith("0x")
      ? trimmed.slice(2)
      : trimmed;
  if (!hex.length) return new Uint8Array(0);
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Unsupported bytea hex encoding");
  }
  return hexToBytes(hex);
}

function looksLikeBase64(value: string): boolean {
  const v = value.trim();
  return /^[A-Za-z0-9+/=_-]+$/.test(v) && v.length >= 4;
}

/**
 * Map Supabase/PostgREST bytea fields to Uint8Array.
 * Accepts \\x hex, 0x hex, raw hex, base64, buffers, and JSON number arrays.
 */
export function byteaFromDb(value: unknown): Uint8Array {
  if (value == null) {
    throw new Error("bytea value is null");
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === "string") {
    if (value.startsWith("\\x") || value.startsWith("0x")) {
      return decodeHexBytea(value);
    }
    if (/^[0-9a-fA-F]+$/.test(value.trim()) && value.trim().length % 2 === 0) {
      return hexToBytes(value.trim());
    }
    if (looksLikeBase64(value)) {
      try {
        return base64Decode(value);
      } catch {
        throw new Error("Unsupported bytea string encoding");
      }
    }
    throw new Error("Unsupported bytea string encoding");
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }
  throw new Error("Unsupported bytea value type");
}
