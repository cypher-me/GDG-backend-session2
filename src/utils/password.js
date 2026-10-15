// src/utils/password.js
// -------------------------------------------------------------
// Illustrates password HASHING and SALTING with bcrypt.
//
// COMMANDS YOU RUN (from the project root):
//   pnpm add bcrypt                # install the hashing library
//   pnpm exec prisma db push       # if you haven't already: adds password column
//
// Why hash + salt at all?
//   - We must NEVER store the raw password. If the DB leaks, an attacker
//     would get everyone's real passwords.
//   - A plain hash(hash) is still weak to "rainbow tables" — precomputed
//     lookup tables of common passwords and their hashes. If two users have
//     the same password they'd get the SAME hash, which leaks that fact.
//   - SALTING fixes both: bcrypt generates a random per-password SALT,
//     mixes it into the hash, and stores salt+hash together in one string.
//     Identical passwords -> different hashes, and precomputed tables break.
//
// bcrypt does salting AUTOMATICALLY. `bcrypt.hash(password, cost)`:
//   1. generates a fresh random salt,
//   2. hashes salt+password `2^cost` times (default cost 10 = ~2^10 rounds),
//   3. returns ONE combined string like:  $2b$10$<22-char-salt><31-char-hash>
// So you never manage the salt by hand — bcrypt embeds it.
// -------------------------------------------------------------

import bcrypt from "bcrypt";

// The "cost factor" / work factor. Higher = slower = safer (and harder for
// attackers to brute-force), lower = faster. 10-12 is a sensible default.
const SALT_ROUNDS = 10;

// Hash a plaintext password for storage. You call this at REGISTER time.
// (This is a plain function you can read start-to-end to SEE the hashing.)
export async function hashPassword(plainPassword) {
  // bcrypt.hash hashes AND salts in one step — the salt is generated internally.
  // The returned `hash` string ALREADY contains the salt, so we save that.
  const hashed = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  //   hashed  ->  "$2b$10$<random salt><hash>"   <-- store THIS, not the password.
  // You can even read the salt back out if you ever need it:
  //   const salt = hashed.slice(0, 29);
  return hashed;
}

// Compare a plaintext attempt against a stored hash. Called at LOGIN time.
// bcrypt re-derives the hash using the salt that was saved with the stored
// hash, so it can tell if the two match WITHOUT ever seeing the real password.
export async function verifyPassword(plainPassword, storedHash) {
  // `compare` returns true if plainPassword hashes to storedHash.
  const match = await bcrypt.compare(plainPassword, storedHash);
  return match;
}
