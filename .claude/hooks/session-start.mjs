#!/usr/bin/env node
// SessionStart hook (startup | clear | compact).
// Prints a short orientation that Claude Code adds to Claude's context:
// branch, uncommitted changes, recent commits, and the "Current state"
// section of docs/PROGRESS.md. It must never break a session, so every
// failure is swallowed and the script always exits 0.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MAX_STATE_LINES = 40;

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function currentState(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Current state\s*$/i.test(line));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const section = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return section ? section.split('\n').slice(0, MAX_STATE_LINES).join('\n') : null;
}

const parts = [];

try {
  const branch = git(['branch', '--show-current']);
  if (branch !== null) {
    const status = git(['status', '--porcelain']) ?? '';
    const changed = status.split('\n').filter(Boolean).length;
    parts.push(`Git: branch "${branch || '(detached)'}", ${changed} uncommitted change(s).`);
    const log = git(['log', '--oneline', '-5']);
    if (log) parts.push(`Recent commits:\n${log}`);
  }

  const progressPath = join(root, 'docs', 'PROGRESS.md');
  if (existsSync(progressPath)) {
    const state = currentState(readFileSync(progressPath, 'utf8'));
    if (state) parts.push(`docs/PROGRESS.md, "Current state":\n${state}`);
  }
} catch {
  // Orientation is best-effort.
}

if (parts.length > 0) {
  process.stdout.write(`${parts.join('\n\n')}\n`);
}
process.exit(0);
