import { type DbHandle, DEFAULT_DATA_DIR, openDb, resetPglite } from './client';

async function migrate(handle: DbHandle): Promise<void> {
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
  await migrate(openDb());
} else if (command === 'reset') {
  if (process.env.DATABASE_URL) {
    console.error('db:reset is local only: unset DATABASE_URL');
    process.exit(1);
  }
  await migrate(resetPglite(DEFAULT_DATA_DIR));
} else {
  console.error(`unknown command "${command ?? ''}": expected migrate or reset`);
  process.exit(1);
}
