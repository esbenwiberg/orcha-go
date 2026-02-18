import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const STORE_DIR =
  process.env.STORE_DIR ||
  path.join(process.env.HOME || "/home/node", ".orcha-go");
const TOKEN_FILE = path.join(STORE_DIR, "token.enc");

/** Derive a 32-byte key from the ENCRYPTION_KEY env var. */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  // SHA-256 hash to guarantee exactly 32 bytes regardless of input length
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Store a GitHub PAT encrypted with AES-256-GCM.
 * Format on disk: iv (12 bytes) + authTag (16 bytes) + ciphertext
 */
export function storeToken(token: string): void {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }

  // Write iv + authTag + ciphertext
  const output = Buffer.concat([iv, authTag, encrypted]);
  fs.writeFileSync(TOKEN_FILE, output);
}

/** Retrieve and decrypt the stored token. Returns null if not stored or key missing. */
export function getToken(): string | null {
  if (!fs.existsSync(TOKEN_FILE)) return null;

  let key: Buffer;
  try {
    key = getKey();
  } catch {
    return null; // ENCRYPTION_KEY not set
  }

  const data = fs.readFileSync(TOKEN_FILE);
  if (data.length < 28) return null; // 12 (iv) + 16 (tag) minimum

  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf-8");
  } catch {
    return null; // Decryption failed (wrong key, corrupted file, etc.)
  }
}

/** Check whether an encrypted token file exists. */
export function hasToken(): boolean {
  return fs.existsSync(TOKEN_FILE);
}
