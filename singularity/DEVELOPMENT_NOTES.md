# Development notes

Written for the review session. Items marked **ASSUMPTION** were not specified by the GDD and were chosen to keep moving;
**DEVIATION** marks where the build differs from, or narrows, what the assignment asked for. Nothing here is final.

## What was verified, and how

Verified by running it (Godot 4.3 stable, Linux):

- The project imports and boots with no script errors; all 65 scripts compile (`tests/run_checks.tscn`).
- ~200 headless checks pass (`tests/run_checks.tscn`): stat math and stacking, XP carry-over and queued level-ups, upgrade
  prerequisites/exclusions/fallbacks/determinism, command parsing and rejection paths, rate limiting, observation bounds, navigation
  baking and pathing, spawn director, AI allies moving/looting/levelling through commands, chests, hazards, invulnerability,
  every ability of all 12 characters, item procs and equipment, victory and defeat, telemetry, settings/profile persistence and
  corrupt-file recovery, and a late-game stress run (about 110 enemies, 3 actors).
- ~30 end-to-end checks pass through the real `Main` scene (`tests/run_ui_flow.tscn`): menus, settings, run start, input-driven
  movement and abilities, pause freezing the simulation, inventory hotkey, level-up with two queued levels resolved by key presses,
  tactical stances, chest interaction, restart, defeat and results screen, return to menu.
- Rendering was checked by taking screenshots of every screen under a virtual display with **software OpenGL (Mesa llvmpipe)**;
  layout bugs found that way (theme not reaching controls, wrapped labels, misplaced health bars) were fixed.
- The XP projection hits every GDD level target (`tools/economy_sim.tscn`), under stated modelling assumptions.

**Not verified** (be sceptical of these):

- No human has played it. Game feel (movement speed, attack pacing, difficulty, camera distance, effect clarity) is untested.
- Mouse aiming against a real pointer was not exercised; only the keyboard/input-action paths were. The projection code
  (`CameraRig.project_mouse_to_ground`) is simple and the HUD works under software GL, but treat aiming as unproven.
- Keyboard focus traversal with arrows/Tab was not driven by automated input; default focus and focus styling were seen in screenshots
  and Enter/number-key paths were tested. Window focus-loss auto-pause was not exercised.
- Real GPU performance. The simulation was timed headless only (about 3-7 ms per physics frame at 110 enemies, including test
  overhead); rendering cost with hundreds of unbatched placeholder meshes and per-enemy health-bar quads on a real GPU is unmeasured.
- Fullscreen/borderless, V-Sync, MSAA, render scale, frame cap and shadow toggles are wired but only exercised headless/under Xvfb.
- Exported builds (the catalog handles the `.remap` suffix, but no export was attempted).
- The elite Warden, Spark Sentry ranged AI and Brute appear only after 2-4 simulated minutes; they were exercised in the late-game
  stress run and ability checks but not watched.

## Decisions (ASSUMPTION unless noted)

- **Location.** The game lives in `singularity/` inside the existing `hyprDroid.` repository (which holds an unrelated Android
  README). It is self-contained; moving it to its own repository is just a folder copy.
- **Godot version.** 4.3 (the version available here). Nothing relies on 4.4+ features.
- **Code-generated data.** Resources are authored in `tools/generate_data.gd` and committed as `.tres`. Reason: reviewable as code and
  guaranteed valid. Cost: two sources of truth if you hand-edit files. Pick one per change (see `BALANCING.md`).
- **Input actions are registered in code** (`Settings.INPUT_ACTIONS`) rather than in `project.godot`, so remapping, persistence
  and the Input tab share one table.
- **Settings UI is generated from a schema** (`Settings.SCHEMA`); adding a setting is one dictionary entry.
- **Autoloads** are plain scripts without `class_name`: `Events`, `Balance`, `Catalog`, `Settings`, `Profile`, `Telemetry`, `GameState`.
- **Controls.** Mouse-aim twin-stick style (WASD + mouse) with hold-to-fire primary. Auto-attack is an accessibility option.
  `Escape` doubles as `ui_cancel`, handled in a defined order (screens first, then Main).
- **Camera.** Orthographic, 45 degrees yaw, 35.264 degrees elevation, size 22 (zoom 12-34), 45-degree rotation steps.
- **Combat model.** Hits are distance tests against a team-indexed list (not physics bodies); walls stop projectiles through a ray on
  physics layer 1. Enemies do not collide with each other (swarm style); actors collide with the world only.
- **Navigation is baked from the layout grid**, not from scene geometry (see Deviations). Enemies query paths every 0.45 s, stagger
  their updates, and chase directly when within 3 m or when no navigation exists.
- **Victory condition (OPEN in GDD).** Survive 30 minutes (`victory_survive_seconds`). Defeat when the human actor dies. Allies do not
  revive and do not end the run.
- **XP.** Collected by whoever picks up the gem; `xp_share_mode` can switch to equal team sharing (OPEN in GDD). Allies level and
  choose upgrades on their own, instantly, through the same command.
- **Level-up pause.** Only the human's level-up pauses (global pause). The multiplayer policy is not implemented.
- **Tactical overview.** Zoomed camera plus stance keys for AI allies. It does not slow time (`tactical_time_scale` = 1.0, configurable);
  how it should affect time is OPEN. There is no direct command-control beyond stances.
- **Items vs upgrades.** Chest-only items; no currency or shop. One chest per `X` marker (3 in LAB-00) plus an elite drop.
- **Only the human opens chests.** Allies ignore them (no ally inventories from chests yet).
- **Hazards hurt everything** (`hazards_hurt_all_teams`), enemies included.
- **Placeholder identities.** The eight non-representative singularities use a generic, clearly labelled kit with per-character colour,
  silhouette, philosophy text and tactical preferences from the GDD roster. Emergent 1.3.12 is explicitly "undefined".
- **Telemetry is JSON per run** in `user://telemetry/`, aggregated (not per-hit) to keep it light, with a 4,000-event cap.
- **Persistence** is a `ConfigFile` (`user://settings.cfg`) for settings/bindings and JSON (`user://profile.json`) for the profile.
  Invalid or corrupt values fall back to defaults; this is covered by checks.
- **Pause on focus loss** during a run.

## Deviations and narrowed scope

- **Audio:** volume/bus settings (Master, Music, SFX) and mute-on-unfocus work, but there are no sound assets or playback.
- **Gamepad:** not supported (keyboard and mouse only).
- **Navigation geometry:** the assignment implies baking from the map. Baking from collision shapes does not work in Godot's headless
  renderer (the dummy renderer cannot build debug meshes) and would tie navigation to the art. The grid bake is renderer-independent
  and works the same with placeholders or Blender modules, but it means solid modules must be listed in `blocking_symbols`
  and each solid cell is a full-cell hole in the navmesh (crate clusters and pillars are slightly over-blocked).
- **Character kits:** 4 of 12 are real; 8 are placeholders by design.
- **Interactions:** the only interactable is the item chest; the interface is generic (`can_interact` / `interact`).
- **Agent memory:** capability profiles reserve `memory_scopes`; nothing implements memory. No `order` command for commanding allies.
- **Networking and MCP:** not implemented, as instructed; the boundary is `RunSession.submit_command()` and `ExternalAgentController`.
- **Rarity/economy of narrative persistence, factions, objectives, session length:** not implemented (OPEN in GDD).

## Known limitations and rough edges

- Headless runs print many `Parameter "m" is null` errors from Godot's dummy mesh storage when meshes are freed. Harmless, headless only.
- Static state: floating damage numbers are capped at 48 live labels; damage-number text uses a billboard `Label3D` per hit.
- Gems beyond `max_gems_alive` (250) merge into the nearest existing gem instead of spawning.
- Health bars are one shader-driven billboard quad per combatant, shown only after damage for enemies.
- The HUD reads the session by polling each frame (cheap for the handful of values it shows); everything else uses signals.
- Conventional AI is deliberately simple: nearest-target engagement with kiting by preferred range, ability use by enemy count,
  retreat at low health, loot nearby gems, follow the leader. It does not use terrain, hazards or items.
- Arc panels are telegraphed by visual alpha only; no warning sound or icon.
- `Settings.rebind_action` replaces all bindings of an action with one; conflicts between actions are not detected.
- Telemetry `command_outcomes` count rejections for every controller and acceptances only for action-type commands.
- A level-up screen cannot be dismissed with Escape by design; an upgrade must be chosen.
- No fixed-timestep determinism guarantee across machines: seeds fix upgrade rolls, spawn picks and crits, but physics/AI float
  results can differ between platforms and frame rates.

## Suggested review order

1. `scripts/core/run_session.gd` (authority, gateway, run lifecycle) and `scripts/agent/command_validator.gd`.
2. `scripts/core/combatant.gd`, `ability_executor.gd`, `singularity_actor.gd`, `enemy_actor.gd`.
3. `scripts/resources/` and `data/balance/` (the schemas you will tune).
4. `scripts/core/spawn_director.gd`, `progression_tracker.gd`, `upgrade_roller.gd`.
5. `scripts/ui/` and `scripts/main.gd`.
6. `tools/generate_data.gd` (all content in one place), then `tests/`.

## Open design questions inherited from the GDD (and the default used)

Final title (working title kept) - input scheme (WASD + mouse) - tactical mode and time (no slow-down) - multiplayer level-up
policy (not implemented; solo = global pause) - Emergent 1.3.12 identity (undefined) - full roster kits (4 of 12) - laboratory
population and persistent consequences (not implemented) - match objectives, win conditions and session length (survive 30 min).
