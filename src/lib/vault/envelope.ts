import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_ARGON2_PARAMS,
  VAULT_CIPHER_VERSION,
  VAULT_KEY_VERSION_INITIAL,
  createVaultKeyEnvelope,
  rewrapVaultKeyForPasswordChange,
  unlockVaultKeyMaterial,
  validateMasterPassword,
  VaultCryptoError,
  type Argon2Params,
} from "@/lib/vault/crypto";
import { byteaFromDb, byteaToDb, zeroize } from "@/lib/vault/encoding";

export type VaultEnvelopeRow = {
  userId: string;
  kdfAlgorithm: "argon2id";
  kdfSalt: Uint8Array;
  kdfParams: Argon2Params;
  wrappedVaultKey: Uint8Array;
  wrapNonce: Uint8Array;
  encryptedVerifier: Uint8Array;
  verifierNonce: Uint8Array;
  keyVersion: number;
  cipherVersion: number;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type VaultCryptoSession = {
  userId: string;
  keyVersion: number;
  cipherVersion: number;
  /** In-memory vault key; never persist or log. */
  readonly vaultKey: Uint8Array;
  destroy(): void;
};

export type VaultEnvelopeErrorCode =
  | "VAULT_NOT_FOUND"
  | "VAULT_ALREADY_EXISTS"
  | "UNLOCK_FAILED"
  | "INVALID_PASSWORD"
  | "INVALID_KDF_PARAMS"
  | "DATABASE_ERROR"
  | "NOT_AUTHENTICATED";

export type VaultEnvelopeError = {
  code: VaultEnvelopeErrorCode;
  message: string;
};

export type VaultEnvelopeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VaultEnvelopeError };

type OvVaultsDbRow = {
  user_id: string;
  kdf_algorithm: string;
  kdf_salt: unknown;
  kdf_params: Argon2Params;
  wrapped_vault_key: unknown;
  wrap_nonce: unknown;
  encrypted_verifier: unknown;
  verifier_nonce: unknown;
  key_version: number;
  cipher_version: number;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function err(
  code: VaultEnvelopeErrorCode,
  message: string
): VaultEnvelopeResult<never> {
  return { ok: false, error: { code, message } };
}

function mapRow(row: OvVaultsDbRow): VaultEnvelopeRow {
  return {
    userId: row.user_id,
    kdfAlgorithm: "argon2id",
    kdfSalt: byteaFromDb(row.kdf_salt),
    kdfParams: row.kdf_params,
    wrappedVaultKey: byteaFromDb(row.wrapped_vault_key),
    wrapNonce: byteaFromDb(row.wrap_nonce),
    encryptedVerifier: byteaFromDb(row.encrypted_verifier),
    verifierNonce: byteaFromDb(row.verifier_nonce),
    keyVersion: row.key_version,
    cipherVersion: row.cipher_version,
    settings: row.settings ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDbUpdate(
  envelope: Pick<
    VaultEnvelopeRow,
    | "kdfSalt"
    | "kdfParams"
    | "wrappedVaultKey"
    | "wrapNonce"
    | "encryptedVerifier"
    | "verifierNonce"
    | "keyVersion"
    | "cipherVersion"
  >
) {
  return {
    kdf_salt: byteaToDb(envelope.kdfSalt),
    kdf_params: envelope.kdfParams,
    wrapped_vault_key: byteaToDb(envelope.wrappedVaultKey),
    wrap_nonce: byteaToDb(envelope.wrapNonce),
    encrypted_verifier: byteaToDb(envelope.encryptedVerifier),
    verifier_nonce: byteaToDb(envelope.verifierNonce),
    key_version: envelope.keyVersion,
    cipher_version: envelope.cipherVersion,
  };
}

function createSession(
  userId: string,
  vaultKey: Uint8Array,
  keyVersion: number,
  cipherVersion: number
): VaultCryptoSession {
  const keyCopy = vaultKey.slice();
  zeroize(vaultKey);
  return {
    userId,
    keyVersion,
    cipherVersion,
    vaultKey: keyCopy,
    destroy() {
      zeroize(keyCopy);
    },
  };
}

export async function fetchVaultEnvelope(
  supabase: SupabaseClient,
  userId: string
): Promise<VaultEnvelopeResult<VaultEnvelopeRow>> {
  const { data, error } = await supabase
    .from("ov_vaults")
    .select(
      "user_id, kdf_algorithm, kdf_salt, kdf_params, wrapped_vault_key, wrap_nonce, encrypted_verifier, verifier_nonce, key_version, cipher_version, settings, created_at, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return err("DATABASE_ERROR", error.message);
  }
  if (!data) {
    return err("VAULT_NOT_FOUND", "Vault envelope was not found");
  }
  const row = data as OvVaultsDbRow;
  if (row.kdf_algorithm !== "argon2id") {
    return err("DATABASE_ERROR", "Unsupported vault KDF algorithm");
  }
  try {
    return { ok: true, data: mapRow(row) };
  } catch {
    return err("DATABASE_ERROR", "Vault envelope bytea fields are invalid");
  }
}

export async function createVaultEnvelopeForUser(
  supabase: SupabaseClient,
  userId: string,
  masterPassword: string,
  kdfParams: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<VaultEnvelopeResult<VaultEnvelopeRow>> {
  try {
    validateMasterPassword(masterPassword);
  } catch {
    return err("INVALID_PASSWORD", "Master password must not be empty");
  }

  const existing = await fetchVaultEnvelope(supabase, userId);
  if (existing.ok) {
    return err("VAULT_ALREADY_EXISTS", "Vault envelope already exists");
  }
  if (existing.error.code !== "VAULT_NOT_FOUND") {
    return existing;
  }

  let material: Awaited<ReturnType<typeof createVaultKeyEnvelope>> | undefined;
  try {
    material = await createVaultKeyEnvelope(masterPassword, userId, kdfParams);
  } catch (e) {
    if (e instanceof VaultCryptoError) {
      if (e.code === "INVALID_KDF_PARAMS") {
        return err("INVALID_KDF_PARAMS", e.message);
      }
      if (e.code === "INVALID_PASSWORD") {
        return err("INVALID_PASSWORD", e.message);
      }
    }
    return err("INVALID_PASSWORD", "Unable to create vault envelope");
  }

  const insertRow = {
    user_id: userId,
    kdf_algorithm: "argon2id" as const,
    ...rowToDbUpdate({
      kdfSalt: material.salt,
      kdfParams: material.kdfParams,
      wrappedVaultKey: material.wrappedVaultKey,
      wrapNonce: material.wrapNonce,
      encryptedVerifier: material.encryptedVerifier,
      verifierNonce: material.verifierNonce,
      keyVersion: VAULT_KEY_VERSION_INITIAL,
      cipherVersion: VAULT_CIPHER_VERSION,
    }),
    settings: {},
  };

  let data: unknown = null;
  let error: { message: string } | null = null;
  try {
    const response = await supabase
      .from("ov_vaults")
      .insert(insertRow)
      .select(
        "user_id, kdf_algorithm, kdf_salt, kdf_params, wrapped_vault_key, wrap_nonce, encrypted_verifier, verifier_nonce, key_version, cipher_version, settings, created_at, updated_at"
      )
      .single();
    data = response.data;
    error = response.error;
  } finally {
    zeroize(material.vaultKey);
  }

  if (error) {
    return err("DATABASE_ERROR", error.message);
  }

  try {
    return { ok: true, data: mapRow(data as OvVaultsDbRow) };
  } catch {
    return err("DATABASE_ERROR", "Created vault row has invalid bytea fields");
  }
}

export async function unlockVaultEnvelope(
  supabase: SupabaseClient,
  userId: string,
  masterPassword: string
): Promise<VaultEnvelopeResult<VaultCryptoSession>> {
  const envelopeResult = await fetchVaultEnvelope(supabase, userId);
  if (!envelopeResult.ok) {
    if (envelopeResult.error.code === "VAULT_NOT_FOUND") {
      return err("UNLOCK_FAILED", "Unable to unlock vault");
    }
    return envelopeResult;
  }
  const envelope = envelopeResult.data;
  if (envelope.cipherVersion !== VAULT_CIPHER_VERSION) {
    return err("DATABASE_ERROR", "Unsupported vault cipher version");
  }

  let vaultKey: Uint8Array | undefined;
  try {
    vaultKey = await unlockVaultKeyMaterial(
      masterPassword,
      envelope.kdfSalt,
      envelope.kdfParams,
      envelope.wrappedVaultKey,
      envelope.wrapNonce,
      envelope.encryptedVerifier,
      envelope.verifierNonce,
      userId
    );
  } catch {
    return err("UNLOCK_FAILED", "Unable to unlock vault");
  }

  return {
    ok: true,
    data: createSession(
      userId,
      vaultKey,
      envelope.keyVersion,
      envelope.cipherVersion
    ),
  };
}

export async function changeVaultMasterPassword(
  supabase: SupabaseClient,
  session: VaultCryptoSession,
  newMasterPassword: string,
  kdfParams: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<VaultEnvelopeResult<VaultEnvelopeRow>> {
  try {
    validateMasterPassword(newMasterPassword);
  } catch {
    return err("INVALID_PASSWORD", "Master password must not be empty");
  }

  let rewrap: Awaited<ReturnType<typeof rewrapVaultKeyForPasswordChange>>;
  try {
    rewrap = await rewrapVaultKeyForPasswordChange(
      session.vaultKey,
      newMasterPassword,
      session.userId,
      kdfParams
    );
  } catch (e) {
    if (e instanceof VaultCryptoError) {
      if (e.code === "INVALID_KDF_PARAMS") {
        return err("INVALID_KDF_PARAMS", e.message);
      }
      if (e.code === "INVALID_PASSWORD") {
        return err("INVALID_PASSWORD", e.message);
      }
    }
    return err("INVALID_PASSWORD", "Unable to change master password");
  }

  const { data, error } = await supabase
    .from("ov_vaults")
    .update({
      ...rowToDbUpdate({
        kdfSalt: rewrap.salt,
        kdfParams: rewrap.kdfParams,
        wrappedVaultKey: rewrap.wrappedVaultKey,
        wrapNonce: rewrap.wrapNonce,
        encryptedVerifier: rewrap.encryptedVerifier,
        verifierNonce: rewrap.verifierNonce,
        keyVersion: session.keyVersion,
        cipherVersion: session.cipherVersion,
      }),
    })
    .eq("user_id", session.userId)
    .select(
      "user_id, kdf_algorithm, kdf_salt, kdf_params, wrapped_vault_key, wrap_nonce, encrypted_verifier, verifier_nonce, key_version, cipher_version, settings, created_at, updated_at"
    )
    .single();

  if (error) {
    return err("DATABASE_ERROR", error.message);
  }

  try {
    return { ok: true, data: mapRow(data as OvVaultsDbRow) };
  } catch {
    return err("DATABASE_ERROR", "Updated vault row has invalid bytea fields");
  }
}

/** Adapter for {@link createSupabaseVaultRepository} session shape. */
export function toSupabaseVaultSession(session: VaultCryptoSession): {
  vaultKey: Uint8Array;
  keyVersion: number;
} {
  return { vaultKey: session.vaultKey, keyVersion: session.keyVersion };
}
