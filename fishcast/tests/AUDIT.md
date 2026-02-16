# FishCast Audit Invariants

FishCast is valid ONLY if smoke tests pass.

## Invariant Matrix

1. **Unit sanity (C/F killer)**
   - Rule: For winter (Feb), if 7-day mean air temp is 45–55°F, estimated surface water temp must not exceed 60°F.
   - Smoke test: `A) Unit sanity (C/F killer)` in `smoke/runSmokeTests.js`.

2. **Time alignment correctness**
   - Rule: “Today” is API-timezone aligned (`timezone=auto`), not UTC-midnight slicing.
   - Rule: `nowHourIndex` aligns within ±2 hours of now.
   - Rule: `slice(0,n)` must not be treated as “now.”
   - Smoke test: `B) Time alignment correctness` in `smoke/runSmokeTests.js`.

3. **Wind realism**
   - Rule: High max wind must not always increase water temp.
   - Rule: Mean wind dominates max wind.
   - Rule: Wind-driven water-temp deltas >3°F fail.
   - Smoke test: `C) Wind realism` in `smoke/runSmokeTests.js`.

4. **Trend smoothness**
   - Rule: No cliff jumps from threshold artifacts.
   - Rule: Day-to-day water temp change stays smooth unless weather justifies otherwise.
   - Smoke test: `D) Trend smoothness` in `smoke/runSmokeTests.js`.

5. **Forecast score stability**
   - Rule: “Bad tomorrow” cannot jump to “100” without material changes (water temp, pressure/front, wind/cloud regime, or multiple user reports).
   - Smoke test: `E) Forecast score stability` in `smoke/runSmokeTests.js`.

6. **UI view-model sanity (no DOM)**
   - Rule: values sent to UI must be finite, non-null, non-NaN, and unit-consistent.
   - Rule: chart axis labels and units must exist.
   - Smoke test: `F) UI view-model sanity` in `smoke/runSmokeTests.js`.
