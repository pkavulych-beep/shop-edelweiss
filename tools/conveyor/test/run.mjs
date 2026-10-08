// Conveyor scenarios: each runs one tick of a copy of the conveyor, in a temporary folder, against fake
// gh / office-workers / osascript / docker / open (fake.mjs), and checks which calls it made: `want` must happen, `not` must not.
// Nothing touches GitHub, the office or the real state.json.  Run: node tools/conveyor/test/run.mjs
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = mkdtempSync(path.join(tmpdir(), 'conveyor-test-'));
const SB = `${T}/root/.agent-office/scrollback`;
const stPath = `${T}/root/tools/conveyor/state.json`;
mkdirSync(SB, { recursive: true });
mkdirSync(`${T}/bin`);
cpSync(path.join(HERE, '..', 'conveyor.mjs'), `${T}/root/tools/conveyor/conveyor.mjs`);
cpSync(path.join(HERE, '..', 'config.json'), `${T}/root/tools/conveyor/config.json`);
cpSync(path.join(HERE, '..', 'prompts'), `${T}/root/tools/conveyor/prompts`, { recursive: true });
for (const tool of ['gh', 'office-workers', 'osascript', 'docker', 'open']) {
  writeFileSync(`${T}/bin/${tool}`, `#!/bin/sh\nexec node "${path.join(HERE, 'fake.mjs')}" ${tool} "$@"\n`);
  chmodSync(`${T}/bin/${tool}`, 0o755);
}

const me = { name: 'Dispatcher 🐚', you: true, kind: 'shell', status: 'working' };
const st = (o = {}) => ({ prs: {}, issues: {}, paused: {}, qa: { since: '2026-10-05T09:00:00Z' }, ...o });
const issue = (number, labels, login = 'pkavulych-beep') => ({ number, title: `Задача ${number}`, labels: ['agent', ...labels].map((name) => ({ name })), assignees: [], createdAt: `2026-01-${String(number).padStart(2, '0')}`, author: { login } });
const HEAD = 'a'.repeat(40);
const ok = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }];
const red = [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }];
const pr = (o = {}) => ({ number: 50, title: 'PR', url: 'u', body: 'Closes #70', author: { login: 'pkavulych-beep' }, isDraft: false, isCrossRepository: false, headRefName: 'office/x', headRefOid: HEAD, labels: [], mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: ok, additions: 10, deletions: 2, files: [{ path: 'internet_shop-back-/src/a.ts', additions: 10, deletions: 2 }], ...o });
const verdict = (v, sha = HEAD) => ({ 50: [{ author: { login: 'pkavulych-beep' }, body: `<!-- conveyor-review sha=${sha} verdict=${v} -->\nтекст` }] });
const later = Date.now() + 3600_000;
const app = (number, i) => ({ number, title: `PR ${number}`, url: `u${number}`, mergedAt: `2026-10-05T1${Math.floor(i / 6)}:${String((i % 6) * 10).padStart(2, '0')}:00Z`, files: [{ path: 'internet_shop-front-/pages/x.tsx' }] });
const CODEX_LIMIT = '■ You’ve hit your usage limit. To continue using Codex ... or try again at Nov 3rd, 2026 8:00 PM.\n› 1. Switch to gpt-6-luna\n';
// Claude Code's limit message, with the reset time as it prints it ("1:50am"); `minute` is that time as a timestamp.
const NOW = Date.now();
const MIN = 60_000;
const clock = (t) => { const d = new Date(t); return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? 'am' : 'pm'}`; };
const minute = (t) => new Date(t).setSeconds(0, 0);
const tomorrow = (t) => { const d = new Date(t); d.setDate(d.getDate() + 1); return d.getTime(); };
const hitLimit = (t, limit = 'session') => `⎿  You've hit your ${limit} limit · resets ${clock(t)} (Europe/Kyiv) · progress saved\n`;
// With automatic continue on, Claude Code also shows this until the limit resets, and again if it runs into it once more.
const claudeLimit = (t, limit) => `${hitLimit(t, limit)}Usage limit reached again · continuing automatically in 2m · esc to cancel\n`;
const cosmo = (status) => ({ name: 'Cosmo', id: 'w-c', kind: 'agent', provider: 'claude', status });
const coding = (job = {}) => ({ issues: { 94: { job: { kind: 'code', coder: 'opus', provider: 'claude', worker: 'Cosmo', workerId: 'w-c', since: 0, ...job } } } });
const recent = (number, minutesAgo) => ({ ...app(number, 0), mergedAt: new Date(NOW - minutesAgo * MIN).toISOString() });
const quinn = { name: 'Quinn', id: 'w-q', kind: 'agent', provider: 'claude', status: 'idle', hiredBy: me.name };
const qaJob = { kind: 'qa', provider: 'claude', worker: 'Quinn', workerId: 'w-q', since: Date.parse('2026-10-05T18:43:46Z'), until: '2026-10-05T18:30:00Z', prs: [41, 42] };
const failedReport = { number: 60, state: 'OPEN', createdAt: '2026-10-05T18:51:42Z', title: 'QA не виконано: #41, #42' };

const HIRE = (provider, model) => `^office-workers hire --provider ${provider} --model ${model.replace(/\//g, '\\/')} `;
const scenarios = [
  // ── Coders by difficulty ──
  { name: 'easy, усі вільні → Zen: opencode/big-pickle без --effort, порти 7780/3003',
    fx: { workers: [me], issues: [issue(30, ['easy', 'P1-high'])], state: st() },
    want: [`${HIRE('opencode', 'opencode/big-pickle')}--json --issue 30 <<.*бек 7780, фронт 3003, база \`Edelweiss_zen\``], not: ['--effort  ', 'opencode.*--effort'] },
  { name: 'medium P0 і easy → Codex бере medium, Zen бере easy',
    fx: { workers: [me], issues: [issue(31, ['medium', 'P0-critical']), issue(30, ['easy', 'P1-high'])], state: st() },
    want: [`${HIRE('codex', 'gpt-5.6-terra')}--effort high --json --issue 31`, `${HIRE('opencode', 'opencode/big-pickle')}--json --issue 30`] },
  { name: 'два medium, Codex на паузі → Zen бере P0',
    fx: { workers: [me], issues: [issue(31, ['medium', 'P2-medium']), issue(33, ['medium', 'P0-critical'])], state: st({ paused: { codex: later } }) },
    want: [`${HIRE('opencode', 'opencode/big-pickle')}--json --issue 33`], not: ['--provider codex'] },
  { name: 'hard, medium, easy, Codex на паузі → Opus hard, Zen medium P1, Nemotron easy P2',
    fx: { workers: [me], issues: [issue(32, ['hard']), issue(31, ['medium', 'P1-high']), issue(30, ['easy', 'P2-medium'])], state: st({ paused: { codex: later } }) },
    want: [`${HIRE('claude', 'opus')}--effort high --json --issue 32`, `${HIRE('opencode', 'opencode/big-pickle')}--json --issue 31`, `${HIRE('opencode', 'opencode/nemotron-3-ultra-free')}--json --issue 30`] },
  { name: 'два easy → Zen бере важливіше, Nemotron друге, на портах 7781/3005',
    fx: { workers: [me], issues: [issue(30, ['easy', 'P2-medium']), issue(34, ['easy', 'P1-high'])], state: st() },
    want: [`${HIRE('opencode', 'opencode/big-pickle')}--json --issue 34`, `${HIRE('opencode', 'opencode/nemotron-3-ultra-free')}--json --issue 30 <<.*бек 7781, фронт 3005, база \`Edelweiss_nemotron\``] },
  { name: 'P0 «Залежить від #90», а #90 відкрите → Zen бере P2, яке ні від чого не залежить',
    fx: { workers: [me], issues: [{ ...issue(91, ['easy', 'P0-critical']), body: 'Що зробити…\n\nЗалежить від #90.' }, issue(92, ['easy', 'P2-medium']), { ...issue(90, ['hard', 'P1-high']), labels: [{ name: 'manual' }] }], state: st() },
    want: [`${HIRE('opencode', 'opencode/big-pickle')}--json --issue 92`], not: ['--issue 91'] },
  { name: '«Залежить від #90, #93», обидва вже закриті → бере',
    fx: { workers: [me], issues: [{ ...issue(91, ['easy', 'P0-critical']), body: '- Залежить від #90, #93' }], state: st() },
    want: [`${HIRE('opencode', 'opencode/big-pickle')}--json --issue 91`] },
  { name: 'чуже issue з P0 без agent → не брати', fx: { workers: [me], issues: [{ ...issue(40, ['P0-critical'], 'stranger'), labels: [{ name: 'P0-critical' }] }], state: st() }, not: ['hire'] },
  { name: 'issue з manual → не брати', fx: { workers: [me], issues: [issue(41, ['manual', 'easy'])], state: st() }, not: ['hire'] },
  // ── Pull requests ──
  { name: 'червоний CI у PR від Zen → повернути автору з портами 7780/3003',
    fx: { workers: [me, { name: 'Zed', id: 'w-z', kind: 'agent', provider: 'opencode', status: 'idle', pr: { number: 50 } }], pulls: [pr({ statusCheckRollup: red })], issues: [], state: st() },
    want: ['^office-workers tell Zed <<.*бек 7780, фронт 3003'] },
  { name: 'червоний CI у PR, issue якого робив Nemotron → автору з портами Nemotron 7781/3005, а не Zen',
    fx: { workers: [me, { name: 'Nemo', id: 'w-n', kind: 'agent', provider: 'opencode', status: 'idle', pr: { number: 50 } }], pulls: [pr({ statusCheckRollup: red })], issues: [issue(70, ['easy'])],
      state: st({ issues: { 70: { lastJob: { kind: 'code', coder: 'nemotron', provider: 'opencode', worker: 'Nemo', workerId: 'w-n', since: 0, ended: 1 }, checked: true } } }) },
    want: ['^office-workers tell Nemo <<.*бек 7781, фронт 3005'], state: (s) => s.prs[50].coder === 'nemotron' },
  { name: 'червоний CI у PR агента на nemotron, issue конвеєр не памʼятає → кодер за моделлю автора',
    fx: { workers: [me, { name: 'Nemo', id: 'w-n', kind: 'agent', provider: 'opencode', model: 'opencode/nemotron-3-ultra-free', status: 'idle', pr: { number: 50 } }], pulls: [pr({ statusCheckRollup: red })], issues: [], state: st() },
    want: ['^office-workers tell Nemo <<.*бек 7781, фронт 3005'] },
  { name: "зелений CI без вердикту → рев'юер Opus у основній копії",
    fx: { workers: [me], pulls: [pr()], issues: [], state: st() }, want: [`${HIRE('claude', 'opus')}--effort high --json --no-worktree`] },
  { name: "зелений CI без вердикту, задача easy → рев'юер Sonnet",
    fx: { workers: [me], pulls: [pr()], issues: [issue(70, ['easy'])], state: st() },
    want: [`${HIRE('claude', 'sonnet')}--effort medium --json --no-worktree`], not: ['--model opus'] },
  { name: 'approve на поточному коміті → мердж', fx: { workers: [me], pulls: [pr()], issues: [], comments: verdict('approve'), state: st() }, want: ['^gh pr merge 50 '] },
  { name: 'два PR з approve в одному кроці → мерджимо лише старший, другий після оновлення гілки',
    fx: { workers: [me], pulls: [pr(), pr({ number: 51, url: 'u51', body: 'Closes #71', headRefName: 'office/y' })], issues: [],
      comments: { ...verdict('approve'), 51: verdict('approve')[50] }, state: st() },
    want: ['^gh pr merge 50 '], not: ['^gh pr merge 51 '], state: (s) => !s.prs[51]?.mergeFailures },
  { name: 'changes, автор вільний → повернути автору',
    fx: { workers: [me, { name: 'Opie', id: 'w-o', kind: 'agent', provider: 'claude', status: 'idle', pr: { number: 50 } }], pulls: [pr()], issues: [], comments: verdict('changes'), state: st({ prs: { 50: { reviewRounds: 1 } } }) },
    want: ['^office-workers tell Opie <<Доопрацюй PR #50'] },
  { name: 'approve, 700 рядків коду → needs-human',
    fx: { workers: [me], pulls: [pr({ additions: 600, deletions: 100, files: [{ path: 'internet_shop-front-/a.tsx', additions: 600, deletions: 100 }] })], issues: [], comments: verdict('approve'), state: st() },
    want: ['^gh pr edit 50 .*--add-label needs-human'], not: ['^gh pr merge'] },
  { name: 'approve, 30 рядків коду + 4000 у package-lock.json → мердж',
    fx: { workers: [me], pulls: [pr({ files: [{ path: 'internet_shop-back-/package.json', additions: 20, deletions: 10 }, { path: 'internet_shop-back-/package-lock.json', additions: 2000, deletions: 2000 }] })], issues: [], comments: verdict('approve'), state: st() },
    want: ['^gh pr merge 50 '] },
  { name: 'approve, PR змінює opencode.json → needs-human',
    fx: { workers: [me], pulls: [pr({ files: [{ path: 'opencode.json', additions: 2, deletions: 1 }] })], issues: [], comments: verdict('approve'), state: st() },
    want: ['^gh pr edit 50 .*needs-human'], not: ['^gh pr merge'] },
  { name: 'конфлікт, автор вільний, офіс не знає його PR → повернути автору, знайденому за гілкою',
    fx: { workers: [me, { name: 'Bolt', id: 'w-b', kind: 'agent', provider: 'opencode', status: 'idle', worktree: { branch: 'office/x' } }], pulls: [pr({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })], issues: [], state: st() },
    want: ['^office-workers tell Bolt <<Доопрацюй PR #50.*конфлікт із main'], not: ['^office-workers hire'] },
  { name: 'конфлікт, доопрацювання перервалося й PR не змінився → ще раз, новому агенту, без нового кола',
    fx: { workers: [me, { name: 'Bolt', id: 'w-b', kind: 'agent', provider: 'opencode', status: 'idle', worktree: { branch: 'office/x' } }], pulls: [pr({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })], issues: [],
      state: st({ prs: { 50: { coder: 'zen', fixRounds: 1, fixFor: `conflict@${HEAD}` } } }) },
    want: [`${HIRE('opencode', 'opencode/big-pickle')}--json <<Доопрацюй PR #50.*конфлікт із main.*минулого разу`], not: ['needs-human', '^office-workers tell'],
    state: (s) => s.prs[50].fixRetried === `conflict@${HEAD}` && s.prs[50].fixRounds === 1 && s.prs[50].job?.worker === 'Hired' },
  { name: 'і після другої спроби PR не змінився → needs-human',
    fx: { workers: [me], pulls: [pr({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })], issues: [],
      state: st({ prs: { 50: { coder: 'zen', fixRounds: 1, fixFor: `conflict@${HEAD}`, fixRetried: `conflict@${HEAD}` } } }) },
    want: ['^gh pr edit 50 .*--add-label needs-human'], not: ['^office-workers (tell|hire)'] },
  { name: "рев'юер закінчив без вердикту → ще один рев'юер, коло не рахується",
    fx: { workers: [me], pulls: [pr()], issues: [], state: st({ prs: { 50: { reviewRounds: 1, reviewedSha: HEAD } } }) },
    want: [`${HIRE('claude', 'opus')}--effort high --json --no-worktree`], not: ['needs-human'],
    state: (s) => s.prs[50].reviewRetried === HEAD && s.prs[50].reviewRounds === 1 },
  { name: "і другий без вердикту → needs-human",
    fx: { workers: [me], pulls: [pr()], issues: [], state: st({ prs: { 50: { reviewRounds: 1, reviewedSha: HEAD, reviewRetried: HEAD } } }) },
    want: ['^gh pr edit 50 .*--add-label needs-human'], not: ['^office-workers hire'] },
  // ── Going home ──
  { name: 'Codex, чий PR офіс не знає, вийшов і без роботи → додому',
    fx: { workers: [me, { name: 'Cosmo', id: 'w-c', kind: 'agent', provider: 'codex', status: 'exited', hiredBy: me.name, worktree: '.agent-office/worktrees/cosmo-f1fb' }], issues: [], state: st() },
    want: ['^office-workers home Cosmo '] },
  { name: 'автор відкритого PR (знайдено за гілкою), вільний → лишається для доопрацювань',
    fx: { workers: [me, { name: 'Cosmo', id: 'w-c', kind: 'agent', provider: 'codex', status: 'idle', hiredBy: me.name, worktree: { branch: 'office/cosmo-x' } }], pulls: [pr({ headRefName: 'office/cosmo-x' })], issues: [], state: st() },
    not: ['^office-workers home Cosmo'] },
  { name: 'агент зі змердженим PR → додому',
    fx: { workers: [me, { name: 'Opie', id: 'w-o', kind: 'agent', provider: 'claude', status: 'idle', hiredBy: me.name, merged: true, pr: { number: 49, state: 'MERGED' } }], issues: [], state: st() },
    want: ['^office-workers home Opie '] },
  { name: "рев'юер закінчив → додому рівно один раз",
    fx: { workers: [me, { name: 'Rev', id: 'w-r', kind: 'agent', provider: 'claude', status: 'idle', hiredBy: me.name }], pulls: [pr()], issues: [], comments: verdict('approve'),
      state: st({ prs: { 50: { reviewRounds: 1, reviewedSha: HEAD, job: { kind: 'review', provider: 'claude', worker: 'Rev', workerId: 'w-r', since: 0 } } } }) },
    once: ['^office-workers home Rev '] },
  { name: 'агент, який зараз на задачі конвеєра → не чіпати',
    fx: { workers: [me, { name: 'Zed', id: 'w-z', kind: 'agent', provider: 'opencode', status: 'idle', hiredBy: me.name }], issues: [issue(17, ['easy'])],
      state: st({ issues: { 17: { job: { kind: 'code', coder: 'zen', provider: 'opencode', worker: 'Zed', workerId: 'w-z', since: Date.now() } } } }) },
    not: ['^office-workers home Zed'] },
  { name: 'чужий агент (найняв не конвеєр) → не чіпати',
    fx: { workers: [me, { name: 'Mine', id: 'w-m', kind: 'agent', provider: 'claude', status: 'idle', hiredBy: 'Pavlo' }], issues: [], state: st() },
    not: ['^office-workers home Mine'] },
  { name: 'QA, якого будили після ліміту, лишив звіт до пробудження → звіт знайдено, закрито, PR не повторюються',
    fx: { workers: [me, { name: 'Quinn', id: 'w-q', kind: 'agent', provider: 'claude', status: 'idle', hiredBy: me.name }], issues: [],
      qaReports: [{ number: 59, state: 'OPEN', createdAt: '2026-10-05T18:51:42Z' }],
      state: st({ qa: { since: '2026-10-05T09:00:00Z', job: { kind: 'qa', provider: 'claude', worker: 'Quinn', workerId: 'w-q', since: Date.parse('2026-10-05T18:43:46Z'), wokenAt: Date.now() - 5 * 60_000, until: '2026-10-05T18:30:00Z', prs: [41, 42] } } }) },
    want: ['^gh issue close 59 '], state: (s) => s.qa.since === '2026-10-05T18:30:00Z' && !s.qa.retried },
  // ── Limits ──
  { name: 'Codex завис на меню після ліміту → додому, codex на паузі до 3.11, #27 одразу бере Zen',
    fx: { workers: [me, { name: 'Byte', id: 'w-b', kind: 'agent', provider: 'codex', status: 'working' }], issues: [issue(27, ['medium'])], scrollback: { 'w-b': CODEX_LIMIT },
      state: st({ issues: { 27: { job: { kind: 'code', coder: 'codex', provider: 'codex', worker: 'Byte', workerId: 'w-b', since: 0 } } } }) },
    want: ['^office-workers home Byte ', `${HIRE('opencode', 'opencode/big-pickle')}--json --issue 27`], state: (s) => s.paused.codex === new Date(2026, 10, 3, 20, 0).getTime() && s.issues[27]?.job?.coder === 'zen' },
  { name: 'Claude: «hit your session limit · resets <за 2 год>» → пауза claude до цього часу, задача чекає того ж агента',
    fx: { workers: [me, cosmo('idle')], issues: [], scrollback: { 'w-c': hitLimit(NOW + 120 * MIN) }, state: st(coding()) },
    not: ['^office-workers (home|tell)'], state: (s) => s.paused.claude === minute(NOW + 120 * MIN) && s.issues[94]?.job?.limited },
  { name: 'Claude: «hit your weekly limit · resets <годину тому>» → це завтра, агент додому, задача в чергу',
    fx: { workers: [me, cosmo('idle')], issues: [], scrollback: { 'w-c': claudeLimit(NOW - 60 * MIN, 'weekly') }, state: st(coding()) },
    want: ['^office-workers home Cosmo '], state: (s) => s.paused.claude === tomorrow(minute(NOW - 60 * MIN)) && !s.issues[94]?.job },
  { name: 'пауза claude скінчилась → будимо агента й памʼятаємо, після якого скидання',
    fx: { workers: [me, cosmo('idle')], issues: [], state: st({ paused: { claude: minute(NOW - MIN) }, ...coding({ limited: true }) }) },
    once: ['^office-workers tell Cosmo <<Ліміт використання мав відновитися'], state: (s) => !s.paused.claude && s.issues[94]?.job?.wokeFor === minute(NOW - MIN) },
  { name: 'після пробудження на екрані старе «resets <5 хв тому>», агент працює → без паузи, не чіпати',
    fx: { workers: [me, cosmo('working')], issues: [], scrollback: { 'w-c': claudeLimit(NOW - 5 * MIN) }, state: st(coding({ wokeFor: minute(NOW - 5 * MIN), wokenAt: NOW - 2 * MIN })) },
    not: ['^office-workers (home|tell)'], state: (s) => !s.paused.claude && s.issues[94]?.job && !s.issues[94]?.job.limited },
  { name: 'після пробудження на екрані старе «hit your weekly limit · resets <5 хв тому>» → не завтрашній ліміт, без паузи',
    fx: { workers: [me, cosmo('working')], issues: [], scrollback: { 'w-c': claudeLimit(NOW - 5 * MIN, 'weekly') }, state: st(coding({ wokeFor: minute(NOW - 5 * MIN), wokenAt: NOW - 2 * MIN })) },
    not: ['^office-workers (home|tell)'], state: (s) => !s.paused.claude && s.issues[94]?.job },
  { name: 'агент зупинився на старому «resets <5 хв тому>» → один раз попросити продовжити, без паузи',
    fx: { workers: [me, cosmo('idle')], issues: [], scrollback: { 'w-c': claudeLimit(NOW - 5 * MIN) }, state: st(coding()) },
    once: ['^office-workers tell Cosmo <<Ліміт використання мав відновитися'], state: (s) => !s.paused.claude && s.issues[94]?.job?.nudgedFor === minute(NOW - 5 * MIN) },
  { name: 'після цього знову стоїть на тому ж старому повідомленні → без паузи й без другого прохання, задача закінчена',
    fx: { workers: [me, cosmo('idle')], issues: [], scrollback: { 'w-c': claudeLimit(NOW - 5 * MIN) }, state: st(coding({ nudgedFor: minute(NOW - 5 * MIN) })) },
    not: ['^office-workers tell'], state: (s) => !s.paused.claude && !s.issues[94]?.job },
  // ── QA ──
  { name: '10 мерджів коду → QA на Sonnet, порти 7779/3002',
    fx: { workers: [me], issues: [], merged: Array.from({ length: 10 }, (_, i) => app(100 + i, i)), state: st() },
    want: [`${HIRE('claude', 'sonnet')}--effort medium --json <<.*`] },
  { name: '2 свіжі мерджі, а робити більше нічого → QA чекає, поки набереться 10',
    fx: { workers: [me], issues: [], merged: [recent(110, 90), recent(111, 30)], state: st() },
    not: ['^office-workers hire'] },
  { name: 'найстаріший неперевірений мердж чекає понад добу → QA перевіряє ті 2, що є',
    fx: { workers: [me], issues: [], merged: [recent(110, 25 * 60), recent(111, 30)], state: st() },
    want: [`${HIRE('claude', 'sonnet')}--effort medium --json <<.*#110.*#111`] },
  { name: 'QA не зміг запустити магазин (звіт «QA не виконано») → звіт закрити, ці PR перевірити ще раз',
    fx: { workers: [me, quinn], issues: [], qaReports: [failedReport], state: st({ qa: { since: '2026-10-05T09:00:00Z', job: qaJob } }) },
    want: ['^gh issue close 60 '], not: ['Потрібна людина'], state: (s) => s.qa.since === '2026-10-05T09:00:00Z' && s.qa.retried === true },
  { name: 'і вдруге «QA не виконано» → PR лишаються неперевіреними, сповіщення для людини',
    fx: { workers: [me, quinn], issues: [], qaReports: [failedReport], state: st({ qa: { since: '2026-10-05T09:00:00Z', retried: true, job: qaJob } }) },
    want: ['^osascript .*Потрібна людина QA: QA вдруге не зміг запустити магазин'], state: (s) => s.qa.since === '2026-10-05T18:30:00Z' && !s.qa.retried },
  // ── Docker ──
  { name: 'Docker не працює, є задача → відкрити Docker Desktop, кодера не наймати, без сповіщення',
    fx: { workers: [me], issues: [issue(30, ['easy'])], docker: 'down', state: st() },
    want: ['^docker compose up --detach --wait db', '^open -g -a Docker'], not: ['^office-workers hire', '^osascript'],
    state: (s) => s.docker?.opened === true && !s.docker.told },
  { name: 'Docker відкрили 10 хв тому, а він не працює → одне сповіщення, Docker удруге не відкривати',
    fx: { workers: [me], issues: [issue(30, ['easy'])], docker: 'down', state: st({ docker: { since: NOW - 10 * MIN, opened: true } }) },
    want: ['^osascript .*Docker або база не працює'], not: ['^office-workers hire', '^open '], state: (s) => s.docker?.told === true },
  { name: 'і далі не працює → без нових сповіщень',
    fx: { workers: [me], issues: [issue(30, ['easy'])], docker: 'down', state: st({ docker: { since: NOW - 20 * MIN, opened: true, told: true } }) },
    not: ['^office-workers hire', '^open ', '^osascript'] },
  { name: 'Docker запрацював → кодера наймаємо, стан Docker забуто',
    fx: { workers: [me], issues: [issue(30, ['easy'])], state: st({ docker: { since: NOW - 20 * MIN, opened: true, told: true } }) },
    want: [`${HIRE('opencode', 'opencode/big-pickle')}--json --issue 30`], state: (s) => !s.docker },
  { name: 'Docker працює, а база не піднімається → одразу сповіщення з помилкою, Docker не відкривати',
    fx: { workers: [me], issues: [issue(30, ['easy'])], docker: 'broken', state: st() },
    want: ['^osascript .*is unhealthy'], not: ['^office-workers hire', '^open '] },
  { name: 'порт бази зайняв контейнер з worktree агента → це теж база, кодера наймаємо',
    fx: { workers: [me], issues: [issue(30, ['easy'])], docker: 'taken', state: st() },
    want: [`${HIRE('opencode', 'opencode/big-pickle')}--json --issue 30`], not: ['^osascript', '^open '], state: (s) => !s.docker },
  { name: "Docker не працює, а треба лише рев'ю → рев'юер працює, Docker не чіпаємо",
    fx: { workers: [me], pulls: [pr()], issues: [], docker: 'down', state: st() },
    want: [`${HIRE('claude', 'opus')}--effort high --json --no-worktree`], not: ['^docker ', '^open '] },
  { name: 'червоний CI, а Docker не працює → доопрацювання чекає на базу',
    fx: { workers: [me, { name: 'Zed', id: 'w-z', kind: 'agent', provider: 'opencode', status: 'idle', pr: { number: 50 } }], pulls: [pr({ statusCheckRollup: red })], issues: [], docker: 'down', state: st() },
    want: ['^open -g -a Docker'], not: ['^office-workers (tell|hire)'] },
  { name: '10 мерджів, а Docker не працює → QA чекає на базу',
    fx: { workers: [me], issues: [], merged: Array.from({ length: 10 }, (_, i) => app(100 + i, i)), docker: 'down', state: st() },
    want: ['^open -g -a Docker'], not: ['^office-workers hire'] },
  { name: 'наймати нікого → Docker не перевіряємо',
    fx: { workers: [me], issues: [], state: st() }, not: ['^docker ', '^open '] },
];

let failed = 0;
for (const sc of scenarios) {
  writeFileSync(stPath, JSON.stringify(sc.fx.state));
  for (const [id, text] of Object.entries(sc.fx.scrollback ?? {})) writeFileSync(`${SB}/${id}.ansi`, text);
  writeFileSync(`${T}/fixture.json`, JSON.stringify({ pulls: [], ...sc.fx }));
  writeFileSync(`${T}/calls.jsonl`, '');
  let crash = '';
  try {
    execFileSync('node', [`${T}/root/tools/conveyor/conveyor.mjs`, '--once'], { env: { ...process.env, PATH: `${T}/bin:${process.env.PATH}`, AGENT_OFFICE_WORKER_ID: 'me', AGENT_OFFICE_HOOK_URL: 'x', FIXTURE: `${T}/fixture.json`, CALLS: `${T}/calls.jsonl` }, encoding: 'utf8' });
  } catch (e) { crash = String(e.stderr || e.message).split('\n')[0]; }
  for (const id of Object.keys(sc.fx.scrollback ?? {})) rmSync(`${SB}/${id}.ansi`);
  const lines = readFileSync(`${T}/calls.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((c) => !(c.tool === 'gh' && ['list', 'view', 'user'].includes(c.args[1])) && !(c.tool === 'gh' && c.args[0] === 'api') && !(c.tool === 'office-workers' && c.args[0] === 'list'))
    .map((c) => `${c.tool} ${c.args.join(' ')}${c.input ? ` <<${c.input.replace(/\n/g, ' ')}` : ''}`);
  const problems = [];
  if (crash) problems.push(`CRASH ${crash}`);
  for (const w of sc.want ?? []) if (!lines.some((l) => new RegExp(w).test(l))) problems.push(`немає виклику /${w}/`);
  for (const n of sc.not ?? []) if (lines.some((l) => new RegExp(n).test(l))) problems.push(`зайвий виклик /${n}/`);
  for (const o of sc.once ?? []) {
    const count = lines.filter((l) => new RegExp(o).test(l)).length;
    if (count !== 1) problems.push(`/${o}/ викликано ${count} разів замість одного`);
  }
  if (sc.want === undefined && sc.not === undefined && sc.once === undefined) problems.push('сценарій без очікувань');
  const after = existsSync(stPath) ? JSON.parse(readFileSync(stPath, 'utf8')) : {};
  if (sc.want?.length === 0) problems.push('порожній want');
  if (sc.state && !sc.state(after)) problems.push(`стан не той: ${JSON.stringify({ paused: after.paused, issues: after.issues })}`);
  if (problems.length) failed++;
  console.log(`${problems.length ? '✗' : '✓'} ${sc.name}${problems.length ? `\n    ${problems.join('\n    ')}\n    виклики: ${lines.map((l) => l.slice(0, 140)).join('\n             ') || '(нічого)'}` : ''}`);
}
rmSync(T, { recursive: true, force: true });
console.log(`\n${scenarios.length - failed}/${scenarios.length} сценаріїв пройшли`);
process.exit(failed ? 1 : 0);
