import { spawnSync } from 'node:child_process';
import process from 'node:process';

// The WorldScenes room-action baseline is fully green since the
// PLAYER_INTERACT_ROOM stale-snapshot fix (trailing notifySubscribers).
// This guard now accepts only a completely green suite and rejects any failure.
const EXPECTED_FAILURES = new Set([]);

const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export function extractFailures(output) {
  const plain = output.replace(ANSI_ESCAPE, '');
  const failures = [];

  for (const line of plain.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('FAIL  ')) continue;
    failures.push(trimmed.slice('FAIL  '.length));
  }

  return failures;
}

export function verifyFailureBaseline(output, exitCode) {
  const failures = extractFailures(output);
  const actual = new Set(failures);

  if (failures.length === 0 && exitCode === 0) {
    return {
      ok: true,
      message: 'Vitest is fully green; no baseline failures remain.',
    };
  }

  if (failures.length === 0) {
    return {
      ok: false,
      message: `Vitest reported no failures but exited with code ${exitCode}; investigate the runner error.`,
    };
  }

  const unexpected = [...actual].filter((name) => !EXPECTED_FAILURES.has(name));

  return {
    ok: false,
    message: `Expected a fully green suite, observed ${failures.length} failure(s):\n- ${[...actual].join('\n- ')}`,
  };
}

function runSelfTest() {
  const failure = ' FAIL  tests/unit/NewRegression.test.ts > rejects broken behavior';

  const cases = [
    ['accepts a fully green suite', verifyFailureBaseline('', 0).ok === true],
    ['rejects any failure', verifyFailureBaseline(failure, 1).ok === false],
    ['rejects a nonzero exit without failures', verifyFailureBaseline('', 1).ok === false],
  ];

  const failed = cases.filter(([, ok]) => !ok);
  for (const [name, ok] of cases) {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  }

  if (failed.length) process.exit(1);
}

function runVitest() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', 'test'], {
    encoding: 'utf8',
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);

  if (result.error) {
    console.error(`Unable to execute Vitest: ${result.error.message}`);
    process.exit(1);
  }

  const verification = verifyFailureBaseline(output, result.status ?? 1);
  console.log(`\n${verification.message}`);
  process.exit(verification.ok ? 0 : 1);
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  runVitest();
}
