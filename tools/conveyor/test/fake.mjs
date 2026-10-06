// Fake gh / office-workers / osascript for test/run.mjs: answers from $FIXTURE, logs every call as JSON to $CALLS.
import { appendFileSync, readFileSync } from 'node:fs';
const tool = process.argv[2];
const args = process.argv.slice(3);
const fx = JSON.parse(readFileSync(process.env.FIXTURE, 'utf8'));
let input = '';
try { input = readFileSync(0, 'utf8'); } catch {}
appendFileSync(process.env.CALLS, JSON.stringify({ tool, args, input }) + '\n');
const out = (v) => process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v));
if (tool === 'gh') {
  const [a, b] = args;
  if (a === 'api' && b === 'user') out('pkavulych-beep\n');
  else if (a === 'api' && b.includes('/compare/')) out(fx.compare ?? []);
  else if (a === 'api' && b.endsWith('/commits')) out((fx.prCommits ?? []).join('\n') + '\n');
  else if (a === 'pr' && b === 'list') out(args.includes('merged') ? fx.merged ?? [] : fx.pulls ?? []);
  else if (a === 'issue' && b === 'list') {
    const label = args.includes('--label') ? args[args.indexOf('--label') + 1] : null;
    out(!label ? fx.issues ?? [] : label === 'qa' ? fx.qaIssues ?? [] : label === 'qa-report' ? fx.qaReports ?? [] : []);
  } else if (a === 'pr' && b === 'view') out({ comments: (fx.comments ?? {})[args[2]] ?? [] });
  else out('');
} else if (tool === 'office-workers') {
  if (args[0] === 'list') out({ workers: fx.workers ?? [] });
  else if (args[0] === 'hire') out({ name: 'Hired', id: 'w-hired' });
  else out('');
} else out('');
