# ADR-003: Lantern fuel model and "survive until dawn" win rule (Phase 3)

Status: accepted · Contract: v1.2 · Source: Ticket-03

## Context
Lanterns were a boolean (`lit`) and the Night ended as soon as all were lit. Ticket-03 makes lit lanterns decay, lets them be refuelled/relit, lets Ink Shades drain them, and moves the win condition to "enough lanterns lit at dawn".

## Decisions
1. **Lantern state** is now `{lit, fuelU, deposited, ever_lit, relit_count}`.
   `fuelU` is an **integer in 1/60 fuel units** (100 fuel = 6000). Decay is exactly 1 unit/tick, drain 5 units/tick per shade, refuel +600 units per mote, so there is no float drift; values are only rounded (1 decimal) in snapshots/events.
   States: never lit → lit → out (`lit=false, ever_lit=true, deposited=0`) → relit (cost 5).
2. **Tick order** (`Simulation.step`): move/dash/jump → pulse → pickup → interact (light / relight / refuel) → **fuel step** (decay + drain, then `fuel<=0` lanterns go out, `lantern_out`) → shades (state machine) → charms/drifters/spawns/wind → `tick++`, time -1 tick → **win/lose check last**.
   Interaction is before the fuel step so a lantern at exactly 100 fuel is still "full" on that tick (a scenario-placed `fuel:100` lantern is not selectable on tick 1).
3. **Time** is an integer tick counter (`timeTicks`); `time` is derived. Dawn lands exactly on tick `duration*60`.
4. **Win/lose**: evaluated at dawn (except `no_flames`, which is immediate). `lit >= ceil(0.6*total)` → `won/dawn_survived`; otherwise `lost/dawn`. `no_flames` is raised the moment flames hit 0, so it beats dawn on the same tick. `all_lit` is gone.
5. **Shade AI** gained `drain`: `wander`/`spawning` shades pick the nearest lit lantern with `fuel<30` (tie → lower id), walk to it, and at ≤2 m stand still and drain 5/s. Lanterns with `fuel<30` lose their safe zone. Exits: chase (player ≤6 m), stunned (pulse; 15 pts), wander (lantern out / refuelled ≥30 / >2 m). Stun now ends in `wander`.
6. **Refuel push-out**: when a lantern goes from `<30` to `>=30` fuel (or is lit), shades within 6 m are pushed to the 6 m edge over ≤30 ticks and cannot hurt the player meanwhile.
7. **Capacity** `10 + 2*successful_lights` (max 20); resets each Night because it lives in the per-night `Simulation`; scenario-placed lanterns don't count.
8. **Score** replaced by the Ticket-03 table (see CHANGELOG). Time bonus removed.

## Assumptions / open questions
- Push-out follows the ticket literally: shades within **6 m** of the lantern are pushed to the 6 m edge (`REPEL_RADIUS`), independent of `safe_radius` (3 m, which only defines the no-chase zone).
- The Phase-2 shade AI has no real `wander` behaviour. Without a weak lantern, wander/spawning shades keep the old behaviour (walk toward the player, frozen inside a healthy lantern's safe zone), so Phase-2 behaviour is unchanged.
- Drifter-pulse score (+5) is not in the Ticket-03 table; since the table replaces the whole score formula, it was removed.
