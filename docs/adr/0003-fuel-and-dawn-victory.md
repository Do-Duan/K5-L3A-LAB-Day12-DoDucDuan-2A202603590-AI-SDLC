# ADR-0003: Fuelled lanterns and dawn victory

**Status:** accepted for Phase 3 (Ticket-03)

## Context

Ticket-03 replaces permanent lighting and immediate all-lit victory. Lanterns lose fuel, shades can drain low-fuel lights, and the player must keep enough lanterns lit until dawn.

## Decision

- Store fuel as integer sixtieths (`fuelTicks`, 6000 ticks = 100 fuel) for deterministic decay and drain.
- Keep `ever_lit` and `relit_count` separate from current `lit`/fuel. Extinguishing resets fuel and deposited progress but preserves history.
- Select the nearest eligible lantern for interaction, with numeric lantern id as tie-break. First-light cost is 10 motes; relight cost is 5.
- Remove early victory. Resolve zero flames before dawn; dawn victory requires `ceil(0.6 * lantern_count)` currently lit.
- Award points on the corresponding action; dawn score uses each currently lit lantern's integer fuel floor.
- Keep non-conflicting Phase 1/2 mechanics. Replace assumptions/tests that required permanent lights or `all_lit` victory.

## Consequences

Snapshot fuel is one decimal place derived from integer ticks. Old expectations for `all_lit`, permanent fuel, early win, and prior score are superseded by v1.2. Durations were updated in the existing full-night fixtures; the reason is recorded in `CHANGELOG.md`.

## Temporary tuning assumptions

The Ticket-02 excerpt omitted its standard-number table. Those assumptions remain in `docs/phase-2-spec.md`; Phase 3's 240/270/300-second durations come directly from Ticket-03.
