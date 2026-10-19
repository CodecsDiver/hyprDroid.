# Balancing guide

All initial values below are first guesses meant to be tuned by playtesting. Nothing here was measured from live play;
the XP and spawn numbers were fitted to the GDD targets with a model (see *XP progression*).

## Where the numbers live

| What | File |
|---|---|
| Run length, rarity weights, enemy scaling, spawn director, combat constants, XP sharing | `data/balance/balance_config.tres` (`BalanceConfig`) |
| XP required per level | `data/balance/xp_curve.tres` (`XpCurve`) |
| Character stats and abilities | `data/characters/*.tres` |
| Level-up upgrades | `data/upgrades/*.tres` |
| Items and equipment | `data/items/*.tres` |
| Enemy stats and spawn windows | `data/enemies/*.tres` |
| Agent observation radius, decision interval, command limits | `data/agent_profiles/*.tres` |
| Stat defaults and clamping limits | `scripts/resources/stat_ids.gd` |

Edit `.tres` files in the Godot inspector (double-click them). `tools/generate_data.gd` contains the same data as code and can
regenerate every file, but doing so overwrites inspector edits, so pick one workflow per change. Reload at runtime with
`Balance.reload()` / `Catalog.reload()` from a debugger or script.

## XP progression

```
xp_required(L) = base_xp + linear_growth * (L-1) + curve_growth * (L-1)^curve_exponent
               = 14 + 14 * (L-1) + 1.6 * (L-1)^2          (L = current level, cost to reach L+1)
```

An optional `table_override` array in `XpCurve` replaces the formula for the levels it covers (index 0 = level 1). XP income is
`xp_value` of each killed enemy (gems), multiplied by the collector's `xp_gain` stat. XP is never granted by time alone.
Surplus XP carries over; several levels from one grant queue one upgrade choice each.

| Level | XP to next | Cumulative |
|---|---|---|
| 1 | 14 | 0 |
| 2 | 30 | 14 |
| 3 | 48 | 44 |
| 5 | 96 | 162 |
| 10 | 270 | 956 |
| 20 | 858 | 6,034 |
| 30 | 1,766 | 18,432 |
| 32 | 1,986 | 22,072 |

**Targets and projection.** `tools/economy_sim.gd` projects level against time from the real spawn director and curve,
assuming the player kills 90% of what spawns and collects all of it with a neutral `xp_gain` of 1.0:

| Minute | Projected | GDD target |
|---|---|---|
| 1 | 3 | 2-3 |
| 3 | 6 | 4-6 |
| 5 | 8 | 7-9 |
| 10 | 14 | 12-16 |
| 15 | 19 | 17-21 |
| 20 | 24 | 22-26 |
| 30 | 32 | 30-35 |

These are design estimates from a model, not measurements. Real pacing depends on how many enemies the player actually
kills, the XP-gain upgrades they take, and ally behaviour. Re-run the tool with other assumptions:
`... res://tools/economy_sim.tscn -- kill_fraction=0.7 xp_gain=1.2`. To retune, change the curve (or the spawn numbers), rerun the tool,
then playtest and compare `survival time vs level` in the telemetry samples (one sample every 10 s).

Level-up choices: `upgrade_choice_count` = 3, distinct, weighted by rarity, filtered by prerequisites, exclusions, stack limits
and character. If fewer than three real options exist, fallback upgrades (Restore Integrity) fill in, so a level-up can never
soft-lock.

## Spawn director and enemy scaling

```
spawn_rate(t)     = min(0.9 + 0.15 * minutes, 6.0)   enemies per second  (spawn_rate_start / _growth_per_minute / _max)
wave (every 45 s) = 8 + 1.5 * minutes enemies at one marker              (wave_interval_seconds, wave_size_*)
elite             = first at 240 s, then every 150 s                       (elite_first_spawn_seconds, elite_interval_seconds)
alive cap         = 110 regular enemies                                   (max_alive_enemies)
spawn distance    = 16-34 m from the nearest friendly singularity          (spawn_distance_min / _max)
enemy health      = base * (1 + 0.12 * minutes)
enemy damage      = base * (1 + 0.06 * minutes)
enemy speed       = base * (1 + min(0.01 * minutes, 0.5)) * random(0.92-1.08)
```

| Enemy | HP | Speed | Damage | XP | Spawns from | Weight (per minute change) |
|---|---|---|---|---|---|---|
| Scrap Crawler | 18 | 3.3 | 5 melee | 1 | 0:00 | 10 (-0.35) |
| Breach Runner | 12 | 5.2 | 4 melee | 1 | 1:00 | 5 |
| Spark Sentry (ranged, holds 9 m) | 32 | 3.0 | 7 bolt | 4 | 2:00 | 2.5 (+0.3) |
| Containment Brute | 120 | 2.5 | 16 melee | 6 | 3:00 | 2 (+0.5) |
| Warden Unit (elite, always drops a chest) | 700 | 3.0 | 24 melee | 60 | scheduled | n/a |

Enemy type is a weighted draw from the entries whose spawn window is open (`EnemyDefinition.weight_at`). Waves respect the alive cap (they shrink to the remaining room); a scheduled elite spawns even at the cap, and elites count towards it afterwards.

## Combat math

```
ability damage    = ability.damage * owner.damage_multiplier            (x crit_damage on a crit; crit_chance rolled per hit)
damage taken      = damage * 100 / (100 + armor)                        (armor_constant = 100; minimum 0.5; hazards use the same rule)
primary cooldown  = base cooldown / attack_speed
ability cooldown  = base cooldown * (1 - cooldown_reduction)            (cooldown_reduction clamps at 0.6)
life steal        = (life_steal stat + ability lifesteal_fraction) * damage dealt
slow              = movement multiplier (1 - strength) for the duration; the strongest active slow wins
```

Stat formula: `final = (base + sum(ADD)) * (1 + sum(ADD_PERCENT)) * product(MULTIPLY)`, then clamped to the limits in `stat_ids.gd`
(e.g. move speed 0.5-16, crit chance 0-1, cooldown reduction 0-0.6, life steal 0-0.5).

**Stacking.** Each modifier stacks `LINEAR` (value x stacks; MULTIPLY uses value^stacks) or `HYPERBOLIC` (diminishing returns). With
hyperbolic stacking the first stack gives exactly `value` and the total approaches `hyperbolic_cap`:
`total(n) = cap * (n*k) / (1 + n*k)` with `k = value / (cap - value)`. Example, 6% crit with cap 70%:
1 stack 6.0%, 4 stacks 19.1%, 8 stacks 30.0%, and it never reaches 70%.

## Upgrades (level-ups) and items (exploration)

Rarity weights (`upgrade_rarity_weights`) are common 60, uncommon 28, rare 10, legendary 2, each multiplied by a per-level growth
(`upgrade_rarity_level_growth`: uncommon +1.2% per level, rare +3%, legendary +5%), so later levels see better options.
Chests use `chest_rarity_weights` (55 / 30 / 12 / 3) and a 12% chance (`chest_equipment_chance`) to hold equipment instead of a stackable item.

| Upgrade | Rarity | Effect per stack | Max | Rules |
|---|---|---|---|---|
| Reinforced Frame | Common | +20 max health | 6 | |
| Servo Tuning | Common | +8% move speed | 5 | |
| Overclock | Common | +10% damage | 6 | |
| Rapid Cycling | Common | +10% attack speed | 6 | |
| Scavenger Field | Common | +25% pickup radius | 4 | |
| Efficiency Protocols | Common | +8% XP gain | 5 | |
| Composite Plating | Common | +3 armor | 6 | |
| Predictive Targeting | Uncommon | +6% crit (hyperbolic, cap 70%) | 8 | |
| Lethal Variance | Uncommon | +0.25 crit damage | 4 | |
| Thermal Dispersal | Uncommon | +8% cooldown reduction (hyperbolic, cap 50%) | 5 | |
| Regeneration Loop | Uncommon | +0.7 health/s | 5 | |
| Siphon Routine | Uncommon | +3% life steal (hyperbolic, cap 30%) | 4 | |
| Overdrive Core | Rare | x1.12 damage (multiplicative) | 3 | needs Overclock x2 |
| Multi-Thread | Rare | +1 projectile | 2 | needs Rapid Cycling x2 |
| Glass Core | Rare | +40% damage, -30% max health | 1 | excludes Hardened Core |
| Hardened Core | Rare | +50% max health, +10 armor | 1 | excludes Glass Core |
| Recursive Optimization | Legendary | x1.25 damage, +20% attack speed | 1 | needs Thermal Dispersal x2 and Predictive Targeting x2 |
| Restore Integrity | fallback | heal 35% | unlimited | only offered when the pool is exhausted |

Character-specific upgrades: Hell.eater (Ravenous Edge, Wide Maw), C.lo.d (Swarm Protocol, Distributed Targeting), mindShape
(Terrain Affinity, Adaptive Frame), Binaural Sphere (Harmonic Amplifier, Resonance Lock). The other eight draw from the global pool only.

| Item | Rarity | Effect |
|---|---|---|
| Micro-Servo | Common | +6% move speed per stack |
| Ablative Plate | Common | +3 armor per stack |
| Scavenged Cell | Common | on kill heal 2 (+1.5 per extra stack) |
| Overclocked Fuse | Uncommon | 8% on hit (hyperbolic to 60%) to explode for 80% damage (+20% per stack), radius 3.5 |
| Cryo Lattice | Uncommon | 12% on hit (to 70%) to slow 40% for 2 s |
| Predictive Lens | Uncommon | +5% crit (hyperbolic, cap 60%) |
| Redundant Core | Rare | +25 max health, +0.8 regen |
| Quantum Siphon | Rare | +4% life steal (hyperbolic, cap 30%) |
| Archive Shard | Rare | +15% XP gain |
| Recursive Engine | Legendary | +20% cooldown reduction (hyperbolic, cap 60%), +15% attack speed |
| Overcharge Capacitor | Rare equipment | 90 damage pulse, radius 7, 40 s cooldown |
| Aegis Protocol | Uncommon equipment | 3.5 s invulnerability, 45 s cooldown |

Procs triggered by item effects cannot trigger further procs (`DamageInfo.can_proc`), which prevents chain explosions.

## Characters (base stats and kits)

Defaults: 100 health, 6.0 move speed, 5% crit, 1.5 crit damage, 3 m pickup radius, 0.5 health/s regeneration.

| Singularity | Health | Speed | Primary | Ability 1 | Ability 2 |
|---|---|---|---|---|---|
| mindShape | 100 | 5.8 | Shaping Bolt (11, splash) | Restructure vortex (pull + slow) | Phase Step dash |
| Hell.eater | 130 | 6.2 | Assimilate arc (14, life steal) | Pursuit Lunge dash (22) | Devour pulse (30, heals) |
| C.lo.d | 85 | 6.0 | Predictive Shot (9, fast) | Deploy Drones (2 drones, 12 s) | Barrage (5 shots) |
| Binaural Sphere | 95 | 5.9 | Resonance Bolt (8, pierce 2) | Resonance Pulse (22, slow) | Frequency Shatter (12, wide slow) |
| T-BspherE1, NULL.SAINT, AXIOM-9, PARADOX.0, ARCHIVE_OMEGA | 100 | 6.0 | Placeholder bolt (10) | Placeholder pulse (24) | Placeholder dash (12) |
| MOTHER//SWARM, FAULT//LINE | 100 | 6.0 | Placeholder strike (13) | Placeholder pulse | Placeholder dash |
| Emergent 1.3.12 | 100 | 6.0 | Placeholder bolt | Placeholder pulse | Placeholder dash |

Guiding principle from the GDD: every singularity can win, none is guaranteed to. Agent decision quality is not balanced by
nerfing a character: use `data/agent_profiles` (observation radius, decision interval, allowed commands, rate limits) first.

## Agent decision frequency and visibility

`AgentCapabilityProfile` holds `decision_interval` (AI controllers act at most this often), `observation_radius`,
`max_observed_entities`, `max_commands_per_second` and `allowed_commands`. Initial values: conventional AI 0.2 s / 24 m / 30 entities;
external default 0.5 s / 24 m / 40 entities / 12 commands per second; human sees 60 m. These live in data, never in controller code.

## Suggested tuning workflow

1. Change one value in the inspector. 2. Run `tools/economy_sim` if it affects XP or spawns. 3. Play a run with F4 (skip 60 s) and
F2 (+50 XP) to reach later states quickly. 4. Read `user://telemetry/run_*.json` (damage per actor, kills by type, upgrade picks,
item pickups, 10-second samples of enemies/health/level). 5. Repeat. Things to watch: one upgrade picked far more than others,
levels per minute drifting from the targets, damage taken from hazards vs enemies, enemy count pinned at the cap.
