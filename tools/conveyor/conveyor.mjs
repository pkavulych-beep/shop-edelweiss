#!/usr/bin/env node
// Conveyor: the dispatcher that moves work through Agent Office without a person watching.
//
// Every tick it reads GitHub (open pull requests and issues) and the office's workers,
// and takes the next step for each piece of work:
//   issue in the queue        → hire the coder (one at a time)                → pull request
//   PR behind main / no CI    → update its branch from main                   → CI runs
//   PR conflicts / CI red     → hand it back to its author, or hire a fixer   → new commits
//   PR green, no verdict      → hire the reviewer (one at a time)             → verdict comment
//   verdict "changes"         → hand it back for fixes, then review again (a limited number of rounds)
//   verdict "approve"         → merge, unless it touches protected paths or is too big
//   every few merges          → hire QA, who tries them in a browser          → bug issues and a report
// The queue is issues labelled `agent`, plus our own issues with a priority it takes on its own (P0–P2);
// `manual` keeps an issue out of it.
// Whatever it can't move on its own gets the `needs-human` label and a comment saying why;
// removing the label hands it back to the conveyor, with its counts reset. A macOS notification says
// when that happens, when a usage limit pauses the work, and what QA found.
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
const CLOSES = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
// What Claude Code and Codex print when a plan's usage window runs out.
const LIMIT_TEXT = /usage limit|limit reached|hit your (usage )?limit|out of extra usage/i;
const FINISHED = new Set(['idle', 'done', 'exited', 'offline']);
const ROLE = { coder: 'кодера', reviewer: "рев'юера", qa: 'QA-агента' };
const MINUTE = 60_000;

const state = loadState();
state.qa ??= {};
let me; // this shell's GitHub login and office name, filled in on the first tick

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { prs: {}, issues: {}, pausedUntil: 0 };
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

function run(command, args, { input, cwd = ROOT } = {}) {
  return execFileSync(command, args, {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

const gh = (...args) => run('gh', args);
const ghJson = (...args) => JSON.parse(gh(...args));
const firstLine = (e) => String(e?.stderr || e?.message || e).trim().split('\n')[0];

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

/** Hires a worker for `role`; returns its name, '(dry-run)', or undefined when hiring failed. */
function hire(role, title, text, extra = []) {
  const r = config[role];
  const args = ['hire', '--provider', r.provider, '--model', r.model, '--effort', r.effort, '--json', ...extra];
  const w = act(`найняти ${ROLE[role]} (${r.model}): ${title}`, () => JSON.parse(run('office-workers', args, { input: text })));
  if (w === null) return { name: '(dry-run)' };
  return w && w.name ? { name: w.name, id: w.id } : undefined;
}

function tell(worker, text, what) {
  return act(what, () => run('office-workers', ['tell', worker], { input: text }));
}

function sendHome(names, why) {
  if (names.length) act(`відправити додому (${why}): ${names.join(', ')}`, () => run('office-workers', ['home', ...names, '--cleanup', 'auto']));
}

/** Where the worker doing `job` is: running, needs_input, finished, gone, or unknown (outside the office). */
function jobState(job, workers) {
  if (!workers) return 'unknown';
  const w = workers.find((x) => x.name === job.worker);
  if (!w) return 'gone';
  if (w.status === 'needs_input') return 'needs_input';
  // Just told or hired: give its status a moment to catch up.
  if (FINISHED.has(w.status) && Date.now() - job.since > MINUTE) return 'finished';
  return 'running';
}

/** Whether the end of a worker's terminal says its plan's usage limit ran out. */
function hitLimit(workerId) {
  if (!workerId) return false;
  const file = path.join(SCROLLBACK, `${workerId}.ansi`);
  if (!existsSync(file)) return false;
  const size = statSync(file).size;
  const length = Math.min(size, 4000);
  const buffer = Buffer.alloc(length);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, buffer, 0, length, size - length);
  } finally {
    closeSync(fd);
  }
  return LIMIT_TEXT.test(buffer.toString('utf8').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''));
}

// ── GitHub ───────────────────────────────────────────────────────────────────────────────────

const labelsOf = (item) => (item.labels ?? []).map((l) => l.name);

function openPulls() {
  return ghJson(
    'pr', 'list', '--repo', REPO, '--state', 'open', '--base', 'main', '--limit', '50', '--json',
    'number,title,url,body,author,isDraft,isCrossRepository,headRefName,headRefOid,labels,mergeable,mergeStateStatus,statusCheckRollup,additions,deletions,files',
  );
}

/** Open issues the conveyor may take: labelled `agent`, or our own with a priority it takes on its own; never `manual`. */
function queuedIssues() {
  return ghJson(
    'issue', 'list', '--repo', REPO, '--state', 'open', '--limit', '200',
    '--json', 'number,title,labels,assignees,createdAt,author',
  ).filter((i) => {
    const labels = labelsOf(i);
    if (labels.includes(config.manualLabel)) return false;
    // A priority alone counts only on our own issues: anyone can open one on a public repo, and its text becomes an agent's task.
    return labels.includes(config.issueLabel) || (i.author?.login === me.login && labels.some((l) => config.autoPriorities.includes(l)));
  });
}

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
    '--limit', '100', '--json', 'number,state,createdAt',
  ).filter((i) => Date.parse(i.createdAt) >= time);
}

/** QA is done: the merges it covered won't be checked again, and the person hears what it found. */
function finishQa(qa) {
  const job = qa.lastJob;
  job.checked = true;
  qa.since = job.until;
  let found;
  try {
    const bugs = issuesSince('qa', job.since).length;
    const reports = issuesSince('qa-report', job.since);
    // The report is a record, not a task, so it doesn't stay open.
    for (const r of reports.filter((x) => x.state === 'OPEN')) {
      act(`закрити звіт QA #${r.number}`, () => gh('issue', 'close', String(r.number), '--repo', REPO));
    }
    found = `нових багів: ${bugs}, ${reports.length ? `звіт #${reports[0].number}` : 'звіту немає'}`;
  } catch (e) {
    found = `не вдалося порахувати знахідки (${firstLine(e)})`;
  }
  log(`QA перевірив ${job.prs.map((n) => `#${n}`).join(', ')}: ${found}`);
  notify('QA закінчив', `Перевірено PR: ${job.prs.length}, ${found}`);
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
  const size = pr.additions + pr.deletions;
  if (size > config.merge.maxChangedLines) why.push(`завеликий: ${size} змінених рядків при ліміті ${config.merge.maxChangedLines}`);
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
const PR_COUNTS = ['reviewRounds', 'reviewedSha', 'fixRounds', 'fixFor', 'mergeFailures', 'updatedFor'];
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
  const office = officeWorkers();
  const workers = office?.workers ?? null;
  me ??= { login: gh('api', 'user', '--jq', '.login').trim() };
  if (office) me.name = office.workers.find((w) => w.you)?.name;

  // Only our own pull requests: agents push as this account, and a stranger's PR must never be merged by a script.
  const pulls = openPulls().filter((p) => !p.isDraft && !p.isCrossRepository && p.author?.login === me.login);
  const issues = queuedIssues();
  for (const i of issues) if (state.issues[i.number]) onHold(i, state.issues[i.number], ISSUE_COUNTS);
  let coderBusy = false;
  let reviewerBusy = false;

  // Usage limits: the plan's window ran out, so wait it out, then wake whoever stopped on it.
  if (state.pausedUntil && state.pausedUntil <= now) {
    state.pausedUntil = 0;
    for (const s of [...Object.values(state.prs), ...Object.values(state.issues), state.qa]) {
      if (!s.job?.limited) continue;
      if (tell(s.job.worker, 'Ліміт використання мав відновитися. Продовжуй свою задачу з того місця, де зупинився.', `ліміт відновився: будимо ${s.job.worker}`) !== undefined) {
        s.job.limited = false;
        s.job.since = now;
      }
    }
  }

  /** Brings a job up to date; true while its worker is still on it (or waiting out a limit). */
  const busy = (s, kind, n) => {
    const job = s.job;
    if (!job) return false;
    const where = jobState(job, workers);
    if (where === 'unknown' || where === 'running') return true;
    if (job.limited) return true;
    if (where === 'needs_input') {
      job.waitingSince ??= now;
      if (now - job.waitingSince > config.needsInputMinutes * MINUTE && !job.escalated) {
        needsHuman(kind, n, `агент ${job.worker} понад ${config.needsInputMinutes} хв чекає відповіді у своєму терміналі`);
        job.escalated = true;
      }
      return true;
    }
    delete job.waitingSince;
    if (where === 'finished' && hitLimit(job.workerId)) {
      job.limited = true;
      state.pausedUntil = Math.max(state.pausedUntil, now + config.limitPauseMinutes * MINUTE);
      const until = new Date(state.pausedUntil).toLocaleTimeString('uk-UA');
      log(`${job.worker} уперся в ліміт використання: пауза для нових агентів до ${until}`);
      notify('Пауза через ліміт', `${job.worker} уперся в ліміт підписки. Нових агентів не наймаю до ${until}`);
      return true;
    }
    s.lastJob = { ...job, ended: now };
    delete s.job;
    const done = { review: "рев'ю написане", qa: 'QA закінчив' }[job.kind];
    if (done && workers) sendHome([job.worker], done);
    return false;
  };

  // Jobs already running take the coder and reviewer slots first.
  for (const [n, s] of Object.entries(state.issues)) {
    if (busy(s, 'issue', n)) {
      coderBusy = true;
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
      else coderBusy = true;
    } else if (!pulls.some((p) => String(p.number) === n)) {
      delete state.prs[n]; // merged or closed
    }
  }
  // QA holds the coder's slot: both run the shop on the same ports.
  const qa = state.qa;
  if (busy(qa, 'qa')) coderBusy = true;
  else if (qa.lastJob && !qa.lastJob.checked) finishQa(qa);
  const paused = state.pausedUntil > now;

  const requestFix = (pr, s, reasons, key) => {
    const n = pr.number;
    if (s.fixFor === key) {
      needsHuman('pr', n, `після доопрацювання (${reasons.join(', ')}) нічого не змінилося`);
      return;
    }
    if (s.fixRounds >= config.maxFixRounds) {
      needsHuman('pr', n, `${s.fixRounds} доопрацювань не довели PR до мерджу`);
      return;
    }
    if (coderBusy || paused) return; // waits for the coder slot
    const text = prompt('fix', {
      pr: n, title: pr.title, url: pr.url, branch: pr.headRefName,
      reasons: reasons.map((r) => `- ${r}`).join('\n'),
    });
    const author = workers?.find((w) => w.kind === 'agent' && w.pr?.number === n);
    let worker;
    if (author && !FINISHED.has(author.status)) return; // its author is already at it
    if (author) {
      if (tell(author.name, text, `PR #${n}: повертаємо автору ${author.name} (${reasons.join(', ')})`) !== undefined) {
        worker = { name: author.name, id: author.id };
      }
    } else {
      worker = hire('coder', `доопрацювати PR #${n} (${reasons.join(', ')})`, text);
    }
    if (!worker) return;
    s.fixRounds = (s.fixRounds ?? 0) + 1;
    s.fixFor = key;
    s.job = { kind: 'fix', worker: worker.name, workerId: worker.id, since: now };
    coderBusy = true;
  };

  const requestReview = (pr, s) => {
    if (reviewerBusy || paused) return;
    const text = prompt('review', { pr: pr.number, title: pr.title, url: pr.url, sha: pr.headRefOid });
    const worker = hire('reviewer', `рев'ю PR #${pr.number}`, text, ['--no-worktree']);
    if (!worker) return;
    s.reviewRounds = (s.reviewRounds ?? 0) + 1;
    s.reviewedSha = pr.headRefOid;
    delete s.fixFor; // a new verdict starts a new round of fixes
    s.job = { kind: 'review', worker: worker.name, workerId: worker.id, since: now };
    reviewerBusy = true;
  };

  // Pull requests, oldest first.
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
      if (!config.merge.enabled) continue;
      const blockers = mergeBlockers(pr);
      if (blockers.length) {
        needsHuman('pr', n, `рев'ю пройдено, але автоматично не мерджу: ${blockers.join('; ')}`);
        continue;
      }
      // Run from outside the checkout, so gh doesn't try to delete local branches that worktrees hold.
      const merged = act(`PR #${n}: мерджимо в main («${pr.title}»)`, () =>
        run('gh', ['pr', 'merge', String(n), '--repo', REPO, `--${config.merge.method}`, '--delete-branch'], { cwd: tmpdir() }));
      if (merged === undefined && (s.mergeFailures = (s.mergeFailures ?? 0) + 1) >= 3) {
        needsHuman('pr', n, 'не вдається змерджити: подробиці в лозі конвеєра');
      }
      continue;
    }
    if (!current && s.reviewedSha && sameCommit(s.reviewedSha, pr.headRefOid)) {
      needsHuman('pr', n, "рев'юер закінчив, але не залишив вердикту");
      continue;
    }
    requestReview(pr, s);
  }

  // QA after every qa.everyMerges merges that changed the shop, the oldest first and at most that many at a time.
  // It waits for the coder's slot, and no new issue starts meanwhile.
  const unchecked = config.qa?.enabled && !qa.job ? mergedSinceQa() : [];
  const qaWaits = unchecked.length >= (config.qa?.everyMerges ?? Infinity);
  const startQa = () => {
    const batch = unchecked.slice(0, config.qa.everyMerges);
    const list = batch.map((p) => `#${p.number}`).join(', ');
    const prs = batch.map((p) => `- #${p.number} «${p.title}» (${p.url})`).join('\n');
    const worker = hire('qa', `перевірити змерджені ${list}`, prompt('qa', { prs, list, maxIssues: config.qa.maxIssues }));
    if (!worker) return;
    qa.job = { kind: 'qa', worker: worker.name, workerId: worker.id, since: now, until: batch.at(-1).mergedAt, prs: batch.map((p) => p.number) };
    coderBusy = true;
  };
  if (qaWaits && !coderBusy && !paused) startQa();

  // New work: the next issue, while there's a free coder and not too much waiting for review.
  const inFlight = pulls.filter((p) => !labelsOf(p).includes('needs-human')).length;
  if (!coderBusy && !paused && !qaWaits && inFlight < config.maxOpenPullRequests) {
    const taken = new Set(pulls.flatMap((p) => [...(p.body ?? '').matchAll(CLOSES)].map((m) => Number(m[1]))));
    const rank = (issue) => {
      const i = config.priorityLabels.findIndex((l) => labelsOf(issue).includes(l));
      return i < 0 ? config.priorityLabels.length : i;
    };
    const next = issues
      .filter((i) => !labelsOf(i).includes('needs-human') && !taken.has(i.number))
      .filter((i) => {
        const s = state.issues[i.number];
        if (s?.job || (s?.failures ?? 0) >= config.maxIssueAttempts) return false;
        return !i.assignees.length || s; // someone else's if assigned and not by us
      })
      .sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt))[0];
    if (next) {
      const worker = hire('coder', `issue #${next.number} «${next.title}»`, prompt('coder', { issue: next.number, title: next.title }), [
        '--issue', String(next.number),
      ]);
      if (worker) {
        const s = (state.issues[next.number] ??= {});
        s.job = { kind: 'code', worker: worker.name, workerId: worker.id, since: now };
        delete s.checked;
      }
    } else if (unchecked.length && !inFlight) {
      // Nothing to start and nothing about to merge: QA checks what's left rather than wait for more merges.
      startQa();
    }
  }

  // Coders whose pull requests merged go home, taking their worktrees with them.
  if (workers && me.name) {
    sendHome(workers.filter((w) => w.hiredBy === me.name && w.merged && FINISHED.has(w.status)).map((w) => w.name), 'PR змерджено');
  }

  // Issues that are closed or left the queue don't need tracking any more.
  for (const n of Object.keys(state.issues)) {
    if (!state.issues[n].job && !issues.some((i) => String(i.number) === n)) delete state.issues[n];
  }
  saveState();
  const qaNote = !config.qa?.enabled ? '' : qa.job ? ', QA працює' : qaWaits ? ', QA чекає на слот кодера' : `, мерджів до QA ${unchecked.length}/${config.qa.everyMerges}`;
  log(`крок: PR у роботі ${inFlight}, issues у черзі ${issues.length}${qaNote}${paused ? `, пауза до ${new Date(state.pausedUntil).toLocaleTimeString('uk-UA')}` : ''}`);
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
