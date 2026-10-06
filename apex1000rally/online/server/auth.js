const encoder = new TextEncoder();
const hex = (bytes) =>
  Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
const unhex = (text) =>
  Uint8Array.from(text.match(/../g) || [], (x) => parseInt(x, 16));
export const randomToken = () =>
  hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}
export async function passwordHash(password, pepper, salt = randomToken()) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw Error("La clave debe tener entre 12 y 128 caracteres.");
  if (typeof pepper !== "string" || pepper.length < 32)
    throw Error("AUTH_PEPPER no configurado.");
  const pepperKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const input = await crypto.subtle.sign(
    "HMAC",
    pepperKey,
    encoder.encode(password),
  );
  const key = await crypto.subtle.importKey("raw", input, "PBKDF2", false, [
    "deriveBits",
  ]);
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: unhex(salt), iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2-sha256$100000$${salt}$${hex(result)}`;
}
export async function verifyPassword(password, stored, pepper) {
  if (
    typeof stored !== "string" ||
    !/^pbkdf2-sha256\$100000\$[a-f0-9]{64}\$[a-f0-9]{64}$/.test(stored)
  )
    return false;
  const computed = await passwordHash(password, pepper, stored.split("$")[2]);
  let different = 0;
  for (let i = 0; i < stored.length; i++)
    different |= stored.charCodeAt(i) ^ computed.charCodeAt(i);
  return different === 0;
}
export function cookie(request, token = "", age = 0) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `apex_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
}
export async function session(request, db, now) {
  const token = request.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)apex_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;
  return db
    .prepare(
      "SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    )
    .bind(await digest(token), now)
    .first();
}
export async function limitAuth(request, db, now) {
  const ip = request.headers.get("CF-Connecting-IP") || "local",
    span = 15 * 60000;
  const key = await digest(`${ip}/${Math.floor(now / span)}`);
  const row = await db
    .prepare(
      "INSERT INTO auth_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(key, now + span)
    .first();
  if (row.count > 12) {
    const e = Error("Demasiados intentos. Esperá 15 minutos.");
    e.status = 429;
    throw e;
  }
}
