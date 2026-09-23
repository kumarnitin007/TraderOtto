import { describe, expect, it } from "vitest";
import {
  blindIndex,
  createVaultKeyEnvelope,
  decryptJson,
  encryptJson,
  itemPayloadAad,
  rewrapVaultKeyForPasswordChange,
  unlockVaultKeyMaterial,
} from "@/lib/vault/crypto";
import { zeroize } from "@/lib/vault/encoding";

const FAST_TEST_KDF = {
  memoryKiB: 16_384,
  iterations: 1,
  parallelism: 1,
};
const USER_ID = "4b8396b9-b79b-49be-9ad3-a431b487a109";
const PASSWORD = "correct horse battery staple";

describe("Vault cryptography", () => {
  it("encrypts JSON with row-bound authenticated encryption", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const aad = itemPayloadAad(USER_ID, crypto.randomUUID(), 1);
    const secret = { username: "user@example.com", password: "not-plaintext" };
    const encrypted = await encryptJson(key, secret, aad);

    expect(new TextDecoder().decode(encrypted.ciphertext)).not.toContain(
      secret.password
    );
    await expect(
      decryptJson(key, encrypted.ciphertext, encrypted.nonce, aad)
    ).resolves.toEqual(secret);
    await expect(
      decryptJson(
        key,
        encrypted.ciphertext,
        encrypted.nonce,
        itemPayloadAad(USER_ID, crypto.randomUUID(), 1)
      )
    ).rejects.toThrow();
    zeroize(key);
  });

  it("produces deterministic, domain-separated blind indexes", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const first = await blindIndex(key, "item-dedupe", "name\u001euser");
    const second = await blindIndex(key, "item-dedupe", "name\u001euser");
    const otherDomain = await blindIndex(key, "tag-name", "name\u001euser");
    expect(first).toEqual(second);
    expect(first).not.toEqual(otherDomain);
    zeroize(key);
  });

  it("wraps, verifies, unlocks, and rewraps the vault key", async () => {
    const envelope = await createVaultKeyEnvelope(
      PASSWORD,
      USER_ID,
      FAST_TEST_KDF
    );
    const unlocked = await unlockVaultKeyMaterial(
      PASSWORD,
      envelope.salt,
      envelope.kdfParams,
      envelope.wrappedVaultKey,
      envelope.wrapNonce,
      envelope.encryptedVerifier,
      envelope.verifierNonce,
      USER_ID
    );
    expect(unlocked).toEqual(envelope.vaultKey);

    await expect(
      unlockVaultKeyMaterial(
        "this is the wrong password",
        envelope.salt,
        envelope.kdfParams,
        envelope.wrappedVaultKey,
        envelope.wrapNonce,
        envelope.encryptedVerifier,
        envelope.verifierNonce,
        USER_ID
      )
    ).rejects.toMatchObject({ code: "UNLOCK_FAILED" });

    const nextPassword = "another long unique master passphrase";
    const rewrapped = await rewrapVaultKeyForPasswordChange(
      unlocked,
      nextPassword,
      USER_ID,
      FAST_TEST_KDF
    );
    const unlockedAgain = await unlockVaultKeyMaterial(
      nextPassword,
      rewrapped.salt,
      rewrapped.kdfParams,
      rewrapped.wrappedVaultKey,
      rewrapped.wrapNonce,
      rewrapped.encryptedVerifier,
      rewrapped.verifierNonce,
      USER_ID
    );
    expect(unlockedAgain).toEqual(unlocked);

    zeroize(envelope.vaultKey);
    zeroize(unlocked);
    zeroize(unlockedAgain);
  });
});
