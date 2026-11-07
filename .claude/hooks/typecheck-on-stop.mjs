// Stop hook: Claude cannot end a turn while the workspace fails `pnpm typecheck`.
// Exit code 2 blocks the stop and sends stderr back to Claude; 0 lets it stop.
import { execSync, spawnSync } from 'node:child_process';

const input = await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});

let payload = {};
try {
  payload = JSON.parse(input || '{}');
} catch {
  // Unreadable input: run the check anyway.
}

// Already blocked once in this turn: let Claude stop instead of looping.
if (payload.stop_hook_active) process.exit(0);

// Typecheck only when TypeScript or config files changed, to keep turns fast.
const changed = execSync('git status --porcelain --untracked-files=all', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.slice(3).trim())
  .filter((file) => /\.(ts|tsx|mts|cts|json)$/.test(file));
if (changed.length === 0) process.exit(0);

const result = spawnSync('pnpm', ['typecheck'], { encoding: 'utf8', shell: true });
if (result.status === 0) process.exit(0);

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
process.stderr.write(`pnpm typecheck fails. Fix the errors before finishing:\n${output}\n`);
process.exit(2);
