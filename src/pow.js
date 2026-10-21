// Real proof-of-work. An elimination is not granted by a random countdown — the
// attacking agent must find a nonce whose SHA-256 hash (over a per-challenge
// prefix) begins with `difficulty` hex zeros. That is genuine, verifiable work:
// expected ~16^difficulty hashes, and anyone can re-check a claimed solution in
// one hash. Difficulty rises as the population shrinks, so late eliminations
// cost more than early ones.

import { createHash, randomBytes } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function makeChallenge(difficulty) {
  return {
    prefix: randomBytes(8).toString("hex"),
    difficulty,
    attempts: 0, // doubles as the next nonce to try
    solution: null, // { nonce, hash } once found
  };
}

// Verify a claimed solution — cheap, one hash. This is what makes it "proof".
export function verify(challenge, nonce) {
  const hash = sha256(`${challenge.prefix}:${nonce}`);
  return hash.startsWith("0".repeat(challenge.difficulty)) ? hash : null;
}

// Do up to `budget` hashes of work this tick. Returns true if solved.
export function work(challenge, budget) {
  const target = "0".repeat(challenge.difficulty);
  for (let i = 0; i < budget; i++) {
    const nonce = challenge.attempts;
    const hash = sha256(`${challenge.prefix}:${nonce}`);
    challenge.attempts++;
    if (hash.startsWith(target)) {
      challenge.solution = { nonce, hash };
      return true;
    }
  }
  return false;
}

// Rough progress for display: attempts done vs. expected attempts (16^difficulty).
export function progress(challenge) {
  if (challenge.solution) return 100;
  const expected = Math.pow(16, challenge.difficulty);
  return Math.min(99, Math.floor((challenge.attempts / expected) * 100));
}
