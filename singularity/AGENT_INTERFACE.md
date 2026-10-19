# Agent interface contract

Status: **implemented in-engine, not exposed over any transport.** No networking and no MCP server exist yet. This document
defines what a future LAN or MCP layer must wrap. Schema version: **1**.

## Principles

1. The Godot simulation (`RunSession`) is authoritative. An agent never changes state; it submits *requests* that may be rejected.
2. Humans, the in-engine conventional AI and external agents use the identical gateway: `RunSession.submit_command()`.
3. An agent controls exactly one actor, identified by `actor_id`, through a `controller_id` that owns it. Commands for any other
   actor are rejected with `not_owner`.
4. Agents cannot alter stats, invent abilities, spawn rewards or see hidden information. Observations are bounded by the
   controller's `AgentCapabilityProfile`.
5. Agent decision quality and character power are separate. Limit an agent with its profile (visibility, cadence, allowed
   commands, rate), never by silently changing character stats.

## The two calls

```gdscript
var external := ExternalAgentController.new()
session.attach_controller(external, actor, controller_id, Catalog.get_agent_profile(&"external_default"))

var observation: Dictionary = external.get_observation()           # read-only snapshot
var result: Dictionary = external.submit_command_dict({...})       # {"accepted": bool, "reason": "...", "message": "...", "detail": {}}
```

`ExternalAgentController` (`scripts/core/external_agent_controller.gd`) is the stub a transport would hold one of per remote
agent. `tools/dump_observation.tscn` prints a real observation and sample results.

## Time model

A command is validated and applied synchronously when submitted; its effects (movement, projectiles, cooldowns) then play out over
subsequent simulation steps, which run at the engine's physics rate (60 Hz by default). `observation.tick` and `observation.time_seconds` identify the snapshot. Movement is a persistent **intent**: a `move` command
sets a direction that lapses after 0.6 s unless refreshed, so a stalled agent stops instead of running forever. Aim and attacks are
instantaneous requests. Decision cadence is set by `decision_interval` (external default 0.5 s); the engine does not enforce it, but
`max_commands_per_second` (default 12) is a hard, token-bucket limit.

Level-up pauses: in the solo prototype the *human's* level-up pauses the world; AI and external agents never pause it and resolve
their own level-ups with `select_upgrade`. The multiplayer pause policy is an open design decision.

## Commands

All commands are JSON objects. Unknown fields are ignored. Numbers must be finite and within +/-5000. Coordinates are world
`[x, z]` metres on the ground plane (y is implied). Parsing is `ActionCommand.parse()`; malformed input yields `invalid_params`.

| `type` | Fields | Effect |
|---|---|---|
| `move` | `direction: [x, z]` (clamped to length 1) | Sets movement intent. `[0,0]` stops. |
| `aim` | `point: [x, z]` | Faces and aims at a point. |
| `attack` | optional `target_id`, optional `point` | Fires the primary attack at the target, else the point, else the current aim. |
| `use_ability` | `slot` 1, 2 or 3 (3 = equipment item); optional `target_id`, `point` | Uses an ability. Pulses and guard ignore the aim. |
| `interact` | `target_id` (an interactable id) | Opens a chest within `interact_range` (3.2 m). |
| `select_upgrade` | `choice_index` | Resolves the oldest pending level-up using `self.pending_upgrade_choices`. |

Rejection reasons (`result.reason`): `unknown_actor`, `actor_dead`, `not_owner`, `command_not_allowed` (profile forbids it),
`invalid_params`, `on_cooldown`, `out_of_range`, `no_pending_upgrade`, `bad_choice`, `rate_limited`, `no_such_ability`, `no_target`,
`run_not_active`. Validation (`CommandValidator`) checks, in order: run active, actor exists and alive, ownership, profile allows the
command type, rate limit, then command-specific rules (cooldown ready, target alive and hostile, slot valid, chest in range, choice
index valid). Validation never mutates state.

Example:

```json
{"type": "attack", "target_id": 16}
{"type": "use_ability", "slot": 2, "point": [-5.4, 2.3]}
{"type": "select_upgrade", "choice_index": 1}
```

Not yet implemented (extension points): `order` commands for commanding allied agents from a tactical overview (today stance is set
by the human through the UI), and memory read/write. `AgentCapabilityProfile.memory_scopes` reserves the three scopes in the GDD
(immediate, tactical experience, relationships) but nothing reads them.

## Observation

Produced by `ObservationBuilder.build(session, actor, profile)`. Entities beyond `observation_radius` are omitted; per-category
lists are sorted nearest-first and capped by `max_observed_entities` (pickups half that, interactables 16). Positions are `[x, z]`
rounded to 1 cm.

```
schema_version  int     1
tick            int     simulation step counter
time_seconds    float   elapsed run time
run_active      bool
arena           {map, min:[x,z], max:[x,z]}
self            {id, name, archetype, team, position, aim_point, health, max_health, move_speed, is_dashing,
                 abilities:[{slot 0-3, id, name, kind, ready, cooldown_remaining, reach, radius}],   slot 0 = primary
                 stats:{max_health, health_regen, move_speed, armor, damage_multiplier, attack_speed,
                        cooldown_reduction, crit_chance, crit_damage, pickup_radius, xp_gain, life_steal,
                        area_size, extra_projectiles, summon_bonus},
                 level, xp_in_level, xp_to_next_level, pending_level_ups,
                 pending_upgrade_choices:[{index, id, name, rarity, effects, current_stacks}],
                 upgrades:{id: stacks}, items:{id: stacks}}
allies          [{id, name, position, health_fraction, distance}]
enemies         [{id, type, position, health_fraction, distance, is_elite, is_ranged}]
pickups         [{id, kind: "xp_gem", value, position, distance}]
hazards         [{id, position, shape, radius, half_extents, active, warning}]
interactables   [{id, kind, position, distance, in_range}]       only ones this actor can currently use
```

Deliberately **not** included: enemy exact health, damage or stats; other actors' inventories or upgrades; spawn timers or the
director's plan; RNG seeds; anything outside the observation radius. Allies expose only what a human teammate could see.

## Capability profiles

`data/agent_profiles/*.tres` (`AgentCapabilityProfile`): `observation_radius`, `max_observed_entities`, `decision_interval`,
`max_commands_per_second` (0 = unlimited), `allowed_commands` (empty = all), `may_select_upgrades`, `memory_scopes` (reserved).

| Profile | Used by | Radius | Interval | Rate limit | Notes |
|---|---|---|---|---|---|
| `human` | the local player | 60 m | n/a | none | full commands |
| `conventional_ai` | in-engine ally AI | 24 m | 0.2 s | none | rule-based, same observation format |
| `external_default` | future remote agents | 24 m | 0.5 s | 12 / s | |
| `enemy_brain` | enemy NPCs | unlimited | n/a | none | only `move` and `attack` allowed |

A character references its AI profile through `SingularityDefinition.agent_profile_id`, so the same singularity can be driven by a
conventional AI or a language model with different observation and cadence limits.

## Telemetry of agent behaviour

Every rejected command and every accepted action-type command emits `Events.command_processed(controller_id, actor_id, type,
accepted, reason)`; telemetry aggregates counts per `controller/type/outcome` under `command_outcomes` in the run report, so
agent misbehaviour (spam, invalid targets, cooldown thrashing) is measurable. `move` and `aim` acceptances are not reported to avoid
drowning the report.

## Integration plan (future units)

- **LAN (Unit E):** a host runs the authoritative `RunSession`. Remote humans and agents each hold a `controller_id`; the transport
  serialises `ActionCommand.to_dict()` upstream and observations downstream. The validator already assumes untrusted input.
  Observation and command schemas are the only wire contract; bump `schema_version` on any breaking change.
- **MCP (Unit D/E):** wrap `ExternalAgentController` in an MCP server exposing two tools, `get_observation` and `submit_command`,
  plus a resource describing the schema. The model never needs more than those. Keep decision cadence in the profile.
- **Open questions before building it:** multiplayer level-up pause policy; whether observations should include an event log since
  the last decision (damage taken, kills) to help models that act infrequently; token cost of large observations (the entity cap
  and radius exist for this); how agents learn between matches (memory scopes).

## Sample

Real output from `tools/dump_observation.tscn` after 25 simulated seconds (truncated):

```json
{"schema_version": 1, "tick": 1499, "time_seconds": 24.983, "run_active": true,
 "self": {"id": 3, "archetype": "binaural_sphere", "position": [-8, 4], "health": 90.3, "max_health": 95,
          "level": 2, "pending_level_ups": 1,
          "pending_upgrade_choices": [{"index": 0, "id": "reinforced_frame", "rarity": "common", "effects": "+20 Max Health"}, "..."]},
 "enemies": [{"id": 16, "type": "scrap_crawler", "position": [-5.37, 2.3], "health_fraction": 1, "distance": 3.13,
              "is_elite": false, "is_ranged": false}, "..."],
 "pickups": [{"id": 9, "kind": "xp_gem", "value": 1, "position": [-5.79, 6.39], "distance": 3.25}]}
```

Result of `{"type": "use_ability", "slot": 7}`: `{"accepted": false, "reason": "invalid_params", "message": "slot must be 1-3", "detail": {}}`.
