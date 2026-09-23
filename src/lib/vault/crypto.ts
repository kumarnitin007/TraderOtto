import { argon2id } from "hash-wasm";
import {
  concatBytes,
  domainAad,
  randomBytes,
  utf8Decode,
  utf8Encode,
  zeroize,
} from "@/lib/vault/encoding";

export const ITEM_PAYLOAD_SCHEMA_VERSION = 1;
export const VAULT_CIPHER_VERSION = 1;
export const VAULT_KEY_VERSION_INITIAL = 1;

export const AES_GCM_NONCE_BYTES = 12;
export const AES_GCM_KEY_BYTES = 32;
export const ARGON2_DERIVED_KEY_BYTES = 32;
export const KDF_SALT_BYTES = 16;

export const DEFAULT_ARGON2_PARAMS = {
  memoryKiB: 65536,
  iterations: 3,
  parallelism: 1,
} as const;

export type Argon2Params = {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
};

const ARGON2_MEMORY_KIB_MIN = 16_384;
const ARGON2_MEMORY_KIB_MAX = 262_144;
const ARGON2_ITERATIONS_MIN = 1;
const ARGON2_ITERATIONS_MAX = 64;
const ARGON2_PARALLELISM_MIN = 1;
const ARGON2_PARALLELISM_MAX = 16;

/** Fixed 32-byte unlock verifier plaintext (never sent to the server). */
export const UNLOCK_VERIFIER_PLAINTEXT = utf8Encode(
  "otto-vault/unlock/v1/verified!!!"
);

if (UNLOCK_VERIFIER_PLAINTEXT.length !== 32) {
  throw new Error("Unlock verifier plaintext must be 32 bytes");
}

export type AesGcmPayload = {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
};

export class VaultCryptoError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "VaultCryptoError";
    this.code = code;
  }
}

export function validateMasterPassword(password: string): void {
  if (password.length < 14 || password.length > 1024) {
    throw new VaultCryptoError(
      "INVALID_PASSWORD",
      "Master password must be between 14 and 1024 characters"
    );
  }
}

export function validateArgon2Params(params: Argon2Params): void {
  const { memoryKiB, iterations, parallelism } = params;
  if (
    !Number.isInteger(memoryKiB) ||
    memoryKiB < ARGON2_MEMORY_KIB_MIN ||
    memoryKiB > ARGON2_MEMORY_KIB_MAX
  ) {
    throw new VaultCryptoError(
      "INVALID_KDF_PARAMS",
      "Argon2 memoryKiB is out of allowed range"
    );
  }
  if (
    !Number.isInteger(iterations) ||
    iterations < ARGON2_ITERATIONS_MIN ||
    iterations > ARGON2_ITERATIONS_MAX
  ) {
    throw new VaultCryptoError(
      "INVALID_KDF_PARAMS",
      "Argon2 iterations is out of allowed range"
    );
  }
  if (
    !Number.isInteger(parallelism) ||
    parallelism < ARGON2_PARALLELISM_MIN ||
    parallelism > ARGON2_PARALLELISM_MAX
  ) {
    throw new VaultCryptoError(
      "INVALID_KDF_PARAMS",
      "Argon2 parallelism is out of allowed range"
    );
  }
  if (memoryKiB < 8 * parallelism) {
    throw new VaultCryptoError(
      "INVALID_KDF_PARAMS",
      "Argon2 memoryKiB must be at least 8 × parallelism"
    );
  }
}

export function vaultWrapKeyAad(userId: string): Uint8Array {
  return domainAad("otto-vault:v1:wrap-key", userId);
}

export function vaultVerifierAad(userId: string): Uint8Array {
  return domainAad("otto-vault:v1:verifier", userId);
}

export function itemPayloadAad(
  userId: string,
  itemId: string,
  schemaVersion: number
): Uint8Array {
  return domainAad(
    "otto-vault:v1:item-payload",
    userId,
    itemId,
    schemaVersion
  );
}

export function historySnapshotAad(
  userId: string,
  itemId: string,
  historyId: string,
  schemaVersion: number
): Uint8Array {
  return domainAad(
    "otto-vault:v1:history-snapshot",
    userId,
    itemId,
    historyId,
    schemaVersion
  );
}

export function tagNameAad(userId: string, tagId: string): Uint8Array {
  return domainAad("otto-vault:v1:tag-name", userId, tagId);
}

export function blindIndexDomainAad(
  domain: string,
  material: string
): Uint8Array {
  return concatBytes(utf8Encode(domain), utf8Encode("\x00"), utf8Encode(material));
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

function assertAesKey(key: Uint8Array): void {
  if (key.length !== AES_GCM_KEY_BYTES) {
    throw new VaultCryptoError("INVALID_KEY", "Expected a 256-bit AES key");
  }
}

/** Copy into an ArrayBuffer-backed view for Web Crypto BufferSource typing. */
function bufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes as Uint8Array<ArrayBuffer>;
  }
  return new Uint8Array(bytes);
}

async function importAesGcmKey(
  keyBytes: Uint8Array,
  extractable: boolean
): Promise<CryptoKey> {
  assertAesKey(keyBytes);
  return crypto.subtle.importKey(
    "raw",
    bufferSource(keyBytes),
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"]
  );
}

export async function deriveKekFromPassword(
  password: string,
  salt: Uint8Array,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<Uint8Array> {
  validateMasterPassword(password);
  validateArgon2Params(params);
  if (salt.length < KDF_SALT_BYTES) {
    throw new VaultCryptoError("INVALID_SALT", "KDF salt is too short");
  }

  const derived = await argon2id({
    password,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKiB,
    hashLength: ARGON2_DERIVED_KEY_BYTES,
    outputType: "binary",
  });

  return derived;
}

export function generateVaultKey(): Uint8Array {
  return randomBytes(AES_GCM_KEY_BYTES);
}

export async function encryptBytes(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array
): Promise<AesGcmPayload> {
  assertAesKey(key);
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const cryptoKey = await importAesGcmKey(key, false);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: bufferSource(nonce),
        additionalData: bufferSource(aad),
        tagLength: 128,
      },
      cryptoKey,
      bufferSource(plaintext)
    )
  );
  return { ciphertext, nonce };
}

export async function decryptBytes(
  key: Uint8Array,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array
): Promise<Uint8Array> {
  assertAesKey(key);
  if (nonce.length !== AES_GCM_NONCE_BYTES) {
    throw new VaultCryptoError("INVALID_NONCE", "AES-GCM nonce must be 12 bytes");
  }
  const cryptoKey = await importAesGcmKey(key, false);
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bufferSource(nonce),
        additionalData: bufferSource(aad),
        tagLength: 128,
      },
      cryptoKey,
      bufferSource(ciphertext)
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new VaultCryptoError("DECRYPT_FAILED", "Decryption failed");
  }
}

async function importHmacSha256Key(keyBytes: Uint8Array): Promise<CryptoKey> {
  assertAesKey(keyBytes);
  return crypto.subtle.importKey(
    "raw",
    bufferSource(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export async function encryptJson(
  key: Uint8Array,
  value: unknown,
  aad: Uint8Array
): Promise<AesGcmPayload> {
  const plaintext = utf8Encode(JSON.stringify(value));
  try {
    return await encryptBytes(key, plaintext, aad);
  } finally {
    zeroize(plaintext);
  }
}

export async function decryptJson<T>(
  key: Uint8Array,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array
): Promise<T> {
  let plaintext: Uint8Array | undefined;
  try {
    plaintext = await decryptBytes(key, ciphertext, nonce, aad);
    return JSON.parse(utf8Decode(plaintext)) as T;
  } catch (error) {
    if (error instanceof VaultCryptoError) {
      throw error;
    }
    throw new VaultCryptoError("DECRYPT_FAILED", "Decryption failed");
  } finally {
    if (plaintext) zeroize(plaintext);
  }
}

/** HMAC-SHA256 blind index (domain and material are public metadata). */
export async function blindIndex(
  vaultKey: Uint8Array,
  domain: string,
  material: string
): Promise<Uint8Array> {
  const message = blindIndexDomainAad(domain, material);
  const cryptoKey = await importHmacSha256Key(vaultKey);
  const mac = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    bufferSource(message)
  );
  return new Uint8Array(mac);
}

export async function wrapVaultKey(
  kek: Uint8Array,
  vaultKey: Uint8Array,
  userId: string
): Promise<AesGcmPayload> {
  const aad = vaultWrapKeyAad(userId);
  return encryptBytes(kek, vaultKey, aad);
}

export async function unwrapVaultKey(
  kek: Uint8Array,
  wrapped: Uint8Array,
  wrapNonce: Uint8Array,
  userId: string
): Promise<Uint8Array> {
  const aad = vaultWrapKeyAad(userId);
  return decryptBytes(kek, wrapped, wrapNonce, aad);
}

export async function encryptUnlockVerifier(
  vaultKey: Uint8Array,
  userId: string
): Promise<AesGcmPayload> {
  const aad = vaultVerifierAad(userId);
  return encryptBytes(vaultKey, UNLOCK_VERIFIER_PLAINTEXT, aad);
}

export async function verifyUnlockVerifier(
  vaultKey: Uint8Array,
  encryptedVerifier: Uint8Array,
  verifierNonce: Uint8Array,
  userId: string
): Promise<boolean> {
  const aad = vaultVerifierAad(userId);
  let plaintext: Uint8Array | undefined;
  try {
    plaintext = await decryptBytes(
      vaultKey,
      encryptedVerifier,
      verifierNonce,
      aad
    );
    return constantTimeEqual(plaintext, UNLOCK_VERIFIER_PLAINTEXT);
  } catch {
    return false;
  } finally {
    if (plaintext) zeroize(plaintext);
  }
}

export async function unlockVaultKeyMaterial(
  password: string,
  salt: Uint8Array,
  params: Argon2Params,
  wrappedVaultKey: Uint8Array,
  wrapNonce: Uint8Array,
  encryptedVerifier: Uint8Array,
  verifierNonce: Uint8Array,
  userId: string
): Promise<Uint8Array> {
  validateMasterPassword(password);
  const kek = await deriveKekFromPassword(password, salt, params);
  let vaultKey: Uint8Array | undefined;
  try {
    try {
      vaultKey = await unwrapVaultKey(
        kek,
        wrappedVaultKey,
        wrapNonce,
        userId
      );
    } catch {
      throw new VaultCryptoError("UNLOCK_FAILED", "Unable to unlock vault");
    }
    const ok = await verifyUnlockVerifier(
      vaultKey,
      encryptedVerifier,
      verifierNonce,
      userId
    );
    if (!ok) {
      zeroize(vaultKey);
      throw new VaultCryptoError("UNLOCK_FAILED", "Unable to unlock vault");
    }
    return vaultKey;
  } catch (error) {
    if (error instanceof VaultCryptoError) {
      throw error;
    }
    throw new VaultCryptoError("UNLOCK_FAILED", "Unable to unlock vault");
  } finally {
    zeroize(kek);
  }
}

export async function createVaultKeyEnvelope(
  password: string,
  userId: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<{
  vaultKey: Uint8Array;
  salt: Uint8Array;
  kdfParams: Argon2Params;
  wrappedVaultKey: Uint8Array;
  wrapNonce: Uint8Array;
  encryptedVerifier: Uint8Array;
  verifierNonce: Uint8Array;
}> {
  validateMasterPassword(password);
  validateArgon2Params(params);

  const salt = randomBytes(KDF_SALT_BYTES);
  const vaultKey = generateVaultKey();
  const kek = await deriveKekFromPassword(password, salt, params);

  try {
    const wrapped = await wrapVaultKey(kek, vaultKey, userId);
    const verifier = await encryptUnlockVerifier(vaultKey, userId);
    return {
      vaultKey,
      salt,
      kdfParams: { ...params },
      wrappedVaultKey: wrapped.ciphertext,
      wrapNonce: wrapped.nonce,
      encryptedVerifier: verifier.ciphertext,
      verifierNonce: verifier.nonce,
    };
  } finally {
    zeroize(kek);
  }
}

export async function rewrapVaultKeyForPasswordChange(
  vaultKey: Uint8Array,
  newPassword: string,
  userId: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<{
  salt: Uint8Array;
  kdfParams: Argon2Params;
  wrappedVaultKey: Uint8Array;
  wrapNonce: Uint8Array;
  encryptedVerifier: Uint8Array;
  verifierNonce: Uint8Array;
}> {
  validateMasterPassword(newPassword);
  validateArgon2Params(params);

  const salt = randomBytes(KDF_SALT_BYTES);
  const kek = await deriveKekFromPassword(newPassword, salt, params);
  try {
    const wrapped = await wrapVaultKey(kek, vaultKey, userId);
    const verifier = await encryptUnlockVerifier(vaultKey, userId);
    return {
      salt,
      kdfParams: { ...params },
      wrappedVaultKey: wrapped.ciphertext,
      wrapNonce: wrapped.nonce,
      encryptedVerifier: verifier.ciphertext,
      verifierNonce: verifier.nonce,
    };
  } finally {
    zeroize(kek);
  }
}
