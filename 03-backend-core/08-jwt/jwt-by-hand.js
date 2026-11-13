// A JWT built by hand, so you can see there's no magic. Run: node jwt-by-hand.js
const crypto = require("node:crypto");

const SECRET = "only-the-server-knows-this";

// base64url = base64 made safe for URLs and headers (no + / =)
const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const decode = (str) => JSON.parse(Buffer.from(str, "base64url").toString());
const sign = (data) => crypto.createHmac("sha256", SECRET).update(data).digest("base64url");

function makeToken(payload) {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

function verifyToken(token) {
  const [header, body, signature] = token.split(".");
  const expected = sign(`${header}.${body}`);
  // timingSafeEqual: compare without leaking how many characters matched
  const same =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!same) throw new Error("signature doesn't match: token was changed or forged");

  const payload = decode(body);
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error("token expired");
  return payload;
}

// ---------- 1. Make a token ----------
const token = makeToken({ sub: 1, email: "asha@example.com", exp: Math.floor(Date.now() / 1000) + 900 });
console.log("1. The token (3 parts joined by dots):\n" + token + "\n");

// ---------- 2. Anyone can read it ----------
const [h, b] = token.split(".");
console.log("2. Anyone can decode the first two parts, no secret needed:");
console.log("   header: ", decode(h));
console.log("   payload:", decode(b), "\n");

// ---------- 3. The server checks it ----------
console.log("3. Server verifies the real token:", verifyToken(token), "\n");

// ---------- 4. Tampering ----------
const evilBody = encode({ ...decode(b), sub: 2, email: "ravi@example.com" });
const tampered = `${h}.${evilBody}.${token.split(".")[2]}`;
console.log("4. Attacker changes sub 1 -> 2 but keeps the old signature:");
try {
  verifyToken(tampered);
} catch (e) {
  console.log("   rejected:", e.message, "\n");
}

// ---------- 5. Expired ----------
const old = makeToken({ sub: 1, exp: Math.floor(Date.now() / 1000) - 60 });
console.log("5. A token that expired a minute ago:");
try {
  verifyToken(old);
} catch (e) {
  console.log("   rejected:", e.message);
}
