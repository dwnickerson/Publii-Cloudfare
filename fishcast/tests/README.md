# FishCast Tests

## Test types

- `fishcast/js/models/*.unit.test.js`: existing model unit tests.
- `fishcast/tests/*.test.js`: Node test runner suites.
- `fishcast/tests/smoke/`: authoritative smoke-test safety gate.
- `fishcast/tests/legacy/`: archived design-reference audit markdown reports (non-gating).

## Run tests

### Existing Node test suites

```bash
npm test
```

### Authoritative smoke suite

```bash
node fishcast/tests/smoke/runSmokeTests.js
```

## What the smoke suite protects

The smoke suite enforces production-safety invariants for:

- temperature unit correctness,
- timezone/now alignment,
- wind realism,
- trend smoothness,
- forecast score stability,
- UI view-model sanity (no DOM).

## Required execution points

Run the smoke suite:

- **before deploy**,
- **after any Codex edits** touching FishCast models/services/UI data flow,
- **before shipping forecast/scoring changes**.

FishCast is valid only when these smoke tests pass.
