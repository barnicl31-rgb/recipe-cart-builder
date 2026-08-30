const crypto = require("crypto");

const ENVELOPE_VERSION = "v1";

function seal(payload, purpose) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(purpose, "utf8"));

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url")
  ].join(".");
}

function unseal(value, purpose) {
  if (!value || typeof value !== "string") {
    throw new Error("Missing secure session.");
  }

  const parts = value.split(".");
  const [version, encodedIv, encodedCiphertext, encodedTag] = parts;

  if (parts.length !== 4 || version !== ENVELOPE_VERSION || !encodedIv || !encodedCiphertext || !encodedTag) {
    throw new Error("Invalid secure session.");
  }

  try {
    const iv = decodeBase64Url(encodedIv, 12);
    const ciphertext = decodeBase64Url(encodedCiphertext);
    const tag = decodeBase64Url(encodedTag, 16);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      iv
    );
    decipher.setAAD(Buffer.from(purpose, "utf8"));
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return JSON.parse(plaintext.toString("utf8"));
  } catch (error) {
    throw new Error("Secure session could not be verified.");
  }
}

function decodeBase64Url(value, expectedLength) {
  const decoded = Buffer.from(value, "base64url");

  if (decoded.length === 0 || decoded.toString("base64url") !== value) {
    throw new Error("Invalid base64url value.");
  }

  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    throw new Error("Invalid secure session field length.");
  }

  return decoded;
}

function getEncryptionKey() {
  const secret = process.env.SWIGGY_SESSION_SECRET || "";

  if (secret.length < 32) {
    throw new Error("SWIGGY_SESSION_SECRET must contain at least 32 characters.");
  }

  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

function parseCookies(request) {
  const header = request.headers?.cookie || "";

  return header.split(";").reduce((cookies, part) => {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex < 0) {
      return cookies;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (name) {
      cookies[name] = decodeURIComponent(value);
    }

    return cookies;
  }, {});
}

function buildCookie(name, value, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || "/"}`,
    "HttpOnly",
    "Secure",
    `SameSite=${options.sameSite || "Lax"}`
  ];

  if (Number.isFinite(options.maxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  return parts.join("; ");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  buildCookie,
  parseCookies,
  safeEqual,
  seal,
  unseal
};
