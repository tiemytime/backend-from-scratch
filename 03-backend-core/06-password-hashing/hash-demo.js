// Why we hash passwords, and why a plain hash isn't enough.
// Run: node hash-demo.js
const crypto = require("crypto");

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

console.log("1. A hash is a fingerprint: same input, same output. Tiny change, totally different output.");
console.log("   hello   ->", sha256("hello"));
console.log("   hello   ->", sha256("hello"));
console.log("   hellp   ->", sha256("hellp"));

console.log("\n2. Problem: two users with the same password get the same hash.");
console.log("   asha  (123456) ->", sha256("123456"));
console.log("   ravi  (123456) ->", sha256("123456"));
console.log("   Attackers keep huge lists of common passwords and their hashes, and just look them up.");

console.log("\n3. Problem: plain hashes are FAST. How many guesses per second on this laptop?");
let count = 0;
const start = Date.now();
while (Date.now() - start < 1000) {
  sha256("guess" + count);
  count++;
}
console.log("   about", count.toLocaleString(), "guesses per second (one CPU core, a GPU does billions)");

console.log("\n4. Fix 1, salt: add random text per user before hashing.");
const saltA = crypto.randomBytes(16).toString("hex");
const saltR = crypto.randomBytes(16).toString("hex");
console.log("   asha  salt", saltA, "->", sha256(saltA + "123456").slice(0, 32) + "...");
console.log("   ravi  salt", saltR, "->", sha256(saltR + "123456").slice(0, 32) + "...");
console.log("   Same password, different hashes. Lookup lists are useless now.");

console.log("\n5. Fix 2, slow on purpose: scrypt (built into Node) with salt.");
const t = Date.now();
const slow = crypto.scryptSync("123456", saltA, 64, { N: 2 ** 15, maxmem: 64 * 1024 * 1024 });
const ms = Date.now() - t;
console.log("   one scrypt hash took", ms + "ms ->", slow.toString("hex").slice(0, 32) + "...");
console.log("   about", Math.round(1000 / ms), "guesses per second instead of", count.toLocaleString());
