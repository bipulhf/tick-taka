export {};

/**
 * Prints APP_PASSWORD_HASH for .env: a Bun.password hash, base64-encoded because
 * Bun expands `$` signs inside .env files.
 *
 *   bun run hash-password -- "my password"
 */
const password = process.argv[2];
if (!password) {
  console.error('Usage: bun run hash-password -- "your password"');
  process.exit(1);
}
console.log(btoa(await Bun.password.hash(password)));
