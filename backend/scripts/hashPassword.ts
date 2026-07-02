/* eslint-disable no-console */
import bcrypt from 'bcryptjs';

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: npm run hash -- <password>');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  console.log('\nAdd this to USERS in your .env, as username:hash\n');
  console.log(hash);
  console.log('');
}

main();
