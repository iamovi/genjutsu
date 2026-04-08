// App Lock — PIN hashing utilities
// Uses Web Crypto API (SHA-256) so the plaintext PIN never touches localStorage.

export const APP_LOCK_HASH_KEY = "genjutsu-app-lock-hash";
export const APP_LOCK_SESSION_KEY = "genjutsu-app-unlocked";

export const APP_LOCK_Q1_KEY = "genjutsu-app-lock-q1";
export const APP_LOCK_Q2_KEY = "genjutsu-app-lock-q2";
export const APP_LOCK_A1_HASH_KEY = "genjutsu-app-lock-a1-hash";
export const APP_LOCK_A2_HASH_KEY = "genjutsu-app-lock-a2-hash";

export const PREDEFINED_QUESTIONS = [
    "What was the name of your first pet?",
    "In what city were you born?",
    "What is your favorite movie?",
    "What was the name of your first school?",
    "What is your favorite food?",
];

export const formatAnswer = (answer: string) => answer.trim().toLowerCase();

/**
 * Hash a numeric PIN string using SHA-256.
 * Returns a lowercase hex digest.
 */
export async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a PIN against a stored SHA-256 hash.
 */
export async function verifyPin(
    pin: string,
    storedHash: string
): Promise<boolean> {
    const inputHash = await hashPin(pin);
    return inputHash === storedHash;
}
