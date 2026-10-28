#!/usr/bin/env node
// The conveyor's way to Jules's API: node jules.mjs <key file> <GET|POST> <path>, with a JSON body on stdin for POST.
// Prints the reply; on an HTTP error exits 1 with "HTTP <status> <reason>". The key is read here, so it shows up in no
// command line, log or error message.
import { readFileSync } from 'node:fs';

const [keyFile, method, apiPath] = process.argv.slice(2);
const key = readFileSync(keyFile, 'utf8').trim();
let res;
try {
  res = await fetch(`https://jules.googleapis.com/v1alpha/${apiPath}`, {
    method,
    headers: { 'X-Goog-Api-Key': key, 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : readFileSync(0, 'utf8') || '{}',
    signal: AbortSignal.timeout(60_000),
  });
} catch (e) {
  process.stderr.write(`no answer from Jules: ${e.cause?.code ?? e.message}\n`);
  process.exit(1);
}
const text = await res.text();
if (!res.ok) {
  let reason = text.trim().split('\n')[0];
  try {
    const { status, message } = JSON.parse(text).error;
    reason = [status, message].filter(Boolean).join(' ');
  } catch {}
  process.stderr.write(`HTTP ${res.status} ${reason.slice(0, 300)}\n`);
  process.exit(1);
}
process.stdout.write(text || '{}');
