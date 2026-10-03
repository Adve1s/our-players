#!/usr/bin/env node
// Placeholder for root scripts that a later session implements, so every
// command in CLAUDE.md exists from S00 on and says where it comes from.
const [command = '?', session = '?'] = process.argv.slice(2);
console.error(
  `pnpm ${command} is not implemented yet — it arrives in session ${session} (docs/SESSIONS.md).`,
);
process.exit(1);
