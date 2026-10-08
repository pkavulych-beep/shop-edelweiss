#!/usr/bin/env node
// Conveyor: the dispatcher that moves work through Agent Office without a person watching.
//
// Every tick it reads GitHub (open pull requests and issues) and the office's workers,
// and takes the next step for each piece of work:
//   issue in the queue        → hire the coder for its difficulty             → pull request
//   PR behind main / no CI    → update its branch from main                   → CI runs
//   PR conflicts / CI red     → hand it back to its author, or hire a fixer   → new commits
//   PR green, no verdict      → hire the reviewer (one at a time)             → verdict comment
//   verdict "changes"         → hand it back for fixes, then review again (a limited number of rounds)
//   verdict "approve"         → merge, unless it touches protected paths or is too big
//   every few merges          → hire QA, who tries them in a browser          → bug issues and a report
// The queue is issues labelled `agent`, plus our own issues with a priority it takes on its own (P0–P3);
// `manual` keeps an issue out of it. The priority says what goes first, the difficulty label (`hard`,
// `medium`, `easy`) which coder takes it. Each coder does one task at a time, alongside the others, on
// ports and a database of its own; an issue whose difficulty no coder takes waits for one. A usage limit
// pauses only the agents on that plan. Coders and QA run the shop on its database in Docker: when Docker
// Desktop is closed the conveyor opens it, and hires none of them until the database is up.
// Whatever it can't move on its own gets the `needs-human` label and a comment saying why;
// removing the label hands it back to the conveyor, with its counts reset. A macOS notification says
// when that happens, when a usage limit pauses the work, when Docker won't start, and what QA found.
//
// It spends no model tokens itself. Run it in a 🐚 shell at a desk, where `office-workers` works:
//   node tools/conveyor/conveyor.mjs [--dry-run] [--once]
// --dry-run only says what it would do; --once runs a single tick.
import { execFileSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const flags = new Set(process.argv.slice(2));
const DRY = flags.has('--dry-run');
const ONCE = flags.has('--once');
const config = JSON.parse(readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const REPO = config.repo;
const STATE_PATH = path.join(HERE, 'state.json');
const LOG_PATH = path.join(HERE, 'conveyor.log');
const SCROLLBACK = path.join(ROOT, '.agent-office', 'scrollback');
const IN_OFFICE = Boolean(process.env.AGENT_OFFICE_WORKER_ID && process.env.AGENT_OFFICE_HOOK_URL);

const REVIEW_MARK = /<!--\s*conveyor-review\s+sha=([0-9a-f]{7,40})\s+verdict=(approve|changes)\s*-->/i;
// The title of a QA report that checked nothing, because QA couldn't start the shop.
const QA_FAILED = /^QA не виконано/i;
// What docker says when Docker itself isn't running (or isn't installed), rather than the database failing.
const DOCKER_DOWN = /cannot connect to the docker daemon|failed to connect to the docker api|docker daemon running|ENOENT/i;
// What it says when the database's port is taken: as a rule, by another PostgreSQL the agents can use just as well.
const PORT_TAKEN = /port is already allocated|address already in use/i;
const CLOSES = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
// A line like "Залежить від #12, #13" in an issue: it waits until those issues are closed.
const DEPENDS = /^[\s*>-]*(?:залежить від|depends on|blocked by)[:\s](.*)$/gim;
// What Claude Code and Codex print when a plan's usage window runs out (not their warnings that it's close).
// Claude Code names the limit ("You've hit your session limit · resets 1:50am"), Codex doesn't ("hit your usage limit").
const LIMIT_TEXT = /hit your (?:[\w']+ ){0,2}limit|usage limit reached|limit reached\s*[·∙•|-]?\s*resets|out of extra usage/i;
// Claude Code's limits counted over a week: their reset can be up to a day away even when it shows only the time.
const LONG_LIMIT = /hit your (?:weekly|opus|sonnet|fable) limit/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// Generated files: their lines don't count towards a pull request's size.
const LOCK_FILE = /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/;
const FINISHED = new Set(['idle', 'done', 'exited', 'offline']);
const MINUTE = 60_000;

const state = loadState();
state.qa ??= {};
state.paused ??= state.pausedUntil ? { claude: state.pausedUntil } : {}; // until when each provider's usage limit holds
delete state.pausedUntil;
// Coder jobs from before there were several coders ran on Claude.
const CLAUDE_CODER = Object.keys(config.coders).find((k) => config.coders[k].provider === 'claude') ?? Object.keys(config.coders)[0];
let me; // this shell's GitHub login and office name, filled in on the first tick

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { prs: {}, issues: {}, paused: {} };
  }
}

function saveState() {
  if (!DRY) writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

function log(message) {
  const line = `${new Date().toLocaleString('uk-UA')}  ${message}`;
  console.log(line);
  if (!DRY) appendFileSync(LOG_PATH, line + '\n');
}

function run(command, args, { input, cwd = ROOT, timeout } = {}) {
  return execFileSync(command, args, {
    cwd,
    input,
    timeout,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

const gh = (...args) => run('gh', args);
const ghJson = (...args) => JSON.parse(gh(...args));
const firstLine = (e) => String(e?.stderr || e?.message || e).trim().split('\n')[0];
const lastLine = (e) => String(e?.stderr || e?.message || e).trim().split('\n').at(-1);

/**
 * Every change to GitHub or the office goes through here, so that --dry-run only describes it.
 * Returns what `change` returned (or true), null on a dry run, and undefined when it failed.
 */
function act(what, change) {
  if (DRY) {
    log(`[dry-run] ${what}`);
    return null;
  }
  try {
    const result = change();
    log(what);
    return result ?? true;
  } catch (e) {
    log(`НЕ ВДАЛОСЯ: ${what} — ${firstLine(e)}`);
    return undefined;
  }
}

/** A macOS notification, so whoever runs the conveyor hears about what needs them without watching the log. */
function notify(subtitle, message) {
  if (DRY || !config.notify?.enabled || process.platform !== 'darwin') return;
  try {
    run('osascript', ['-e', 'on run argv', '-e', 'display notification (item 3 of argv) with title (item 1 of argv) subtitle (item 2 of argv)',
      '-e', 'end run', 'Конвеєр', subtitle, message]);
  } catch (e) {
    log(`Сповіщення не надіслано: ${firstLine(e)}`);
  }
}

function prompt(name, vars) {
  const text = readFileSync(path.join(HERE, 'prompts', `${name}.md`), 'utf8');
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
}

// ── The office ───────────────────────────────────────────────────────────────────────────────

function officeWorkers() {
  return IN_OFFICE ? JSON.parse(run('office-workers', ['list', '--json'])) : null;
}

/** Hires a worker on `agent` (its provider, model and effort, if it has one); returns its name, '(dry-run)', or undefined when hiring failed. */
function hire(agent, who, title, text, extra = []) {
  const effort = agent.effort ? ['--effort', agent.effort] : [];
  const args = ['hire', '--provider', agent.provider, '--model', agent.model, ...effort, '--json', ...extra];
  const w = act(`найняти ${who} (${agent.model}): ${title}`, () => JSON.parse(run('office-workers', args, { input: text })));
  if (w === null) return { name: '(dry-run)' };
  return w && w.name ? { name: w.name, id: w.id } : undefined;
}

function tell(worker, text, what) {
  return act(what, () => run('office-workers', ['tell', worker], { input: text }));
}

/** A worker's git branch, from its worktree as the office lists it. */
const branchOf = (w) => w.worktree?.branch ?? (typeof w.worktree === 'string' ? `office/${path.basename(w.worktree)}` : undefined);

const sentHome = new Set(); // who went home this tick, so nobody is sent twice

function sendHome(names, why) {
  const fresh = names.filter((n) => !sentHome.has(n));
  fresh.forEach((n) => sentHome.add(n));
  if (fresh.length) act(`відправити додому (${why}): ${fresh.join(', ')}`, () => run('office-workers', ['home', ...fresh, '--cleanup', 'auto']));
}

/** Where the worker doing `job` is: running, needs_input, finished, gone, or unknown (outside the office). */
function jobState(job, workers) {
  if (!workers) return 'unknown';
  const w = workers.find((x) => x.name === job.worker);
  if (!w) return 'gone';
  if (w.status === 'needs_input') return 'needs_input';
  // Just told or hired: give its status a moment to catch up.
  if (FINISHED.has(w.status) && Date.now() - (job.wokenAt ?? job.since) > MINUTE) return 'finished';
  return 'running';
}

const scrollbackOf = (workerId) => path.join(SCROLLBACK, `${workerId}.ansi`);

/** How much a worker's terminal has printed so far, so that what it printed before can be told apart. */
function terminalSize(workerId) {
  const file = workerId && scrollbackOf(workerId);
  return file && existsSync(file) ? statSync(file).size : 0;
}

/** The end of a worker's terminal, from byte `from` on, without colours and cursor moves. */
function terminalTail(workerId, from = 0) {
  const size = terminalSize(workerId);
  const start = Math.max(size - 4000, from <= size ? from : 0);
  if (size <= start) return '';
  const buffer = Buffer.alloc(size - start);
  const fd = openSync(scrollbackOf(workerId), 'r');
  try {
    readSync(fd, buffer, 0, buffer.length, start);
  } finally {
    closeSync(fd);
  }
  return buffer.toString('utf8').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

const hour24 = (hour, ampm) => (Number(hour) % 12) + (ampm.toUpperCase() === 'PM' ? 12 : 0);

/**
 * When a usage limit lifts, if the message says: Codex's "try again at Nov 3rd, 2026 8:00 PM" or
 * "try again in 2 days 3 hours", Claude Code's "resets 3am" or "resets Oct 9, 9am". It can be in the past:
 * the message is an old one, and the limit has already lifted.
 */
function resetTime(text, now) {
  let m = /try again at ([a-z]{3})[a-z]* (\d{1,2})(?:st|nd|rd|th)?,? (\d{4}),? (\d{1,2}):(\d{2})\s*([ap]m)/i.exec(text);
  if (m && MONTHS.includes(m[1].toLowerCase())) {
    return new Date(Number(m[3]), MONTHS.indexOf(m[1].toLowerCase()), Number(m[2]), hour24(m[4], m[6]), Number(m[5])).getTime();
  }
  m = /try again in ((?:\d+\s*(?:days?|hours?|hrs?|minutes?|mins?)[\s,]*(?:and\s*)?)+)/i.exec(text);
  if (m) return now + [...m[1].matchAll(/(\d+)\s*([dhm])/gi)].reduce((ms, [, n, unit]) => ms + Number(n) * { d: 1440, h: 60, m: 1 }[unit.toLowerCase()] * MINUTE, 0);
  // The last one: an older message can still be on the screen above it.
  m = [...text.matchAll(/resets? (?:at |on )?(?:([a-z]{3})[a-z]* (\d{1,2}),? )?(\d{1,2})(?::(\d{2}))?\s*([ap]m)/gi)].at(-1);
  if (m) {
    const at = new Date(now);
    if (m[1] && MONTHS.includes(m[1].toLowerCase())) at.setMonth(MONTHS.indexOf(m[1].toLowerCase()), Number(m[2]));
    at.setHours(hour24(m[3], m[5]), Number(m[4] ?? 0), 0, 0);
    // Claude Code shows only the time while the reset is less than a day away, and goes on showing it once it has
    // passed. A weekly limit resets at the next such time. A session limit resets at most 5 hours ahead, so its
    // time is the one between 18 hours ago and 6 hours ahead, and one in the past has already come.
    if (!m[1]) {
      if (LONG_LIMIT.test(text)) {
        if (at.getTime() <= now) at.setDate(at.getDate() + 1);
      } else if (at.getTime() > now + 6 * 60 * MINUTE) at.setDate(at.getDate() - 1);
      else if (at.getTime() <= now - 18 * 60 * MINUTE) at.setDate(at.getDate() + 1);
    }
    return at.getTime();
  }
  return undefined;
}

/** The same time of day, a day later. */
function nextDay(time) {
  const at = new Date(time);
  at.setDate(at.getDate() + 1);
  return at.getTime();
}

/** Whether a worker's terminal, from byte `from` on, says its plan's usage limit ran out, and until when if it says. */
function usageLimit(workerId, from) {
  const text = terminalTail(workerId, from);
  return LIMIT_TEXT.test(text) ? { until: resetTime(text, Date.now()) } : null;
}

// ── Docker ───────────────────────────────────────────────────────────────────────────────────

/**
 * Whether the shop's database (the docker compose service `docker.service`) is up, bringing it up if need be. Coders
 * and QA run the shop on it, and agents don't start Docker themselves (AGENTS.md). After a reboot Docker Desktop is
 * often closed, so the conveyor opens it, once, and looks again on the next tick. If Docker isn't up after
 * docker.waitMinutes, or the database fails on its own, the person hears about it, once.
 */
function databaseUp(now) {
  const docker = config.docker;
  if (!docker?.enabled || DRY) return true;
  let output = '';
  let why;
  try {
    run('docker', ['compose', 'up', '--detach', '--wait', docker.service], { timeout: 2 * MINUTE });
  } catch (e) {
    output = `${e.stderr ?? ''} ${e.message}`;
    why = lastLine(e); // docker compose reports its progress first and the error last
  }
  // A taken port is a database too: say, one an agent started in its worktree before docker-compose.yml gave every
  // worktree the same project.
  if (!why || PORT_TAKEN.test(output)) {
    if (state.docker) log('Docker і база знову працюють');
    delete state.docker;
    return true;
  }
  const down = (state.docker ??= { since: now });
  if (DOCKER_DOWN.test(output) && down.opened === undefined && process.platform === 'darwin') {
    down.opened = act(`запустити ${docker.app}: Docker не працює`, () => run('open', ['-g', '-a', docker.app])) !== undefined;
  }
  if (!down.told && (!down.opened || now - down.since >= docker.waitMinutes * MINUTE)) {
    down.told = true;
    log(`База не працює (${why}): кодерів і QA не наймаю, доки вона не запрацює`);
    notify('Потрібна людина', `Docker або база не працює, тож кодерів і QA не наймаю: ${why}`);
  }
  return false;
}

// ── Coders ───────────────────────────────────────────────────────────────────────────────────

/** An issue's difficulty: its label, or the default when it has none. */
const difficultyOf = (issue) => config.difficultyLabels.find((l) => labelsOf(issue).includes(l)) ?? config.defaultDifficulty;

/** The first coder that takes issues of `difficulty`, if any does. */
const coderFor = (difficulty) => Object.keys(config.coders).find((name) => config.coders[name].takes.includes(difficulty));

/** The ports and database an agent runs the shop on, for its prompt. */
const portsOf = (agent) => ({ backPort: agent.ports.back, frontPort: agent.ports.front, db: agent.ports.db });

/** How long to wait before waking agents that ran into `provider`'s usage limit. */
const pauseMinutes = (provider) =>
  typeof config.limitPauseMinutes === 'number' ? config.limitPauseMinutes : config.limitPauseMinutes[provider] ?? 60;

const when = (time) => new Date(time).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });

// ── GitHub ───────────────────────────────────────────────────────────────────────────────────

const labelsOf = (item) => (item.labels ?? []).map((l) => l.name);

function openPulls() {
  return ghJson(
    'pr', 'list', '--repo', REPO, '--state', 'open', '--base', 'main', '--limit', '50', '--json',
    'number,title,url,body,author,isDraft,isCrossRepository,headRefName,headRefOid,labels,mergeable,mergeStateStatus,statusCheckRollup,additions,deletions,files',
  );
}

function openIssues() {
  return ghJson('issue', 'list', '--repo', REPO, '--state', 'open', '--limit', '200', '--json', 'number,title,body,labels,assignees,createdAt,author');
}

/** Whether the conveyor may take an issue: labelled `agent`, or our own with a priority it takes on its own; never `manual`. */
function inQueue(issue) {
  const labels = labelsOf(issue);
  if (labels.includes(config.manualLabel)) return false;
  // A priority alone counts only on our own issues: anyone can open one on a public repo, and its text becomes an agent's task.
  return labels.includes(config.issueLabel) || (issue.author?.login === me.login && labels.some((l) => config.autoPriorities.includes(l)));
}

/** The issues an issue waits for ("Залежить від #12, #13"). */
const dependsOn = (issue) => [...(issue.body ?? '').matchAll(DEPENDS)].flatMap((m) => [...m[1].matchAll(/#(\d+)/g)].map((x) => Number(x[1])));

/** Merged pull requests that changed the shop since the last QA run, oldest first. */
function mergedSinceQa() {
  const since = state.qa.since ?? '';
  const args = ['pr', 'list', '--repo', REPO, '--state', 'merged', '--base', 'main', '--limit', '50', '--json', 'number,title,url,mergedAt,files'];
  if (since) args.push('--search', `merged:>=${since.slice(0, 10)}`);
  return ghJson(...args)
    .filter((p) => p.mergedAt > since && (p.files ?? []).some((f) => config.qa.paths.some((x) => f.path.startsWith(x))))
    .sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));
}

/** Issues labelled `label` that were opened since `time`, newest first. */
function issuesSince(label, time) {
  return ghJson(
    'issue', 'list', '--repo', REPO, '--state', 'all', '--label', label, '--search', `created:>=${new Date(time).toISOString().slice(0, 10)}`,
    '--limit', '100', '--json', 'number,title,state,createdAt',
  ).filter((i) => Date.parse(i.createdAt) >= time);
}

/** QA is done: the merges it covered won't be checked again, and the person hears what it found. */
function finishQa(qa) {
  const job = qa.lastJob;
  job.checked = true;
  const list = job.prs.map((n) => `#${n}`).join(', ');
  let found;
  let reported = true;
  let failed = false;
  try {
    const bugs = issuesSince('qa', job.since).length;
    const reports = issuesSince('qa-report', job.since);
    reported = reports.length > 0;
    failed = reports.some((r) => QA_FAILED.test(r.title ?? ''));
    // The report is a record, not a task, so it doesn't stay open.
    for (const r of reports.filter((x) => x.state === 'OPEN')) {
      act(`закрити звіт QA #${r.number}`, () => gh('issue', 'close', String(r.number), '--repo', REPO));
    }
    found = `нових багів: ${bugs}, ${reports.length ? `звіт #${reports[0].number}` : 'звіту немає'}`;
  } catch (e) {
    found = `не вдалося порахувати знахідки (${firstLine(e)})`;
  }
  // No report mostly means QA was cut short, by a usage limit or a restart, and a report that QA couldn't start
  // the shop means it checked nothing: either way those merges get one more run.
  const again = (!reported || failed) && !qa.retried;
  if (again) {
    qa.retried = true;
    found += ', ці PR перевіримо ще раз';
  } else {
    qa.since = job.until;
    delete qa.retried;
  }
  if (!failed) {
    log(`QA перевірив ${list}: ${found}`);
    notify('QA закінчив', `Перевірено PR: ${job.prs.length}, ${found}`);
  } else if (again) {
    log(`QA не зміг запустити магазин і не перевірив ${list}: ${found}`);
    notify('QA не виконано', `QA не зміг запустити магазин: ${found}`);
  } else {
    needsHuman('qa', 0, `QA вдруге не зміг запустити магазин, ${list} лишилися неперевіреними (${found})`);
  }
}

/** passed, failed, pending, or none (CI never ran on this commit). */
function ciState(pr) {
  const checks = pr.statusCheckRollup ?? [];
  if (!checks.length) return 'none';
  let pending = false;
  for (const c of checks) {
    if (c.__typename === 'StatusContext') {
      if (c.state === 'PENDING' || c.state === 'EXPECTED') pending = true;
      else if (c.state !== 'SUCCESS') return 'failed';
    } else if (c.status !== 'COMPLETED') {
      pending = true;
    } else if (!['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(c.conclusion)) {
      return 'failed';
    }
  }
  return pending ? 'pending' : 'passed';
}

/** The last review verdict on a PR. Only comments from our own account count: anyone can comment on a public repo. */
function latestVerdict(n) {
  const { comments } = ghJson('pr', 'view', String(n), '--repo', REPO, '--json', 'comments');
  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i].author?.login !== me.login) continue;
    const m = REVIEW_MARK.exec(comments[i].body);
    if (m) return { sha: m[1], verdict: m[2].toLowerCase() };
  }
  return null;
}

const sameCommit = (a, b) => a.startsWith(b) || b.startsWith(a);

/**
 * Whether PR `n` got nothing of its own after `from` but merges of main made by update-branch, so a verdict
 * on `from` still holds for `to`. A merge made by hand (say, to settle a conflict) can change the code.
 */
function onlyMainMergedSince(n, from, to) {
  if (sameCommit(from, to)) return true;
  try {
    // The comparison also lists main's own commits that the merge brought in: only the PR's commits count.
    const own = new Set(gh('api', `repos/${REPO}/pulls/${n}/commits`, '--paginate', '--jq', '.[].sha').split('\n').filter(Boolean));
    const added = ghJson('api', `repos/${REPO}/compare/${from}...${to}`, '--jq', '[.commits[] | {sha, parents: (.parents | length), by: .committer.login}]')
      .filter((c) => own.has(c.sha));
    return added.length > 0 && added.every((c) => c.parents > 1 && c.by === 'web-flow');
  } catch {
    return false;
  }
}

function mergeBlockers(pr) {
  const why = [];
  const touched = (pr.files ?? [])
    .map((f) => f.path)
    .filter((p) => config.merge.protectedPaths.some((x) => p === x || p.startsWith(x)));
  if (touched.length) why.push(`змінює захищені файли (${touched.join(', ')})`);
  const files = pr.files ?? [];
  const size = files.length
    ? files.filter((f) => !LOCK_FILE.test(f.path)).reduce((n, f) => n + (f.additions ?? 0) + (f.deletions ?? 0), 0)
    : pr.additions + pr.deletions;
  if (size > config.merge.maxChangedLines) why.push(`завеликий: ${size} змінених рядків (без lock-файлів) при ліміті ${config.merge.maxChangedLines}`);
  return why;
}

function needsHuman(kind, n, reason) {
  if (kind === 'qa') {
    // QA has no pull request or issue to put the label on: the notification is all there is.
    log(`QA → потрібна людина: ${reason}`);
    notify('Потрібна людина', `QA: ${reason}`);
    return;
  }
  const cmd = kind === 'pr' ? 'pr' : 'issue';
  const what = `${kind === 'pr' ? 'PR' : 'issue'} #${n}`;
  const done = act(`${what} → needs-human: ${reason}`, () => {
    gh(cmd, 'edit', String(n), '--repo', REPO, '--add-label', 'needs-human');
    gh(cmd, 'comment', String(n), '--repo', REPO, '--body',
      `🤖 Конвеєр зупинився: ${reason}.\n\nПотрібне рішення людини. Щоб повернути це в конвеєр, зніміть мітку \`needs-human\`.`);
  });
  if (done !== undefined) notify('Потрібна людина', `${what}: ${reason}`);
  const s = (kind === 'pr' ? state.prs : state.issues)[n];
  if (done !== undefined && s) s.held = true;
}

// What the conveyor counts per PR and per issue to know when to give up.
const PR_COUNTS = ['reviewRounds', 'reviewedSha', 'reviewRetried', 'fixRounds', 'fixFor', 'fixRetried', 'mergeFailures', 'updatedFor'];
const ISSUE_COUNTS = ['failures'];

/**
 * Whether the item waits for a person (`needs-human`). Taking the label off hands it back with its counts
 * reset: otherwise whatever ran out would stop it again on the next tick.
 */
function onHold(item, s, counts) {
  if (labelsOf(item).includes('needs-human')) {
    s.held = true;
    return true;
  }
  if (s.held) {
    for (const key of ['held', ...counts]) delete s[key];
    if (s.job) delete s.job.escalated;
    log(`#${item.number}: мітку needs-human знято, лічильники скинуто`);
  }
  return false;
}

function setReviewLabel(pr, verdict) {
  const want = verdict === 'approve' ? 'review:approved' : 'review:changes';
  const other = verdict === 'approve' ? 'review:changes' : 'review:approved';
  const have = labelsOf(pr);
  if (have.includes(want) && !have.includes(other)) return;
  act(`PR #${pr.number}: мітка ${want}`, () =>
    gh('pr', 'edit', String(pr.number), '--repo', REPO, '--add-label', want, '--remove-label', other));
}

// ── One tick ─────────────────────────────────────────────────────────────────────────────────

function tick() {
  const now = Date.now();
  sentHome.clear();
  const office = officeWorkers();
  const workers = office?.workers ?? null;
  me ??= { login: gh('api', 'user', '--jq', '.login').trim() };
  if (office) me.name = office.workers.find((w) => w.you)?.name;

  // Only our own pull requests: agents push as this account, and a stranger's PR must never be merged by a script.
  const pulls = openPulls().filter((p) => !p.isDraft && !p.isCrossRepository && p.author?.login === me.login);
  const open = openIssues();
  const openNumbers = new Set(open.map((i) => i.number));
  const issues = open.filter(inQueue);
  const waits = (i) => dependsOn(i).some((n) => openNumbers.has(n));
  for (const i of issues) if (state.issues[i.number]) onHold(i, state.issues[i.number], ISSUE_COUNTS);
  const busyCoders = new Set();
  let reviewerBusy = false;

  /** Tells the agent of a job that stopped on a usage limit to go on. True if it was told. */
  const wake = (job) => {
    if (tell(job.worker, 'Ліміт використання мав відновитися. Продовжуй свою задачу з того місця, де зупинився.', `ліміт відновився: будимо ${job.worker}`) === undefined) return false;
    job.limited = false;
    job.wokenAt = now; // `since` stays: QA counts what it filed from then on
    job.scrollFrom = terminalSize(job.workerId); // the old limit message stays on its screen
    return true;
  };

  // Usage limits: each plan's window runs out on its own, so wait it out, then wake whoever stopped on it.
  for (const [provider, until] of Object.entries(state.paused)) {
    if (until > now) continue;
    delete state.paused[provider];
    for (const s of [...Object.values(state.prs), ...Object.values(state.issues), state.qa]) {
      if (s.job?.limited && (s.job.provider ?? 'claude') === provider && wake(s.job)) s.job.wokeFor = until; // the reset it woke after
    }
  }
  const pausedFor = (provider) => (state.paused[provider] ?? 0) > now;
  // Coders and QA run the shop: before one of them is hired, its database must be up. Looked at once a tick, if needed.
  let dbUp;
  const databaseReady = () => (dbUp ??= databaseUp(now));

  /**
   * A job's agent ran into its plan's usage limit: no more agents on that plan until it lifts. The job waits for
   * its agent, unless that takes longer than releaseAfterHours: then the agent goes home and the work goes back,
   * as if it never started. True while the job is held.
   */
  const waitOutLimit = (s, kind, n, limit) => {
    const job = s.job;
    const provider = job.provider ?? 'claude';
    const until = limit.until > now ? limit.until : now + pauseMinutes(provider) * MINUTE;
    state.paused[provider] = Math.max(state.paused[provider] ?? 0, until);
    const release = until - now > config.releaseAfterHours * 60 * MINUTE;
    const what = kind === 'qa' ? 'перевірка QA' : `${kind === 'pr' ? 'PR' : 'issue'} #${n}`;
    log(`${job.worker} уперся в ліміт ${provider}: пауза для агентів ${provider} до ${when(until)}${release ? `, ${what} повертається в чергу` : ''}`);
    notify('Пауза через ліміт', `${job.worker} уперся в ліміт ${provider}. Агентів ${provider} не наймаю до ${when(until)}`);
    if (!release) {
      job.limited = true;
      return true;
    }
    if (workers) sendHome([job.worker], `ліміт ${provider} до ${when(until)}`);
    delete s.job;
    if (job.kind === 'code') s.checked = true; // not a failed attempt
    if (job.kind === 'fix') {
      s.fixRounds = Math.max(0, (s.fixRounds ?? 1) - 1);
      delete s.fixFor;
    }
    if (job.kind === 'review') {
      s.reviewRounds = Math.max(0, (s.reviewRounds ?? 1) - 1);
      delete s.reviewedSha;
    }
    return false;
  };

  /** Brings a job up to date; true while its worker is still on it (or waiting out a limit). */
  const busy = (s, kind, n) => {
    const job = s.job;
    if (!job) return false;
    const where = jobState(job, workers);
    if (where === 'unknown' || job.limited) return true;
    // A usage limit can leave the agent stuck at a question (Codex offers a cheaper model) while its status
    // still says it's working, so its terminal is read whatever the status.
    const limit = where === 'gone' ? null : usageLimit(job.workerId, job.scrollFrom);
    // An old message: the reset it names has passed, or it's the one the agent woke after, read as tomorrow's. The
    // screen still shows it or printed it again, so it pauses nothing: an agent that stopped on it is told to go on,
    // once, and otherwise the job goes on as if it weren't there.
    if (limit && (limit.until <= now || limit.until === nextDay(job.wokeFor))) {
      if (where !== 'running' && job.nudgedFor !== limit.until) {
        job.nudgedFor = limit.until;
        wake(job);
        return true;
      }
    } else if (limit) return waitOutLimit(s, kind, n, limit);
    if (where === 'running') return true;
    if (where === 'needs_input') {
      job.waitingSince ??= now;
      if (now - job.waitingSince > config.needsInputMinutes * MINUTE && !job.escalated) {
        needsHuman(kind, n, `агент ${job.worker} понад ${config.needsInputMinutes} хв чекає відповіді у своєму терміналі`);
        job.escalated = true;
      }
      return true;
    }
    delete job.waitingSince;
    s.lastJob = { ...job, ended: now };
    delete s.job;
    const done = { review: "рев'ю написане", qa: 'QA закінчив' }[job.kind];
    if (done && workers) sendHome([job.worker], done);
    return false;
  };

  // Jobs already running hold their coder, and the reviewer, first.
  for (const [n, s] of Object.entries(state.issues)) {
    if (busy(s, 'issue', n)) {
      busyCoders.add(s.job.coder ?? CLAUDE_CODER);
      continue;
    }
    if (s.lastJob && !s.checked) {
      s.checked = true;
      const opened = pulls.some((p) => [...(p.body ?? '').matchAll(CLOSES)].some((m) => m[1] === n));
      if (!opened) {
        s.failures = (s.failures ?? 0) + 1;
        log(`issue #${n}: ${s.lastJob.worker} закінчив, але PR не відкрив (спроба ${s.failures})`);
        if (s.failures >= config.maxIssueAttempts) needsHuman('issue', n, `агенти ${s.failures} рази не довели задачу до PR`);
      }
    }
  }
  for (const [n, s] of Object.entries(state.prs)) {
    if (busy(s, 'pr', n)) {
      if (s.job.kind === 'review') reviewerBusy = true;
      else busyCoders.add(s.job.coder ?? CLAUDE_CODER);
    } else if (!pulls.some((p) => String(p.number) === n)) {
      delete state.prs[n]; // merged or closed
    }
  }
  // QA runs the shop on ports of its own, so it works alongside the coders.
  const qa = state.qa;
  if (!busy(qa, 'qa') && qa.lastJob && !qa.lastJob.checked) finishQa(qa);

  /** The queued issues a pull request closes. */
  const issuesOfPr = (pr) => [...(pr.body ?? '').matchAll(CLOSES)].map((m) => Number(m[1]));
  const issueOfPr = (pr) => issuesOfPr(pr).map((n) => issues.find((i) => i.number === n)).find(Boolean);

  /**
   * Whose pull request this is: the coder that did its issue, as the conveyor remembers it (two coders can share a
   * provider), else the one on its author's provider and model, else the one its issue's difficulty picks.
   */
  const coderOfPr = (pr, author) => {
    const byJob = issuesOfPr(pr).map((n) => (state.issues[n]?.lastJob ?? state.issues[n]?.job)?.coder).find((c) => config.coders[c]);
    const byAuthor = author && Object.keys(config.coders).find((k) =>
      config.coders[k].provider === author.provider && (!author.model || config.coders[k].model === author.model));
    const issue = issueOfPr(pr);
    return byJob ?? byAuthor ?? (issue && coderFor(difficultyOf(issue))) ?? CLAUDE_CODER;
  };

  /** Who reviews a pull request: the one `reviewerFor` gives its issue's difficulty, else the reviewer. */
  const reviewerOf = (pr) => {
    const issue = issueOfPr(pr);
    return (issue && config.reviewerFor?.[difficultyOf(issue)]) ?? config.reviewer;
  };

  const requestFix = (pr, s, reasons, key) => {
    const n = pr.number;
    // The same request as last time: nothing was pushed since. The work may have been cut short (the office
    // restarted, the agent crashed), so it gets one more go, not counted as a round, before a person is asked.
    const again = s.fixFor === key;
    if (again && s.fixRetried === key) {
      needsHuman('pr', n, `після доопрацювання (${reasons.join(', ')}) нічого не змінилося`);
      return;
    }
    if (!again && s.fixRounds >= config.maxFixRounds) {
      needsHuman('pr', n, `${s.fixRounds} доопрацювань не довели PR до мерджу`);
      return;
    }
    // The office doesn't always know which pull request an OpenCode or Codex agent opened: its branch tells. The
    // second go is a new agent's: the author may be stuck where nothing typed to it gets through (a dialog).
    const author = again ? undefined : workers?.find((w) => w.kind === 'agent' && (w.pr?.number === n || branchOf(w) === pr.headRefName));
    if (!config.coders[s.coder]) s.coder = coderOfPr(pr, author);
    const coder = config.coders[s.coder];
    if (busyCoders.has(s.coder) || pausedFor(coder.provider)) return; // waits for its coder
    if (author && !FINISHED.has(author.status)) return; // its author is already at it
    if (!databaseReady()) return; // nowhere to try the fix
    if (again) reasons = [...reasons, 'минулого разу PR після доопрацювання не змінився: доведи його до кінця й запуш'];
    const text = prompt('fix', {
      pr: n, title: pr.title, url: pr.url, branch: pr.headRefName,
      reasons: reasons.map((r) => `- ${r}`).join('\n'),
      ...portsOf(coder),
    });
    let worker;
    if (author) {
      if (tell(author.name, text, `PR #${n}: повертаємо автору ${author.name} (${reasons.join(', ')})`) !== undefined) {
        worker = { name: author.name, id: author.id, scrollFrom: terminalSize(author.id) };
      }
    } else {
      worker = hire(coder, `кодера ${s.coder}`, `доопрацювати PR #${n} (${reasons.join(', ')})`, text);
    }
    if (!worker) return;
    if (again) s.fixRetried = key;
    else s.fixRounds = (s.fixRounds ?? 0) + 1;
    s.fixFor = key;
    s.job = { kind: 'fix', coder: s.coder, provider: coder.provider, worker: worker.name, workerId: worker.id, scrollFrom: worker.scrollFrom, since: now };
    busyCoders.add(s.coder);
  };

  /** Hires the reviewer for a PR; true if it was hired. */
  const requestReview = (pr, s, again = false) => {
    const reviewer = reviewerOf(pr);
    if (reviewerBusy || pausedFor(reviewer.provider)) return false;
    const text = prompt('review', { pr: pr.number, title: pr.title, url: pr.url, sha: pr.headRefOid });
    const title = `рев'ю PR #${pr.number}${again ? " ще раз: минулий рев'юер не залишив вердикту" : ''}`;
    const worker = hire(reviewer, "рев'юера", title, text, ['--no-worktree']);
    if (!worker) return false;
    s.reviewRounds = (s.reviewRounds ?? 0) + 1;
    s.reviewedSha = pr.headRefOid;
    delete s.fixFor; // a new verdict starts a new round of fixes
    s.job = { kind: 'review', provider: reviewer.provider, worker: worker.name, workerId: worker.id, since: now };
    reviewerBusy = true;
    return true;
  };

  // Pull requests, oldest first. One merge a tick: it moves main, and branch protection then wants every other PR
  // brought up to date before it merges, which the next tick sees and does.
  let mergedNow = false;
  for (const pr of [...pulls].sort((a, b) => a.number - b.number)) {
    const n = pr.number;
    const s = (state.prs[n] ??= {});
    if (onHold(pr, s, PR_COUNTS) || s.job) continue;
    if (pr.mergeable === 'UNKNOWN') continue; // GitHub is still working it out
    const ci = ciState(pr);
    // A verdict still holds after main was merged into the branch, as long as nothing else was pushed.
    const v = latestVerdict(n);
    const current = v && onlyMainMergedSince(n, v.sha, pr.headRefOid);

    // Requested changes go back straight away, along with anything else that's wrong:
    // no point updating the branch or waiting for CI on code that is about to change.
    if (current && v.verdict === 'changes') {
      setReviewLabel(pr, 'changes');
      if ((s.reviewRounds ?? 0) >= config.maxReviewRounds) {
        needsHuman('pr', n, `рев'ю не пройдено після ${s.reviewRounds} кіл`);
        continue;
      }
      if (s.fixFor !== `review@${v.sha}`) {
        const reasons = ["зауваження рев'ю (останній коментар із conveyor-review)"];
        if (pr.mergeable === 'CONFLICTING') reasons.push('конфлікт із main');
        if (ci === 'failed') reasons.push('CI червоний');
        requestFix(pr, s, reasons, `review@${v.sha}`);
        continue;
      }
      // Fixed without touching the code: the answer is in the description or a comment, so the reviewer
      // looks again once the branch is up to date and CI is green.
    }
    if (pr.mergeable === 'CONFLICTING') {
      requestFix(pr, s, ['конфлікт із main'], `conflict@${pr.headRefOid}`);
      continue;
    }
    if (pr.mergeStateStatus === 'BEHIND' || ci === 'none') {
      if (ci === 'none' && pr.mergeStateStatus !== 'BEHIND' && s.updatedFor === pr.headRefOid) {
        needsHuman('pr', n, 'CI не запускається на цьому PR');
        continue;
      }
      const why = pr.mergeStateStatus === 'BEHIND' ? 'відстає від main' : 'CI на ньому ще не запускався';
      if (act(`PR #${n}: підтягнути main у гілку (${why})`, () => gh('pr', 'update-branch', String(n), '--repo', REPO)) !== undefined) {
        s.updatedFor = pr.headRefOid;
      }
      continue;
    }
    if (ci === 'pending') continue;
    if (ci === 'failed') {
      requestFix(pr, s, ['CI червоний'], `ci@${pr.headRefOid}`);
      continue;
    }

    // CI is green and the branch is up to date: an approval merges it, otherwise the reviewer has a look.
    if (current && v.verdict === 'approve') {
      setReviewLabel(pr, 'approve');
      if (!config.merge.enabled || mergedNow) continue;
      const blockers = mergeBlockers(pr);
      if (blockers.length) {
        needsHuman('pr', n, `рев'ю пройдено, але автоматично не мерджу: ${blockers.join('; ')}`);
        continue;
      }
      // Run from outside the checkout, so gh doesn't try to delete local branches that worktrees hold.
      const merged = act(`PR #${n}: мерджимо в main («${pr.title}»)`, () =>
        run('gh', ['pr', 'merge', String(n), '--repo', REPO, `--${config.merge.method}`, '--delete-branch'], { cwd: tmpdir() }));
      if (merged !== undefined) mergedNow = true;
      else if ((s.mergeFailures = (s.mergeFailures ?? 0) + 1) >= 3) {
        needsHuman('pr', n, 'не вдається змерджити: подробиці в лозі конвеєра');
      }
      continue;
    }
    // The reviewer stopped without a verdict on this commit. Its work may have been cut short, so another one gets
    // a go, not counted as a round, before a person is asked.
    if (!current && s.reviewedSha && sameCommit(s.reviewedSha, pr.headRefOid)) {
      if (s.reviewRetried && sameCommit(s.reviewRetried, pr.headRefOid)) {
        needsHuman('pr', n, "рев'юер закінчив, але не залишив вердикту");
      } else if (requestReview(pr, s, true)) {
        s.reviewRetried = pr.headRefOid;
        s.reviewRounds -= 1;
      }
      continue;
    }
    requestReview(pr, s);
  }

  // QA after every qa.everyMerges merges that changed the shop, the oldest first and at most that many at a time.
  // Fewer wait for more, since a run costs much the same however few it checks: only once the oldest has waited
  // qa.maxWaitHours does QA check what there is, so the last merges before the work stops get checked too.
  const unchecked = config.qa?.enabled && !qa.job ? mergedSinceQa() : [];
  const startQa = () => {
    if (pausedFor(config.qa.provider) || !databaseReady()) return;
    const batch = unchecked.slice(0, config.qa.everyMerges);
    const list = batch.map((p) => `#${p.number}`).join(', ');
    const prs = batch.map((p) => `- #${p.number} «${p.title}» (${p.url})`).join('\n');
    const text = prompt('qa', { prs, list, maxIssues: config.qa.maxIssues, ...portsOf(config.qa) });
    const worker = hire(config.qa, 'QA-агента', `перевірити змерджені ${list}`, text);
    if (!worker) return;
    qa.job = { kind: 'qa', provider: config.qa.provider, worker: worker.name, workerId: worker.id, since: now, until: batch.at(-1).mergedAt, prs: batch.map((p) => p.number) };
  };
  const waitedOut = unchecked.length > 0 && now - Date.parse(unchecked[0].mergedAt) >= (config.qa.maxWaitHours ?? Infinity) * 60 * MINUTE;
  if (unchecked.length >= (config.qa?.everyMerges ?? Infinity) || waitedOut) startQa();

  // New work: the next issue for each free coder, while not too much waits for review. Higher priority goes
  // first; an issue whose difficulty no coder takes waits for one.
  const inFlight = pulls.filter((p) => !labelsOf(p).includes('needs-human')).length;
  const taken = new Set(pulls.flatMap((p) => [...(p.body ?? '').matchAll(CLOSES)].map((m) => Number(m[1]))));
  const rank = (issue) => {
    const i = config.priorityLabels.findIndex((l) => labelsOf(issue).includes(l));
    return i < 0 ? config.priorityLabels.length : i;
  };
  const ready = issues
    .filter((i) => !labelsOf(i).includes('needs-human') && !taken.has(i.number) && !waits(i))
    .filter((i) => {
      const s = state.issues[i.number];
      if (s?.job || (s?.failures ?? 0) >= config.maxIssueAttempts) return false;
      return !i.assignees.length || s; // someone else's if assigned and not by us
    })
    .sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt));
  let started = 0;
  const claimed = new Set();
  for (const [name, coder] of Object.entries(config.coders)) {
    if (busyCoders.has(name) || pausedFor(coder.provider) || inFlight + started >= config.maxOpenPullRequests) continue;
    // Several coders can take the same difficulty: each free one takes the most important issue it can.
    const next = ready.find((i) => coder.takes.includes(difficultyOf(i)) && !claimed.has(i.number));
    if (!next) continue;
    if (!databaseReady()) break; // no coder starts without the shop's database
    claimed.add(next.number);
    const text = prompt('coder', { issue: next.number, title: next.title, ...portsOf(coder) });
    const worker = hire(coder, `кодера ${name}`, `issue #${next.number} «${next.title}»`, text, ['--issue', String(next.number)]);
    if (!worker) continue;
    const s = (state.issues[next.number] ??= {});
    s.job = { kind: 'code', coder: name, provider: coder.provider, worker: worker.name, workerId: worker.id, since: now };
    delete s.checked;
    busyCoders.add(name);
    started++;
  }

  // Our agents with nothing left to do go home, taking their worktrees with them: those whose pull request
  // merged, and those with no job whose open pull request nobody knows of. The office doesn't always tell which
  // pull request a Codex or OpenCode agent opened, so an open one is also looked for by the agent's branch.
  if (workers && me.name) {
    const onJob = new Set([...Object.values(state.prs), ...Object.values(state.issues), state.qa].map((s) => s.job?.worker));
    const openBranches = new Set(pulls.map((p) => p.headRefName));
    const free = workers.filter((w) => w.kind === 'agent' && w.hiredBy === me.name && FINISHED.has(w.status) && !onJob.has(w.name));
    sendHome(free.filter((w) => w.merged).map((w) => w.name), 'PR змерджено');
    sendHome(free.filter((w) => !w.merged && w.pr?.state !== 'OPEN' && !openBranches.has(branchOf(w))).map((w) => w.name), 'роботи більше немає');
  }

  // Issues that are closed or left the queue don't need tracking any more.
  for (const n of Object.keys(state.issues)) {
    if (!state.issues[n].job && !issues.some((i) => String(i.number) === n)) delete state.issues[n];
  }
  saveState();
  const noCoder = issues.filter((i) => !coderFor(difficultyOf(i))).length;
  const waiting = issues.filter(waits).length;
  const notes = [
    `PR у роботі ${inFlight}`,
    `issues у черзі ${issues.length}${noCoder ? ` (без кодера ${noCoder})` : ''}${waiting ? ` (чекають на інші ${waiting})` : ''}`,
    busyCoders.size ? `працюють ${[...busyCoders].join(', ')}` : '',
    !config.qa?.enabled ? '' : qa.job ? 'QA працює' : `мерджів до QA ${unchecked.length}/${config.qa.everyMerges}`,
    ...Object.entries(state.paused).filter(([, until]) => until > now).map(([p, until]) => `${p} на паузі до ${when(until)}`),
  ];
  log(`крок: ${notes.filter(Boolean).join(', ')}`);
}

async function main() {
  if (!IN_OFFICE && !DRY) {
    console.error('Запускайте в 🐚-столі Agent Office (там є office-workers) або з --dry-run.');
    process.exit(1);
  }
  log(`Конвеєр запущено${DRY ? ' у режимі dry-run: лише показую, що зробив би' : ''}${IN_OFFICE ? '' : '. Поза офісом: агентів не бачу й не наймаю'}`);
  for (;;) {
    try {
      tick();
    } catch (e) {
      log(`Помилка кроку: ${firstLine(e)}`);
    }
    if (ONCE) break;
    await new Promise((resolve) => setTimeout(resolve, config.intervalSeconds * 1000));
  }
}

main();
