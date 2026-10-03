#!/usr/bin/env node
// SessionStart hook (startup): cloud sessions start without node_modules, so
// install them there. A no-op locally. Install output goes to stderr; one line
// on stdout tells Claude whether it worked. Never blocks a session: exits 0.
import { spawnSync } from 'node:child_process';

if (process.env.CLAUDE_CODE_REMOTE !== 'true') process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function run(command) {
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: ['ignore', process.stderr, process.stderr],
    // Two commands must finish inside the hook's 600 s limit, so the FAILED line still prints.
    timeout: 280_000,
  });
  return result.status === 0;
}

if (run('corepack enable') && run('pnpm install --frozen-lockfile')) {
  process.stdout.write('Cloud session: dependencies installed (pnpm install --frozen-lockfile).\n');
} else {
  process.stdout.write(
    'Cloud session: dependency install FAILED — run `corepack enable && pnpm install --frozen-lockfile` and read the error.\n',
  );
}
process.exit(0);
