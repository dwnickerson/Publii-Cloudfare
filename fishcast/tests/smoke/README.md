# FishCast Smoke Test Suite (Authoritative)

This folder contains the **single authoritative smoke-test gate** for FishCast safety and correctness.

## Files

- `runSmokeTests.js`: entry-point runner for all safety invariants.
- `assert.js`: fail-fast assertion helpers used by all smoke checks.
- `scenarios/fixtures.js`: deterministic fixtures (no live API calls).

## How to run

```bash
node fishcast/tests/smoke/runSmokeTests.js
```

## Contract

- Deterministic only (fixtures + mocks).
- No network dependence.
- Any invariant failure exits non-zero with a clear reason.
- If this suite fails, FishCast is **not safe to ship**.
