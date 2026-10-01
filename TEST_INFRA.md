# E2E Test Infra: Away Message

## 1. Test Philosophy
- Opaque-box, requirement-driven.
- No internal mock shortcuts for domain logic.
- 4-Tier Test Architecture + Tier 5 Adversarial Coverage Hardening.

## 2. Feature Inventory Matrix
| # | Feature Domain | Requirement Source | Tier 1 (Coverage $\ge 5$) | Tier 2 (Boundaries $\ge 5$) | Tier 3 (Cross-Feature) | Tier 4 (Full Scenarios) |
|---|----------------|-------------------|:------------------------:|:--------------------------:|:----------------------:|:-----------------------:|
| 1 | Clock & Time Loop | docs/01, docs/05 | 5 tests | 5 tests | ✓ | ✓ |
| 2 | PC Hardware & OS Gating | docs/03, docs/05 | 5 tests | 5 tests | ✓ | ✓ |
| 3 | Downloads & VFS | docs/03, docs/05 | 5 tests | 5 tests | ✓ | ✓ |
| 4 | Software Registry & Installers | docs/03, docs/05 | 5 tests | 5 tests | ✓ | ✓ |
| 5 | Fake Internet (18 Sites) & Search | docs/04 | 5 tests | 5 tests | ✓ | ✓ |
| 6 | Social Schedules & Relationships | docs/01, docs/04 | 5 tests | 5 tests | ✓ | ✓ |
| 7 | Desktop OS & Window Manager | docs/02, docs/03 | 5 tests | 5 tests | ✓ | ✓ |
| 8 | Governed Narrative & Dynamic Social State | docs/00, docs/04, docs/06 | actor-generic tests | actor-generic tests | ✓ | ✓ |
| 9 | 2D Room & Interactables | docs/01, docs/02 | 5 tests | 5 tests | ✓ | ✓ |
| 10 | Dexie Persistence & Telemetry | docs/05, docs/07 | 5 tests | 5 tests | ✓ | ✓ |

## 3. Test Architecture
- **Unit/Integration Runner**: Vitest (`npm run test:unit`, `npm run test:integration`)
  - Testing pure TypeScript `SimulationEngine`, `GameClock`, `DownloadManager`, `FileSystemEngine`, `SoftwareRegistry`, `SocialEngine`, `SaveManager` (Dexie/fake-indexeddb).
- **E2E Runner**: Playwright (`npx playwright test`)
  - Testing full DOM / UI / Canvas / Audio / Network simulation via headless browser.
- **Directory Layout**:
  - `tests/unit/`
  - `tests/integration/`
  - `tests/e2e/tier1_features/`
  - `tests/e2e/tier2_boundaries/`
  - `tests/e2e/tier3_combinations/`
  - `tests/e2e/tier4_scenarios/`

## 4. Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Long-Running Sandbox Continuity | Residence, work, Pulse/social state, hardware/software progression, travel, optional encounters, persistence, and continued play over extended simulated time | High |
| 2 | Frugal Survival Path | Minimal tech spend, motel rent priority, alternate dialogue choices, economic resilience | High |
| 3 | Tech Enthusiast Speedrun | Rapid downloads, toolbar infection remediation via SafeSweep, terminal exploration, multiple browser rabbit holes | High |

## 5. Minimum Coverage Thresholds
- Tier 1: $\ge 50$ test cases across all features
- Tier 2: $\ge 50$ test cases covering boundary values, error conditions, and resource limits
- Tier 3: Pairwise combination suites covering major multi-subsystem interactions
- Tier 4: multiple long-running sandbox continuity scenarios with different casts, priorities, residences, and progression paths
