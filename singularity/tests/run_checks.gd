extends Node
## Deterministic headless checks for the foundation. Run with:
##
##   godot --headless --path . --fixed-fps 60 res://tests/run_checks.tscn
##
## Exits non-zero if any check fails. These cover the rules most likely to break
## silently (stat math, XP carry-over, upgrade eligibility, command validation,
## run lifecycle). They are not a substitute for playtesting.

var _passed: int = 0
var _failed: int = 0
var _sessions: Array[RunSession] = []


func _ready() -> void:
	Telemetry.write_reports_to_disk = false
	Profile.persistence_enabled = false
	_check_all_scripts_load()
	_check_stat_math()
	_check_progression_rules()
	_check_catalog_integrity()
	_check_command_parsing()
	_check_upgrade_rules()
	_check_settings_persistence_and_input()
	_check_profile_persistence()
	await _check_session_startup_and_navigation()
	await _check_command_gateway()
	await _check_leveling_through_commands()
	await _check_chest_and_hazard()
	await _check_every_character_ability()
	await _check_item_effects()
	await _check_allies_and_economy_run()
	await _check_late_game_stress()
	await _check_run_end_conditions()
	await _check_telemetry_report()
	print("\nchecks passed: %d, failed: %d" % [_passed, _failed])
	get_tree().quit(1 if _failed > 0 else 0)


func _check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
	else:
		_failed += 1
		print("FAIL: %s" % description)


# --- Pure logic -------------------------------------------------------------------------

func _check_all_scripts_load() -> void:
	var script_paths: Array[String] = []
	_collect_scripts("res://scripts", script_paths)
	var broken: int = 0
	for path: String in script_paths:
		var script: Script = load(path)
		if script == null or not (script as GDScript).can_instantiate() and not (script as GDScript).is_abstract():
			# can_instantiate() is false for scripts that fail to compile; autoload scripts extend Node and pass.
			broken += 1
			print("  script failed to compile: %s" % path)
	_check(broken == 0, "all %d scripts compile" % script_paths.size())


func _collect_scripts(directory_path: String, into: Array[String]) -> void:
	var directory := DirAccess.open(directory_path)
	if directory == null:
		return
	for sub_directory: String in directory.get_directories():
		_collect_scripts("%s/%s" % [directory_path, sub_directory], into)
	for file_name: String in directory.get_files():
		if file_name.ends_with(".gd"):
			into.append("%s/%s" % [directory_path, file_name])


func _check_stat_math() -> void:
	var stats := StatSheet.new()
	stats.set_base_values({"max_health": 100.0})
	_check(is_equal_approx(stats.get_value(StatIds.MAX_HEALTH), 100.0), "base value passes through")
	var additive := StatModifier.new()
	additive.stat = StatIds.MAX_HEALTH
	additive.value = 20.0
	var percent := StatModifier.new()
	percent.stat = StatIds.MAX_HEALTH
	percent.operation = StatModifier.Operation.ADD_PERCENT
	percent.value = 0.5
	var multiply := StatModifier.new()
	multiply.stat = StatIds.MAX_HEALTH
	multiply.operation = StatModifier.Operation.MULTIPLY
	multiply.value = 1.1
	var modifiers: Array[StatModifier] = [additive, percent, multiply]
	stats.set_source(&"test", modifiers, 2)
	# (100 + 40) * (1 + 1.0) * 1.1^2 = 338.8
	_check(is_equal_approx(stats.get_value(StatIds.MAX_HEALTH), 338.8), "add, percent and multiply combine: %.2f" % stats.get_value(StatIds.MAX_HEALTH))
	stats.remove_source(&"test")
	_check(is_equal_approx(stats.get_value(StatIds.MAX_HEALTH), 100.0), "removing a source restores the base value")

	_check(is_equal_approx(StatModifier.hyperbolic_total(0.1, 0.5, 1), 0.1), "hyperbolic first stack equals its stated value")
	var five_stacks: float = StatModifier.hyperbolic_total(0.1, 0.5, 5)
	var fifty_stacks: float = StatModifier.hyperbolic_total(0.1, 0.5, 50)
	_check(five_stacks > 0.1 and five_stacks < 0.5 and fifty_stacks < 0.5 and fifty_stacks > five_stacks, "hyperbolic stacking rises but never reaches its cap (%.3f, %.3f)" % [five_stacks, fifty_stacks])

	stats.set_base(StatIds.COOLDOWN_REDUCTION, 5.0)
	_check(stats.get_value(StatIds.COOLDOWN_REDUCTION) <= 0.6001, "stat values are clamped to their limits")


func _check_progression_rules() -> void:
	var curve: XpCurve = Balance.config.xp_curve
	var tracker := ProgressionTracker.new(curve)
	var needed_first: float = curve.xp_required(1)
	tracker.add_xp(needed_first - 1.0)
	_check(tracker.level == 1 and tracker.pending_level_ups == 0, "just below the threshold does not level up")
	tracker.add_xp(1.0)
	_check(tracker.level == 2 and tracker.pending_level_ups == 1 and is_zero_approx(tracker.xp_in_level), "exact threshold levels up with no remainder")

	var big_tracker := ProgressionTracker.new(curve)
	var grant: float = curve.total_xp_to_reach(6) + 7.5
	var levels_gained: int = big_tracker.add_xp(grant)
	_check(levels_gained == 5 and big_tracker.level == 6 and big_tracker.pending_level_ups == 5, "one large grant queues one level-up per level")
	_check(is_equal_approx(big_tracker.xp_in_level, 7.5), "surplus XP carries over (%.2f)" % big_tracker.xp_in_level)

	var previous_requirement: float = 0.0
	var monotonic: bool = true
	for level: int in range(1, 60):
		var requirement: float = curve.xp_required(level)
		if requirement < previous_requirement:
			monotonic = false
		previous_requirement = requirement
	_check(monotonic, "XP requirement never decreases with level")


func _check_catalog_integrity() -> void:
	_check(Catalog.characters.size() == 12, "12 singularities are defined (found %d)" % Catalog.characters.size())
	var all_have_abilities: bool = true
	for character_id: String in Catalog.characters.keys():
		var definition: SingularityDefinition = Catalog.characters[character_id]
		if definition.primary_ability == null or definition.ability_one == null or definition.ability_two == null:
			all_have_abilities = false
	_check(all_have_abilities, "every singularity has a primary attack and two abilities")
	var requirement_ids_exist: bool = true
	for upgrade_id: String in Catalog.upgrades.keys():
		var upgrade: UpgradeDefinition = Catalog.upgrades[upgrade_id]
		for required_id: Variant in upgrade.requires.keys():
			if not Catalog.upgrades.has(String(required_id)):
				requirement_ids_exist = false
		for excluded_id: String in upgrade.excludes:
			if not Catalog.upgrades.has(excluded_id):
				requirement_ids_exist = false
	_check(requirement_ids_exist, "upgrade prerequisites and exclusions reference real upgrades")
	var map: MapLayout = Catalog.get_map(&"lab_00")
	_check(map != null and map.grid_width() > 0 and map.module_library != null, "LAB-00 layout loads with a module library")
	if map != null:
		var legend_ok: bool = true
		for row: String in map.rows:
			for symbol: String in row:
				if symbol != "." and symbol != " " and not map.legend.has(symbol):
					legend_ok = false
		_check(legend_ok, "every map symbol has a legend entry")


func _check_command_parsing() -> void:
	_check(ActionCommand.parse({"type": "move", "direction": [1, 0]})["command"] != null, "valid move parses")
	_check(ActionCommand.parse({"type": "teleport", "point": [0, 0]})["command"] == null, "unknown command type is rejected")
	_check(ActionCommand.parse({"type": "move", "direction": [1e30, 0]})["command"] == null, "absurd coordinates are rejected")
	_check(ActionCommand.parse({"type": "move", "direction": "up"})["command"] == null, "wrong direction type is rejected")
	_check(ActionCommand.parse({"type": "select_upgrade", "choice_index": 1.5})["command"] == null, "non-integer choice index is rejected")
	_check(ActionCommand.parse("move")["command"] == null, "non-object command is rejected")
	var round_trip: Dictionary = ActionCommand.attack(12, Vector2(3, 4)).to_dict()
	var reparsed: ActionCommand = ActionCommand.parse(round_trip)["command"]
	_check(reparsed != null and reparsed.target_id == 12 and reparsed.point == Vector2(3, 4), "attack command survives a dictionary round trip")


func _check_upgrade_rules() -> void:
	var inventory := ActorInventory.new()
	var overdrive: UpgradeDefinition = Catalog.get_upgrade(&"overdrive_core")
	var overclock: UpgradeDefinition = Catalog.get_upgrade(&"overclock")
	var glass: UpgradeDefinition = Catalog.get_upgrade(&"glass_core")
	var hardened: UpgradeDefinition = Catalog.get_upgrade(&"hardened_core")
	_check(not UpgradeRoller.is_eligible(overdrive, &"hell_eater", inventory), "prerequisite blocks an upgrade until met")
	inventory.add_upgrade(overclock)
	_check(not UpgradeRoller.is_eligible(overdrive, &"hell_eater", inventory), "one of two required stacks is not enough")
	inventory.add_upgrade(overclock)
	_check(UpgradeRoller.is_eligible(overdrive, &"hell_eater", inventory), "prerequisite met makes the upgrade eligible")
	inventory.add_upgrade(glass)
	_check(not UpgradeRoller.is_eligible(hardened, &"hell_eater", inventory), "an owned exclusion removes its counterpart")
	var wide_maw: UpgradeDefinition = Catalog.get_upgrade(&"wide_maw")
	_check(UpgradeRoller.is_eligible(wide_maw, &"hell_eater", inventory), "character-specific upgrade is offered to its character")
	_check(not UpgradeRoller.is_eligible(wide_maw, &"c_lo_d", inventory), "character-specific upgrade is hidden from others")

	var rng_a := RandomNumberGenerator.new()
	var rng_b := RandomNumberGenerator.new()
	rng_a.seed = 99
	rng_b.seed = 99
	var empty_inventory := ActorInventory.new()
	var first: Array[UpgradeDefinition] = UpgradeRoller.roll_upgrades(&"hell_eater", empty_inventory, 5, rng_a, 3)
	var second: Array[UpgradeDefinition] = UpgradeRoller.roll_upgrades(&"hell_eater", empty_inventory, 5, rng_b, 3)
	_check(first.size() == 3, "three upgrade choices are rolled")
	var unique_ids: Dictionary = {}
	for choice: UpgradeDefinition in first:
		unique_ids[choice.id] = true
	_check(unique_ids.size() == first.size(), "rolled choices contain no duplicates")
	var identical: bool = first.size() == second.size()
	for index: int in mini(first.size(), second.size()):
		identical = identical and first[index].id == second[index].id
	_check(identical, "the same seed rolls the same choices")

	# Exhaust the pool: fallbacks must keep the player from soft-locking.
	var maxed_inventory := ActorInventory.new()
	for upgrade_id: String in Catalog.upgrades.keys():
		var upgrade: UpgradeDefinition = Catalog.upgrades[upgrade_id]
		if upgrade.is_fallback:
			continue
		for stack: int in maxi(upgrade.max_stacks, 1):
			maxed_inventory.add_upgrade(upgrade)
	var exhausted: Array[UpgradeDefinition] = UpgradeRoller.roll_upgrades(&"hell_eater", maxed_inventory, 30, rng_a, 3)
	_check(not exhausted.is_empty() and exhausted[0].is_fallback, "an exhausted pool still offers a fallback")


# --- Simulation ---------------------------------------------------------------------------

func _make_session(character: StringName, allies: Array[StringName], seed_value: int, victory_override: float = 0.0) -> RunSession:
	GameState.current_state = GameState.State.PLAYING
	var config := RunConfig.new()
	config.character_id = character
	config.ally_character_ids = allies
	config.random_seed = seed_value
	config.victory_seconds_override = victory_override
	var session := RunSession.new()
	add_child(session)
	_sessions.append(session)
	var started: bool = session.initialize(config)
	_check(started, "session initialises for %s" % character)
	return session


func _discard(session: RunSession) -> void:
	_sessions.erase(session)
	session.queue_free()
	await get_tree().physics_frame


func _advance(frames: int) -> void:
	for frame: int in frames:
		await get_tree().physics_frame


func _check_session_startup_and_navigation() -> void:
	var session: RunSession = _make_session(&"hell_eater", [], 1234)
	await _advance(4)
	_check(session.human_actor != null and session.human_actor.is_alive, "human actor exists and is alive")
	_check((session.map_info["player_starts"] as Array).size() >= 3, "map defines player start markers")
	_check((session.map_info["enemy_spawns"] as Array).size() >= 4, "map defines enemy spawn markers")
	_check(session.has_navigation(), "navigation mesh is baked and active")
	var spawns: Array = session.map_info["enemy_spawns"]
	var path: PackedVector3Array = session.find_path(spawns[0], session.human_actor.global_position)
	_check(path.size() >= 2, "a navigation path exists from a spawn marker to the player (%d points)" % path.size())
	await _discard(session)


func _check_command_gateway() -> void:
	var session: RunSession = _make_session(&"c_lo_d", [&"hell_eater"], 55)
	await _advance(3)
	var human_id: int = session.human_actor.actor_id
	var ally_controller_id: int = RunSession.FIRST_PLAYER_CONTROLLER_ID + 1

	_check(session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, 99999, ActionCommand.move(Vector2.RIGHT)).reason == ActionResult.UNKNOWN_ACTOR, "unknown actor is rejected")
	_check(session.submit_command(ally_controller_id, human_id, ActionCommand.move(Vector2.RIGHT)).reason == ActionResult.NOT_OWNER, "a controller cannot command another controller's actor")
	_check(session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human_id, ActionCommand.move(Vector2.RIGHT)).accepted, "owner can move its actor")

	var first_attack: ActionResult = session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human_id, ActionCommand.attack(-1, Vector2(5, 5)))
	var second_attack: ActionResult = session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human_id, ActionCommand.attack(-1, Vector2(5, 5)))
	_check(first_attack.accepted and second_attack.reason == ActionResult.ON_COOLDOWN, "attack respects its cooldown")
	_check(session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human_id, ActionCommand.use_ability(3)).reason == ActionResult.NO_SUCH_ABILITY, "empty equipment slot is rejected")
	_check(session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human_id, ActionCommand.use_ability(9)).reason == ActionResult.INVALID_PARAMS, "out-of-range ability slot is rejected")
	_check(session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human_id, ActionCommand.select_upgrade(0)).reason == ActionResult.NO_PENDING_UPGRADE, "upgrade selection without a pending level-up is rejected")
	_check(session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human_id, ActionCommand.interact(424242)).reason == ActionResult.NO_TARGET, "interacting with nothing is rejected")
	var malformed: ActionResult = session.submit_command_dict(RunSession.FIRST_PLAYER_CONTROLLER_ID, human_id, {"type": "move", "direction": [NAN, 0]})
	_check(not malformed.accepted, "non-finite numbers cannot enter the simulation")

	# External agent: rate limiting and bounded observation.
	var agent_actor: SingularityActor = session._spawn_singularity(Catalog.get_character(&"binaural_sphere"), 77, false, Vector3(2, 0, 2))
	var external := ExternalAgentController.new()
	session.attach_controller(external, agent_actor, 77, Catalog.get_agent_profile(&"external_default"))
	var accepted_count: int = 0
	var limited_count: int = 0
	for attempt: int in 40:
		var outcome: Dictionary = external.submit_command_dict({"type": "move", "direction": [1, 0]})
		if outcome["accepted"]:
			accepted_count += 1
		elif outcome["reason"] == "rate_limited":
			limited_count += 1
	_check(limited_count > 0 and accepted_count > 0 and accepted_count <= 14, "external agents are rate limited (accepted %d, limited %d)" % [accepted_count, limited_count])

	var observation: Dictionary = external.get_observation()
	var as_json: String = JSON.stringify(observation)
	_check(not as_json.is_empty() and JSON.parse_string(as_json) is Dictionary, "observation serialises to JSON")
	_check(observation["self"]["id"] == agent_actor.actor_id and observation.has("enemies") and observation.has("hazards"), "observation has the documented sections")
	var far_enemy: EnemyActor = session.spawn_enemy(Catalog.get_enemy(&"scrap_crawler"), Vector3(-20, 0, -18))
	agent_actor.global_position = Vector3(18, 0, 16)
	var narrow: Dictionary = external.get_observation()
	var sees_far_enemy: bool = false
	for enemy_entry: Dictionary in narrow["enemies"]:
		if enemy_entry["id"] == far_enemy.actor_id:
			sees_far_enemy = true
	_check(not sees_far_enemy, "entities beyond the observation radius are hidden")
	agent_actor.global_position = far_enemy.global_position + Vector3(3, 0, 0)
	var near_view: Dictionary = external.get_observation()
	var enemy_keys_ok: bool = false
	for enemy_entry: Dictionary in near_view["enemies"]:
		if enemy_entry["id"] == far_enemy.actor_id:
			enemy_keys_ok = not enemy_entry.has("damage") and not enemy_entry.has("max_health") and enemy_entry.has("health_fraction")
	_check(enemy_keys_ok, "visible enemies expose public information only")
	await _discard(session)


func _check_leveling_through_commands() -> void:
	var session: RunSession = _make_session(&"mindshape", [], 7)
	await _advance(3)
	var human: SingularityActor = session.human_actor
	var curve: XpCurve = Balance.config.xp_curve
	var grant: float = curve.total_xp_to_reach(5) + 3.0
	human.gain_xp(grant / human.stats.get_value(StatIds.XP_GAIN))
	_check(human.progression.level == 5 and human.progression.pending_level_ups == 4, "XP grant queues four level-ups")
	_check(human.progression.pending_choices.size() == 3, "three upgrade choices are offered")
	var levels_before: int = human.progression.level
	var resolved: int = 0
	while human.progression.pending_level_ups > 0 and resolved < 10:
		var result: ActionResult = session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human.actor_id, ActionCommand.select_upgrade(0))
		_check(result.accepted, "upgrade selection %d is accepted" % (resolved + 1))
		resolved += 1
	_check(resolved == 4 and human.progression.pending_level_ups == 0 and human.progression.level == levels_before, "all queued level-ups resolve one at a time")
	_check(human.progression.pending_choices.is_empty(), "no choices remain after the queue is empty")
	_check(session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human.actor_id, ActionCommand.select_upgrade(7)).reason == ActionResult.NO_PENDING_UPGRADE, "extra selections are rejected")
	var owned_count: int = 0
	for entry: Dictionary in human.inventory.owned_upgrades():
		owned_count += int(entry["stacks"])
	_check(owned_count == 4, "four upgrade stacks were applied (found %d)" % owned_count)
	await _discard(session)


func _check_chest_and_hazard() -> void:
	var session: RunSession = _make_session(&"hell_eater", [], 31)
	await _advance(3)
	var human: SingularityActor = session.human_actor
	var chest: ItemChest = session.spawn_chest_near(human.global_position + Vector3(1.5, 0, 0))
	var far_chest: ItemChest = session.spawn_chest_near(human.global_position + Vector3(25.0, 0, 0))
	var far_result: ActionResult = session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human.actor_id, ActionCommand.interact(far_chest.interactable_id))
	_check(far_result.reason == ActionResult.OUT_OF_RANGE, "chests out of reach cannot be opened")
	var near_result: ActionResult = session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human.actor_id, ActionCommand.interact(chest.interactable_id))
	_check(near_result.accepted and chest.is_opened, "a nearby chest opens")
	var total_items: int = 0
	for entry: Dictionary in human.inventory.owned_items():
		total_items += int(entry["stacks"])
	_check(total_items == 1, "opening a chest grants exactly one item")
	_check(session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human.actor_id, ActionCommand.interact(chest.interactable_id)).reason == ActionResult.NO_TARGET, "an opened chest cannot be reused")

	var hazard := HazardZone.new()
	hazard.radius = 3.0
	hazard.damage_per_second = 20.0
	hazard.tick_interval = 0.25
	session.add_child(hazard)
	hazard.global_position = human.global_position
	hazard.register_with_session(session)
	var health_before: float = human.health
	human.stats.set_base(StatIds.HEALTH_REGEN, 0.0)
	await _advance(70)
	_check(human.health < health_before - 10.0, "hazard zone damages occupants (%.1f -> %.1f)" % [health_before, human.health])

	var enemy: EnemyActor = session.spawn_enemy(Catalog.get_enemy(&"scrap_crawler"), human.global_position + Vector3(6, 0, 0))
	await _advance(2)
	var enemy_health_before: float = enemy.health
	var info := DamageInfo.new()
	info.amount = 5.0
	info.source_actor_id = human.actor_id
	enemy.take_damage(info)
	_check(enemy.health < enemy_health_before, "damage reduces health")
	human.grant_invulnerability(2.0)
	var guarded_health: float = human.health
	var lethal := DamageInfo.new()
	lethal.amount = 50.0
	human.take_damage(lethal)
	_check(is_equal_approx(human.health, guarded_health), "invulnerability blocks damage")
	await _discard(session)


func _check_allies_and_economy_run() -> void:
	var session: RunSession = _make_session(&"hell_eater", [&"c_lo_d", &"binaural_sphere"], 2024)
	var started_msec: int = Time.get_ticks_msec()
	var frames: int = 60 * 90
	var peak_enemies: int = 0
	var peak_gems: int = 0
	var human_start: Vector3 = session.human_actor.global_position
	for frame: int in frames:
		await get_tree().physics_frame
		peak_enemies = maxi(peak_enemies, session.living_count(TeamIds.ENEMY))
		peak_gems = maxi(peak_gems, session.get_gems().size())
		# Keep the test avatar alive so the economy keeps running.
		session.human_actor.health = session.human_actor.stats.get_value(StatIds.MAX_HEALTH)
		for ally: Combatant in session.get_living_team(TeamIds.PLAYER):
			ally.health = ally.stats.get_value(StatIds.MAX_HEALTH)
	var wall_seconds: float = (Time.get_ticks_msec() - started_msec) / 1000.0
	print("  info: %d frames (%.0f simulated seconds) took %.1f s of wall time; peak enemies %d, peak gems %d, kills %d" % [frames, session.sim_time, wall_seconds, peak_enemies, peak_gems, session.kills])
	_check(peak_enemies > 5, "the director spawns enemies (peak %d)" % peak_enemies)
	_check(session.kills > 0, "allies and the human killed something (%d kills)" % session.kills)
	var ally_levels: int = 0
	var ally_moved: bool = false
	for combatant: Combatant in session.get_living_team(TeamIds.PLAYER):
		if combatant != session.human_actor:
			ally_levels += (combatant as SingularityActor).progression.level
			ally_moved = ally_moved or combatant.global_position.distance_to(human_start) > 1.0
	_check(ally_moved, "AI-controlled allies move under their own control")
	_check(ally_levels >= 2, "AI allies collect XP and select upgrades through commands (combined level %d)" % ally_levels)
	_check(session.human_actor.progression.total_xp > 0.0 or session.get_gems().size() > 0, "XP gems are produced")
	await _discard(session)


func _check_run_end_conditions() -> void:
	var victory_session: RunSession = _make_session(&"hell_eater", [], 5, 3.0)
	await _advance(60 * 4)
	_check(not victory_session.is_run_active(), "a run ends when the survival time is reached")
	_check(StringName(GameState.last_run_summary.get("outcome", &"")) == &"victory", "victory outcome is recorded")
	_check(victory_session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, victory_session.human_actor.actor_id, ActionCommand.move(Vector2.RIGHT)).reason == ActionResult.RUN_NOT_ACTIVE, "commands are rejected after the run ends")
	await _discard(victory_session)

	var defeat_session: RunSession = _make_session(&"hell_eater", [], 6)
	await _advance(5)
	var lethal := DamageInfo.new()
	lethal.amount = 100000.0
	defeat_session.human_actor.take_damage(lethal)
	_check(not defeat_session.human_actor.is_alive, "lethal damage kills the human actor")
	await _advance(60 * 3)
	_check(not defeat_session.is_run_active() and StringName(GameState.last_run_summary.get("outcome", &"")) == &"defeat", "the run ends in defeat after the human dies")
	await _discard(defeat_session)


func _check_late_game_stress() -> void:
	var session: RunSession = _make_session(&"hell_eater", [&"c_lo_d", &"binaural_sphere"], 808)
	await _advance(3)
	# Jump to a late-game clock so spawn rates, scaling and enemy mix are at their peak.
	session.sim_time = 1500.0
	var frames: int = 60 * 40
	var started_msec: int = Time.get_ticks_msec()
	var peak_enemies: int = 0
	for frame: int in frames:
		await get_tree().physics_frame
		peak_enemies = maxi(peak_enemies, session.living_count(TeamIds.ENEMY))
		for ally: Combatant in session.get_living_team(TeamIds.PLAYER):
			ally.health = ally.stats.get_value(StatIds.MAX_HEALTH)
	var milliseconds_per_frame: float = float(Time.get_ticks_msec() - started_msec) / float(frames)
	print("  info: late-game stress, peak enemies %d, %.2f ms per physics frame (headless, includes test overhead)" % [peak_enemies, milliseconds_per_frame])
	_check(peak_enemies >= 60, "late game reaches a large enemy count (peak %d)" % peak_enemies)
	_check(milliseconds_per_frame < 16.0, "late-game simulation stays within a 60 FPS budget headless (%.2f ms/frame)" % milliseconds_per_frame)
	_check(session.living_count(TeamIds.ENEMY) <= Balance.config.max_alive_enemies, "the alive-enemy cap is respected")
	await _discard(session)


func _check_settings_persistence_and_input() -> void:
	var original_path: String = Settings.settings_path
	Settings.settings_path = "user://test_settings.cfg"
	Settings.set_value("audio/master_volume", 35)
	Settings.set_value("accessibility/high_contrast", true)
	Settings.set_value("graphics/msaa", 2)
	Settings.set_value("audio/master_volume", 9999) # out of range: must clamp
	_check(Settings.get_int("audio/master_volume") == 100, "out-of-range slider values are clamped")
	Settings.set_value("audio/master_volume", 35)
	var jump_event := InputEventKey.new()
	jump_event.physical_keycode = KEY_H
	_check(Settings.rebind_action("ability_two", jump_event), "an action can be rebound")
	_check(InputMap.action_get_events("ability_two").size() == 1 and (InputMap.action_get_events("ability_two")[0] as InputEventKey).physical_keycode == KEY_H, "rebinding updates the InputMap")
	Settings.save_settings()

	Settings.set_value("audio/master_volume", 80)
	Settings.set_value("accessibility/high_contrast", false)
	Settings.reset_input_bindings()
	_check(Settings.describe_binding("ability_two") == "E", "default binding is restored by reset (%s)" % Settings.describe_binding("ability_two"))
	Settings.load_settings()
	Settings.apply_input_bindings()
	_check(Settings.get_int("audio/master_volume") == 35 and Settings.get_bool("accessibility/high_contrast") and Settings.get_int("graphics/msaa") == 2, "settings survive a save and load")
	_check(Settings.describe_binding("ability_two") == "H", "rebound keys survive a save and load (%s)" % Settings.describe_binding("ability_two"))

	# Corrupt file: wrong types and unknown keys must fall back safely.
	var corrupt := ConfigFile.new()
	corrupt.set_value("settings", "audio/master_volume", "loud")
	corrupt.set_value("settings", "graphics/msaa", 77)
	corrupt.set_value("settings", "not/a_setting", 1)
	corrupt.set_value("input", "move_up", "garbage")
	corrupt.set_value("input", "no_such_action", ["key:65"])
	corrupt.save("user://test_settings.cfg")
	Settings.load_settings()
	Settings.apply_input_bindings()
	_check(Settings.get_int("audio/master_volume") == 80 and Settings.get_int("graphics/msaa") == 2, "corrupt values fall back to a valid setting")
	_check(Settings.describe_binding("move_up").begins_with("W"), "corrupt binding entries fall back to defaults")

	# Leave the engine in a clean default state.
	Settings.reset_input_bindings()
	for entry: Dictionary in Settings.schema_entries():
		Settings.set_value(entry["id"], entry["default"])
	Settings.settings_path = original_path
	DirAccess.remove_absolute("user://test_settings.cfg")


func _check_profile_persistence() -> void:
	var original_path: String = Profile.profile_path
	var was_enabled: bool = Profile.persistence_enabled
	Profile.profile_path = "user://test_profile.json"
	Profile.persistence_enabled = true
	Profile.best_survival_seconds = 0.0
	Profile.best_level = 1
	Profile.runs_played = 0
	Profile.victories = 0
	Profile.record_run({"outcome": &"victory", "survival_seconds": 123.0, "level": 9})
	Profile.record_run({"outcome": &"defeat", "survival_seconds": 50.0, "level": 4})
	_check(Profile.runs_played == 2 and Profile.victories == 1 and is_equal_approx(Profile.best_survival_seconds, 123.0) and Profile.best_level == 9, "profile records run results")
	Profile.best_level = 1
	Profile.runs_played = 0
	Profile.load_profile()
	_check(Profile.runs_played == 2 and Profile.best_level == 9, "profile survives a save and load")
	var corrupt_file := FileAccess.open("user://test_profile.json", FileAccess.WRITE)
	corrupt_file.store_string("{ not json")
	corrupt_file.close()
	Profile.runs_played = 5
	Profile.load_profile()
	_check(Profile.runs_played == 5, "a corrupt profile file is ignored without crashing")
	Profile.profile_path = original_path
	Profile.persistence_enabled = was_enabled
	Profile.best_survival_seconds = 0.0
	Profile.best_level = 1
	Profile.runs_played = 0
	Profile.victories = 0
	DirAccess.remove_absolute("user://test_profile.json")


func _check_every_character_ability() -> void:
	# Executes each singularity's three abilities against a frozen dummy enemy and
	# checks the documented effect happened. Catches silently broken placeholder kits.
	var session: RunSession = _make_session(&"hell_eater", [], 91)
	await _advance(3)
	session.human_actor.invulnerable_until = INF
	var arena_origin := Vector3(0.0, 0.0, 18.0)
	for character_id: StringName in Catalog.character_order:
		var definition: SingularityDefinition = Catalog.get_character(character_id)
		var slot_definitions: Array[AbilityDefinition] = [definition.primary_ability, definition.ability_one, definition.ability_two]
		for slot: int in 3:
			var ability_definition: AbilityDefinition = slot_definitions[slot]
			var actor: SingularityActor = session._spawn_singularity(definition, 500 + slot, false, arena_origin)
			actor.stats.set_base(StatIds.CRIT_CHANCE, 0.0)
			var enemy: EnemyActor = session.spawn_enemy(Catalog.get_enemy(&"containment_brute"), arena_origin + Vector3(0.0, 0.0, -minf(ability_definition.reach * 0.5, 3.0)))
			enemy.set_physics_process(false)
			actor.set_physics_process(false)
			var health_before: float = enemy.health
			var instance: AbilityInstance = actor.abilities[slot]
			var aim_target: Vector3 = enemy.global_position
			var executed: bool = AbilityExecutor.execute(actor, instance, aim_target)
			var label: String = "%s / %s (%s)" % [definition.display_name, ability_definition.display_name, AbilityDefinition.Kind.keys()[ability_definition.kind]]
			_check(executed and instance.cooldown_remaining > 0.0, "%s executes and starts its cooldown" % label)
			actor.set_physics_process(true)
			await _advance(45)
			match ability_definition.kind:
				AbilityDefinition.Kind.GUARD:
					_check(actor.invulnerable_until > session.sim_time - 3.0, "%s grants invulnerability" % label)
				AbilityDefinition.Kind.DASH_STRIKE:
					var travelled: float = actor.global_position.distance_to(arena_origin)
					_check(travelled > ability_definition.reach * 0.5, "%s moves the user (%.1f m)" % [label, travelled])
					if ability_definition.damage > 0.0:
						_check(enemy.health < health_before, "%s damages enemies in its path" % label)
				AbilityDefinition.Kind.VORTEX:
					_check(enemy.health < health_before or enemy.global_position.distance_to(arena_origin + Vector3(0.0, 0.0, -3.0)) > 0.01, "%s affects enemies in the area" % label)
				_:
					_check(enemy.health < health_before, "%s damages the target" % label)
			actor.take_damage(_lethal_damage())
			enemy.take_damage(_lethal_damage())
			session.clear_summons_of(actor.actor_id)
			await _advance(2)
	await _discard(session)


func _lethal_damage() -> DamageInfo:
	var info := DamageInfo.new()
	info.amount = 1.0e6
	info.ignores_armor = true
	return info


func _check_item_effects() -> void:
	var session: RunSession = _make_session(&"hell_eater", [], 92)
	await _advance(3)
	var human: SingularityActor = session.human_actor
	var health_before_item: float = human.stats.get_value(StatIds.MAX_HEALTH)
	human.acquire_item(Catalog.get_item(&"redundant_core"))
	_check(is_equal_approx(human.stats.get_value(StatIds.MAX_HEALTH), health_before_item + 25.0), "item stat modifiers apply")
	_check(is_equal_approx(human.health, health_before_item + 25.0), "gaining max health also raises current health")
	human.acquire_item(Catalog.get_item(&"redundant_core"))
	_check(is_equal_approx(human.stats.get_value(StatIds.MAX_HEALTH), health_before_item + 50.0), "items stack linearly")
	for stack: int in 30:
		human.acquire_item(Catalog.get_item(&"quantum_siphon"))
	_check(human.stats.get_value(StatIds.LIFE_STEAL) < 0.31, "hyperbolic item stacking stays below its cap (%.3f)" % human.stats.get_value(StatIds.LIFE_STEAL))

	human.acquire_item(Catalog.get_item(&"aegis_protocol"))
	var equipment_result: ActionResult = session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human.actor_id, ActionCommand.use_ability(ActionCommand.SLOT_EQUIPMENT))
	_check(equipment_result.accepted and human.invulnerable_until > session.sim_time, "equipment can be activated through a command")
	_check(session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human.actor_id, ActionCommand.use_ability(ActionCommand.SLOT_EQUIPMENT)).reason == ActionResult.ON_COOLDOWN, "equipment respects its cooldown")
	human.acquire_item(Catalog.get_item(&"overcharge_capacitor"))
	_check(human.inventory.equipment_item.id == &"overcharge_capacitor", "a new equipment item replaces the old one")

	# On-kill healing.
	human.invulnerable_until = -1.0
	human.health = 10.0
	human.acquire_item(Catalog.get_item(&"scavenged_cell"))
	var victim: EnemyActor = session.spawn_enemy(Catalog.get_enemy(&"scrap_crawler"), human.global_position + Vector3(3, 0, 0))
	victim.set_physics_process(false)
	var kill_info := DamageInfo.new()
	kill_info.amount = 1000.0
	kill_info.source_actor_id = human.actor_id
	AbilityExecutor.apply_hit(human, victim, kill_info)
	_check(human.health >= 12.0 - 0.01, "on-kill healing triggers (%.1f hp)" % human.health)
	await _discard(session)


func _check_telemetry_report() -> void:
	Telemetry.write_reports_to_disk = true
	Telemetry.output_directory = "user://test_telemetry"
	var session: RunSession = _make_session(&"c_lo_d", [&"hell_eater"], 93, 6.0)
	await _advance(60 * 7)
	var report_path: String = String(GameState.last_run_summary.get("telemetry_path", ""))
	_check(not report_path.is_empty() and FileAccess.file_exists(report_path), "a telemetry report is written when a run ends")
	if FileAccess.file_exists(report_path):
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(report_path))
		_check(parsed is Dictionary and (parsed as Dictionary).has("actors") and (parsed as Dictionary).has("samples") and (parsed as Dictionary).has("command_outcomes"), "the telemetry report contains actors, samples and command outcomes")
		if parsed is Dictionary:
			var report: Dictionary = parsed
			_check(String(report.get("outcome", "")) == "victory" and (report["actors"] as Dictionary).size() >= 2, "telemetry records the outcome and every actor")
	for file_name: String in DirAccess.get_files_at("user://test_telemetry"):
		DirAccess.remove_absolute("user://test_telemetry/%s" % file_name)
	DirAccess.remove_absolute("user://test_telemetry")
	Telemetry.write_reports_to_disk = false
	Telemetry.output_directory = Telemetry.OUTPUT_DIRECTORY
	await _discard(session)
