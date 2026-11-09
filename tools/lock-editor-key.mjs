// Locks a GitHub editing key behind a password, so people can sign in to the
// on-page editor by typing a password instead of handling a key.
//
//   node tools/lock-editor-key.mjs
//
// It asks for the key and a password, scrambles the key (AES-GCM, key derived
// from the password with PBKDF2) and saves ONLY the scrambled version into
// redesign/public/editor/settings.json. The real key is never written to disk.
//
// The scrambled key is public, because the site's code is public, so anyone
// could try guesses at the password offline. Use a long phrase.

import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

// LOCK_TOKEN, LOCK_PASSWORD and LOCK_OUT exist only so the script can be tested
// without a keyboard; normal use asks the questions.
const SETTINGS = process.env.LOCK_OUT || fileURLToPath(new URL('../redesign/public/editor/settings.json', import.meta.url));
const ITERATIONS = 600_000;
const MIN_PASSWORD = 16;

// Reads a line without showing what is typed.
function ask(question) {
  if (process.env.LOCK_TOKEN) return Promise.resolve(question.startsWith('Paste') ? process.env.LOCK_TOKEN : process.env.LOCK_PASSWORD);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

const settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));

if (process.argv.includes('--remove')) {
  delete settings.lockedKey;
  writeFileSync(SETTINGS, `${JSON.stringify(settings, null, 2)}\n`);
  console.log('Removed the password key. People sign in by pasting a key again.');
  process.exit(0);
}

const token = await ask('Paste the GitHub key (nothing will show as you paste): ');
if (!/^(ghp_|github_pat_|gho_)/.test(token)) {
  console.error('That does not look like a GitHub key. It should start with ghp_ or github_pat_.');
  process.exit(1);
}
const password = await ask(`Choose a password, at least ${MIN_PASSWORD} characters (a few random words works well): `);
if (password.length < MIN_PASSWORD) {
  console.error(`The password must be at least ${MIN_PASSWORD} characters. Nothing was saved.`);
  process.exit(1);
}
if (password !== await ask('Type the password again: ')) {
  console.error('The two passwords did not match. Nothing was saved.');
  process.exit(1);
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));

settings.lockedKey = { iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data)) };
writeFileSync(SETTINGS, `${JSON.stringify(settings, null, 2)}\n`);
console.log('\nSaved. Now commit and push redesign/public/editor/settings.json.');
console.log('Anyone who knows the password can edit the site. To turn it off, delete the key on GitHub.');
