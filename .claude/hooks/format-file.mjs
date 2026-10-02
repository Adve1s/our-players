#!/usr/bin/env node
// PostToolUse hook (Edit|Write): formats the file Claude just edited with Biome.
// Silent and never blocking: skips files Biome doesn't handle, recorded fixtures,
// generated folders and anything outside the project, and does nothing until
// Biome is installed (S00). Always exits 0.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const FORMATTABLE = new Set([
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.jsonc', '.css',
]);
const SKIP = /(^|[\\/])(node_modules|fixtures|\.data|\.expo|\.screenshots|dist|\.git)([\\/]|$)/;

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }

  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== 'string' || filePath === '') return;

  const absolute = isAbsolute(filePath) ? filePath : resolve(root, filePath);
  const rel = relative(root, absolute);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return; // outside the project
  if (SKIP.test(rel)) return;
  if (!FORMATTABLE.has(extname(absolute).toLowerCase())) return;
  if (!existsSync(absolute)) return;

  // Biome's npm package ships a Node launcher; running it through node works on every OS.
  const biome = join(root, 'node_modules', '@biomejs', 'biome', 'bin', 'biome');
  if (!existsSync(biome)) return;

  spawnSync(process.execPath, [biome, 'format', '--write', absolute], {
    cwd: root,
    stdio: 'ignore',
    timeout: 20_000,
  });
}

try {
  main();
} catch {
  // Formatting is a convenience; never block Claude.
}
process.exit(0);
