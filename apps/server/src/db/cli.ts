import { rm } from 'node:fs/promises';
import { DEFAULT_DATA_DIR, openDb } from './client';

async function migrate(): Promise<void> {
  const handle = openDb();
  try {
    await handle.migrate();
  } finally {
    await handle.close();
  }
  // Never print the URL: it carries the password.
  console.log(`migrated ${process.env.DATABASE_URL ? 'DATABASE_URL' : DEFAULT_DATA_DIR}`);
}

const [command] = process.argv.slice(2);
if (command === 'migrate') {
  await migrate();
} else if (command === 'reset') {
  if (process.env.DATABASE_URL) {
    console.error('db:reset is local only: unset DATABASE_URL');
    process.exit(1);
  }
  await rm(DEFAULT_DATA_DIR, { recursive: true, force: true });
  await migrate();
} else {
  console.error(`unknown command "${command ?? ''}": expected migrate or reset`);
  process.exit(1);
}
