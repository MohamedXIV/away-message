import { spawnSync } from 'node:child_process';
import process from 'node:process';

const EXPECTED_FAILURES = new Set([
  'tests/unit/WorldScenes.test.ts > 2D World Scenes, Atmosphere, Interactables & App Integration > 4. Simulation Engine Room Action Integration > executes tea interaction (advances 6m, restores 5 energy)',
  'tests/unit/WorldScenes.test.ts > 2D World Scenes, Atmosphere, Interactables & App Integration > 4. Simulation Engine Room Action Integration > executes instant noodles meal (advances 15m, restores 15 energy)',
  'tests/unit/WorldScenes.test.ts > 2D World Scenes, Atmosphere, Interactables & App Integration > 4. Simulation Engine Room Action Integration > executes window observation (advances 4m, logs telemetry)',
]);

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

  if (exitCode === 0) {
    return {
      ok: false,
      message: 'Vitest is now fully green; remove/update the documented WorldScenes baseline before accepting this result.',
    };
  }

  if (failures.length !== EXPECTED_FAILURES.size || actual.size !== EXPECTED_FAILURES.size) {
    return {
      ok: false,
      message: `Expected exactly ${EXPECTED_FAILURES.size} known failures, observed ${failures.length}.`,
    };
  }

  const missing = [...EXPECTED_FAILURES].filter((name) => !actual.has(name));
  const unexpected = [...actual].filter((name) => !EXPECTED_FAILURES.has(name));

  if (missing.length || unexpected.length) {
    return {
      ok: false,
      message: [
        missing.length ? `Missing expected failures:\n- ${missing.join('\n- ')}` : '',
        unexpected.length ? `Unexpected failures:\n- ${unexpected.join('\n- ')}` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  return {
    ok: true,
    message: `Vitest matched the exact known WorldScenes baseline (${EXPECTED_FAILURES.size} failures); no additional failures were observed.`,
  };
}

function runSelfTest() {
  const exact = [...EXPECTED_FAILURES].map((name) => ` FAIL  ${name}`).join('\n');
  const extra = `${exact}\n FAIL  tests/unit/NewRegression.test.ts > rejects broken behavior`;
  const missing = [...EXPECTED_FAILURES].slice(0, 2).map((name) => ` FAIL  ${name}`).join('\n');

  const cases = [
    ['accepts the exact baseline', verifyFailureBaseline(exact, 1).ok === true],
    ['rejects an additional failure', verifyFailureBaseline(extra, 1).ok === false],
    ['rejects a missing baseline failure', verifyFailureBaseline(missing, 1).ok === false],
    ['rejects an unexpectedly green suite until docs/gate are updated', verifyFailureBaseline('', 0).ok === false],
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
