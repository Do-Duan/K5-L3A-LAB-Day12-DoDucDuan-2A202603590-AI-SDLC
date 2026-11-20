# Changelog

## Phase 3 — Contract 1.2

Breaking changes:

- `contract_version` advances from 1.1 to 1.2; night durations are 240/270/300 seconds.
- Lanterns now expose `fuel`, `ever_lit`, and `relit_count`; they decay, may be refuelled, and can extinguish. The old permanent-lit rule is removed.
- Victory is no longer triggered by lighting every lantern. Dawn survival with at least 60% lit is required; `all_lit` is removed as a game-over reason.
- Score changes to mote deposit +5, first light +100, relight +40, pulse +5 (+15 for a draining shade), and dawn fuel/flame bonuses. The old time-left bonus is removed.
- Player capacity scales from 10 by two per successful light, capped at 20.
- New headless events: `refuel`, `lantern_out`, and periodic `fuel_drain`; `lantern_lit` includes `relight`.
- Colorblind palette setting is persisted.

Tests that expected early `all_lit` completion or never-expiring lanterns are superseded by `tests/phase3/` scenarios. Phase 2 feature scenarios remain applicable unless affected by updated durations/scoring.

The Phase 2 full-night JSONL evidence was regenerated at the Phase 3 durations (240/270/300 s); this updates test runtime bounds and expected dawn tick counts while preserving the scenarios. Permanent-light and early-win assertions are not retained because Ticket-03 explicitly replaces those rules.
