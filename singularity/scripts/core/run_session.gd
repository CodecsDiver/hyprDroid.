class_name RunSession
extends Node3D
## One run of the game: the authoritative simulation.
##
## Owns the map, actors, controllers, pickups and the command gateway. Every
## action by a human, conventional AI or external agent enters through
## submit_command(), which validates it against the live state before applying it.

const ENEMY_CONTROLLER_ID := -2
const FIRST_PLAYER_CONTROLLER_ID := 1
const INTERACTABLE_ID_BASE := 100000
const TELEMETRY_SAMPLE_INTERVAL := 10.0

signal run_finished(outcome: StringName, summary: Dictionary)

var sim_time: float = 0.0
var tick_count: int = 0
var rng_combat := RandomNumberGenerator.new()
var rng_upgrade := RandomNumberGenerator.new()
var rng_spawn := RandomNumberGenerator.new()
var rng_loot := RandomNumberGenerator.new()
var run_seed: int = 0

var config: RunConfig
var map_layout: MapLayout
var map_info: Dictionary = {}
var victory_seconds: float = 1800.0

var actors_root: Node3D
var projectile_root: Node3D
var effects_root: Node3D
var pickups_root: Node3D
var controllers_root: Node
var camera_rig: CameraRig
var director: SpawnDirector
var map_builder: MapBuilder

var human_actor: SingularityActor
var kills: int = 0

var _run_active: bool = false
var _actors: Dictionary = {}
var _living_by_team: Dictionary = {}
var _actor_owner: Dictionary = {}
var _controller_profiles: Dictionary = {}
var _controllers: Dictionary = {}
var _command_tokens: Dictionary = {}
var _interactables: Dictionary = {}
var _gems: Dictionary = {}
var _next_actor_id: int = 1
var _next_interactable_id: int = INTERACTABLE_ID_BASE
var _next_gem_id: int = 1
var _next_sample_time: float = TELEMETRY_SAMPLE_INTERVAL
var _defeat_countdown: float = -1.0
var _navigation_map: RID


func _init() -> void:
	name = "RunSession"
	_living_by_team[TeamIds.PLAYER] = []
	_living_by_team[TeamIds.ENEMY] = []


# --- Setup ------------------------------------------------------------------------

## Builds the map, actors and controllers. Returns false (and logs) on bad data.
func initialize(run_config: RunConfig) -> bool:
	config = run_config
	map_layout = Catalog.get_map(config.map_id)
	var human_definition: SingularityDefinition = Catalog.get_character(config.character_id)
	if map_layout == null or human_definition == null:
		push_error("RunSession: cannot start; missing map or character data.")
		return false

	run_seed = config.random_seed if config.random_seed != 0 else int(Time.get_ticks_usec() & 0x7fffffff)
	rng_combat.seed = run_seed + 1
	rng_upgrade.seed = run_seed + 2
	rng_spawn.seed = run_seed + 3
	rng_loot.seed = run_seed + 4
	victory_seconds = config.victory_seconds_override if config.victory_seconds_override > 0.0 else Balance.config.victory_survive_seconds

	actors_root = _make_root("Actors")
	projectile_root = _make_root("Projectiles")
	effects_root = _make_root("Effects")
	pickups_root = _make_root("Pickups")
	controllers_root = Node.new()
	controllers_root.name = "Controllers"
	add_child(controllers_root)

	map_builder = MapBuilder.new()
	map_builder.name = "Map"
	add_child(map_builder)
	map_info = map_builder.build(map_layout, self)
	_navigation_map = map_builder.get_navigation_map()

	_register_controller_profile(ENEMY_CONTROLLER_ID, Catalog.get_agent_profile(Balance.config.enemy_profile_id))
	camera_rig = CameraRig.new()
	camera_rig.name = "CameraRig"
	add_child(camera_rig)
	camera_rig.center_on(Vector3.ZERO)

	var starts: Array = map_info.get("player_starts", [])
	var start_position: Vector3 = starts[0] if not starts.is_empty() else Vector3.ZERO
	human_actor = _spawn_singularity(human_definition, FIRST_PLAYER_CONTROLLER_ID, true, start_position)
	var human_controller := HumanController.new()
	human_controller.name = "HumanController"
	controllers_root.add_child(human_controller)
	human_controller.setup(self, human_actor, FIRST_PLAYER_CONTROLLER_ID, Catalog.get_agent_profile(Balance.config.human_profile_id))
	_controllers[FIRST_PLAYER_CONTROLLER_ID] = human_controller
	_register_controller_profile(FIRST_PLAYER_CONTROLLER_ID, human_controller.profile)
	camera_rig.set_follow_target(human_actor)
	camera_rig.center_on(human_actor.global_position)

	var ally_index: int = 0
	for ally_id: StringName in config.ally_character_ids:
		var ally_definition: SingularityDefinition = Catalog.get_character(ally_id)
		if ally_definition == null:
			continue
		ally_index += 1
		var controller_id: int = FIRST_PLAYER_CONTROLLER_ID + ally_index
		var ally_position: Vector3 = starts[ally_index] if ally_index < starts.size() else start_position + Vector3(2.0 * ally_index, 0.0, 2.0)
		var ally_actor: SingularityActor = _spawn_singularity(ally_definition, controller_id, false, ally_position)
		var ally_controller := ConventionalAIController.new()
		ally_controller.name = "AllyController_%d" % controller_id
		controllers_root.add_child(ally_controller)
		ally_controller.setup(self, ally_actor, controller_id, Catalog.get_agent_profile(ally_definition.agent_profile_id))
		ally_controller.follow_target_id = human_actor.actor_id
		_controllers[controller_id] = ally_controller
		_register_controller_profile(controller_id, ally_controller.profile)

	director = SpawnDirector.new()
	director.name = "SpawnDirector"
	add_child(director)
	director.setup(self)

	_run_active = true
	Telemetry.begin_run({
		"seed": run_seed,
		"character": String(config.character_id),
		"allies": config.ally_character_ids.map(func(ally: StringName) -> String: return String(ally)),
		"map": String(config.map_id),
		"victory_seconds": victory_seconds,
	})
	Events.run_started.emit({"seed": run_seed, "map": String(config.map_id)})
	return true


func _make_root(node_name: String) -> Node3D:
	var root := Node3D.new()
	root.name = node_name
	add_child(root)
	return root


func _spawn_singularity(definition: SingularityDefinition, controller_id: int, human: bool, spawn_position: Vector3) -> SingularityActor:
	var actor := SingularityActor.new()
	actors_root.add_child(actor)
	actor.setup(self, _allocate_actor_id(), definition, controller_id, human, spawn_position)
	_register_actor(actor, controller_id)
	return actor


func spawn_enemy(definition: EnemyDefinition, spawn_position: Vector3) -> EnemyActor:
	var enemy := EnemyActor.new()
	actors_root.add_child(enemy)
	enemy.setup(self, _allocate_actor_id(), definition, spawn_position, elapsed_minutes())
	_register_actor(enemy, ENEMY_CONTROLLER_ID)
	return enemy


func _allocate_actor_id() -> int:
	var allocated: int = _next_actor_id
	_next_actor_id += 1
	return allocated


func _register_actor(actor: Combatant, controller_id: int) -> void:
	_actors[actor.actor_id] = actor
	_actor_owner[actor.actor_id] = controller_id
	(_living_by_team[actor.team_id] as Array).append(actor)
	actor.died.connect(_on_actor_died)
	Telemetry.register_actor(actor.actor_id, actor.display_name, actor.team_id)


func _register_controller_profile(controller_id: int, profile: AgentCapabilityProfile) -> void:
	_controller_profiles[controller_id] = profile


## Registers an extra controller (e.g. an ExternalAgentController) for an existing actor.
func attach_controller(controller: ActorController, actor: Combatant, controller_id: int, profile: AgentCapabilityProfile) -> void:
	controllers_root.add_child(controller)
	controller.setup(self, actor, controller_id, profile)
	_controllers[controller_id] = controller
	_actor_owner[actor.actor_id] = controller_id
	_register_controller_profile(controller_id, profile)


# --- Queries ----------------------------------------------------------------------

func is_run_active() -> bool:
	return _run_active


func elapsed_minutes() -> float:
	return sim_time / 60.0


func get_actor(actor_id: int) -> Combatant:
	var actor: Variant = _actors.get(actor_id)
	if actor == null or not is_instance_valid(actor):
		return null
	return actor


func get_controller_for_actor(actor_id: int) -> int:
	return int(_actor_owner.get(actor_id, -999))


func get_controller(controller_id: int) -> ActorController:
	return _controllers.get(controller_id)


func get_controller_ids() -> Array:
	return _controllers.keys()


func get_living_team(team_id: int) -> Array[Combatant]:
	var result: Array[Combatant] = []
	for combatant: Combatant in (_living_by_team.get(team_id, []) as Array):
		result.append(combatant)
	return result


func get_all_living() -> Array[Combatant]:
	var result: Array[Combatant] = []
	for team_id: int in _living_by_team.keys():
		for combatant: Combatant in (_living_by_team[team_id] as Array):
			result.append(combatant)
	return result


func living_count(team_id: int) -> int:
	return (_living_by_team.get(team_id, []) as Array).size()


## Living combatants hostile to `for_team` within `radius` (XZ distance) of `origin`.
func get_hostiles_in_radius(origin: Vector3, radius: float, for_team: int) -> Array[Combatant]:
	var result: Array[Combatant] = []
	var radius_squared: float = radius * radius
	for team_id: int in _living_by_team.keys():
		if not TeamIds.are_hostile(for_team, team_id):
			continue
		for combatant: Combatant in (_living_by_team[team_id] as Array):
			var dx: float = combatant.global_position.x - origin.x
			var dz: float = combatant.global_position.z - origin.z
			if dx * dx + dz * dz <= radius_squared:
				result.append(combatant)
	return result


func get_nearest_hostile(origin: Vector3, max_distance: float, for_team: int) -> Combatant:
	var best: Combatant = null
	var best_distance_squared: float = max_distance * max_distance
	for team_id: int in _living_by_team.keys():
		if not TeamIds.are_hostile(for_team, team_id):
			continue
		for combatant: Combatant in (_living_by_team[team_id] as Array):
			var dx: float = combatant.global_position.x - origin.x
			var dz: float = combatant.global_position.z - origin.z
			var distance_squared: float = dx * dx + dz * dz
			if distance_squared < best_distance_squared:
				best_distance_squared = distance_squared
				best = combatant
	return best


func get_gems() -> Array[XpGem]:
	var result: Array[XpGem] = []
	for gem: XpGem in _gems.values():
		result.append(gem)
	return result


func get_interactable(interactable_id: int) -> Node3D:
	var node: Variant = _interactables.get(interactable_id)
	if node == null or not is_instance_valid(node):
		return null
	return node


func get_interactables() -> Array[Node3D]:
	var result: Array[Node3D] = []
	for node: Node3D in _interactables.values():
		if is_instance_valid(node):
			result.append(node)
	return result


func register_interactable(node: Node3D) -> int:
	var interactable_id: int = _next_interactable_id
	_next_interactable_id += 1
	_interactables[interactable_id] = node
	return interactable_id


func clear_summons_of(owner_actor_id: int) -> void:
	for summon: Node in get_tree().get_nodes_in_group("summons"):
		if summon is SummonedDrone and (summon as SummonedDrone).owner_actor_id == owner_actor_id:
			summon.queue_free()


# --- Navigation ----------------------------------------------------------------------

func has_navigation() -> bool:
	return _navigation_map.is_valid() and NavigationServer3D.map_get_iteration_id(_navigation_map) > 0


func find_path(from: Vector3, to: Vector3) -> PackedVector3Array:
	if not has_navigation():
		return PackedVector3Array()
	return NavigationServer3D.map_get_path(_navigation_map, Vector3(from.x, 0.0, from.z), Vector3(to.x, 0.0, to.z), true)


# --- Command gateway -----------------------------------------------------------------

## The single entry point for every gameplay action. Validates, then applies.
func submit_command(controller_id: int, actor_id: int, command: ActionCommand) -> ActionResult:
	var profile: AgentCapabilityProfile = _controller_profiles.get(controller_id)
	var result: ActionResult
	if profile == null:
		result = ActionResult.reject(ActionResult.NOT_OWNER, "unknown controller %d" % controller_id)
	else:
		result = CommandValidator.validate(self, controller_id, actor_id, command, profile)
		if result.accepted:
			result = _apply_command(get_actor(actor_id), command)
	_report_command(controller_id, actor_id, command, result)
	return result


## Convenience for external agents: parse untrusted JSON-style data, then submit.
func submit_command_dict(controller_id: int, actor_id: int, data: Variant) -> ActionResult:
	var parsed: Dictionary = ActionCommand.parse(data)
	if parsed["command"] == null:
		var rejection := ActionResult.reject(ActionResult.INVALID_PARAMS, String(parsed["error"]))
		Events.command_processed.emit(controller_id, actor_id, &"malformed", false, ActionResult.INVALID_PARAMS)
		return rejection
	return submit_command(controller_id, actor_id, parsed["command"])


func consume_command_token(controller_id: int, rate_per_second: float) -> bool:
	var bucket: Dictionary = _command_tokens.get(controller_id, {"tokens": rate_per_second, "time": sim_time})
	var elapsed: float = maxf(sim_time - float(bucket["time"]), 0.0)
	var tokens: float = minf(float(bucket["tokens"]) + elapsed * rate_per_second, maxf(rate_per_second, 1.0))
	bucket["time"] = sim_time
	var allowed: bool = tokens >= 1.0
	bucket["tokens"] = tokens - 1.0 if allowed else tokens
	_command_tokens[controller_id] = bucket
	return allowed


func _apply_command(actor: Combatant, command: ActionCommand) -> ActionResult:
	match command.type:
		ActionCommand.Type.MOVE:
			actor.set_move_intent(command.direction)
		ActionCommand.Type.AIM:
			actor.aim_point = Vector3(command.point.x, 0.0, command.point.y)
		ActionCommand.Type.ATTACK:
			AbilityExecutor.execute(actor, actor.abilities[0], _resolve_aim(actor, command))
		ActionCommand.Type.USE_ABILITY:
			AbilityExecutor.execute(actor, actor.get_ability_for_slot(command.slot), _resolve_aim(actor, command))
		ActionCommand.Type.INTERACT:
			var interactable: Node3D = get_interactable(command.target_id)
			if interactable.has_method("interact"):
				interactable.interact(actor)
		ActionCommand.Type.SELECT_UPGRADE:
			(actor as SingularityActor).choose_upgrade(command.choice_index)
	return ActionResult.accept()


func _resolve_aim(actor: Combatant, command: ActionCommand) -> Vector3:
	if command.target_id >= 0:
		var target: Combatant = get_actor(command.target_id)
		if target != null:
			return target.global_position
	if command.has_point:
		return Vector3(command.point.x, 0.0, command.point.y)
	return actor.aim_point


func _report_command(controller_id: int, actor_id: int, command: ActionCommand, result: ActionResult) -> void:
	# Movement/aim spam from every controller every frame would drown telemetry; report
	# rejections always and accepted actions only for meaningful command types.
	if result.accepted:
		if controller_id == ENEMY_CONTROLLER_ID:
			return
		if command.type == ActionCommand.Type.MOVE or command.type == ActionCommand.Type.AIM:
			return
	Events.command_processed.emit(controller_id, actor_id, command.type_name(), result.accepted, result.reason)


# --- Simulation loop ----------------------------------------------------------------

func _physics_process(delta: float) -> void:
	if not _run_active:
		return
	sim_time += delta
	tick_count += 1
	Telemetry.set_clock(sim_time)
	if _defeat_countdown >= 0.0:
		_defeat_countdown -= delta
		if _defeat_countdown < 0.0:
			finish_run(&"defeat")
			return
	if sim_time >= _next_sample_time:
		_next_sample_time += TELEMETRY_SAMPLE_INTERVAL
		_record_telemetry_sample()
	if sim_time >= victory_seconds:
		finish_run(&"victory")


func _unhandled_key_input(event: InputEvent) -> void:
	if not OS.is_debug_build() or not _run_active or not (event is InputEventKey):
		return
	var key_event := event as InputEventKey
	if not key_event.pressed or key_event.echo:
		return
	match key_event.keycode:
		KEY_F2:
			human_actor.gain_xp(50.0)
		KEY_F3:
			spawn_chest_near(human_actor.global_position + Vector3(3.0, 0.0, 0.0))
		KEY_F4:
			sim_time += 60.0
		KEY_F5:
			human_actor.invulnerable_until = INF if human_actor.invulnerable_until != INF else -1.0


func _record_telemetry_sample() -> void:
	Telemetry.add_sample({
		"enemies_alive": living_count(TeamIds.ENEMY),
		"gems": _gems.size(),
		"kills": kills,
		"human_health": snappedf(human_actor.health, 0.1),
		"human_level": human_actor.progression.level,
		"human_total_xp": snappedf(human_actor.progression.total_xp, 0.1),
	})


# --- Death, XP and loot ---------------------------------------------------------------

func _on_actor_died(combatant: Combatant, killer_actor_id: int) -> void:
	(_living_by_team[combatant.team_id] as Array).erase(combatant)
	Events.actor_died.emit(combatant.actor_id, killer_actor_id, combatant.team_id, combatant.archetype_id)
	if combatant.team_id == TeamIds.ENEMY:
		kills += 1
		var enemy := combatant as EnemyActor
		spawn_xp_gem(combatant.global_position, enemy.definition.xp_value)
		if enemy.definition.is_elite and rng_loot.randf() < enemy.definition.elite_chest_drop_chance:
			spawn_chest_near(combatant.global_position)
	elif combatant == human_actor and _defeat_countdown < 0.0:
		_defeat_countdown = Balance.config.defeat_delay_seconds


func spawn_xp_gem(world_position: Vector3, value: float) -> void:
	if _gems.size() >= Balance.config.max_gems_alive:
		var nearest: XpGem = null
		var nearest_distance: float = INF
		for gem: XpGem in _gems.values():
			var distance: float = gem.global_position.distance_squared_to(world_position)
			if distance < nearest_distance:
				nearest_distance = distance
				nearest = gem
		if nearest != null:
			nearest.add_value(value)
			return
	var gem := XpGem.new()
	pickups_root.add_child(gem)
	var gem_id: int = _next_gem_id
	_next_gem_id += 1
	gem.setup(self, gem_id, value, world_position)
	_gems[gem_id] = gem


func spawn_chest_near(world_position: Vector3) -> ItemChest:
	var chest := ItemChest.new()
	pickups_root.add_child(chest)
	chest.global_position = Vector3(world_position.x, 0.0, world_position.z)
	chest.register_with_session(self)
	return chest


## Nearest living friendly singularity whose pickup radius contains `world_position`.
func find_gem_collector(world_position: Vector3) -> SingularityActor:
	var best: SingularityActor = null
	var best_distance: float = INF
	for combatant: Combatant in (_living_by_team[TeamIds.PLAYER] as Array):
		var singularity := combatant as SingularityActor
		if singularity == null:
			continue
		var distance: float = Vector2(singularity.global_position.x - world_position.x, singularity.global_position.z - world_position.z).length()
		if distance <= singularity.stats.get_value(StatIds.PICKUP_RADIUS) and distance < best_distance:
			best_distance = distance
			best = singularity
	return best


func collect_gem(gem: XpGem, collector: SingularityActor) -> void:
	if not _gems.has(gem.gem_id):
		return
	_gems.erase(gem.gem_id)
	var value: float = gem.xp_value
	gem.queue_free()
	if Balance.config.xp_share_mode == BalanceConfig.XpShareMode.SHARED_TEAM_EQUAL:
		var recipients: Array[SingularityActor] = []
		for combatant: Combatant in (_living_by_team[TeamIds.PLAYER] as Array):
			if combatant is SingularityActor:
				recipients.append(combatant as SingularityActor)
		for recipient: SingularityActor in recipients:
			recipient.gain_xp(value / float(recipients.size()))
	else:
		collector.gain_xp(value)


# --- Run end -------------------------------------------------------------------------

func finish_run(outcome: StringName) -> void:
	if not _run_active:
		return
	_run_active = false
	for frozen_root: Node in [actors_root, projectile_root, effects_root, pickups_root]:
		frozen_root.process_mode = Node.PROCESS_MODE_DISABLED
	var summary: Dictionary = build_summary(outcome)
	var report_path: String = Telemetry.end_run(outcome, summary)
	summary["telemetry_path"] = report_path
	Profile.record_run(summary)
	run_finished.emit(outcome, summary)
	Events.run_ended.emit(outcome, summary)
	GameState.end_run(summary)


func build_summary(outcome: StringName) -> Dictionary:
	var upgrades: Array[String] = []
	for entry: Dictionary in human_actor.inventory.owned_upgrades():
		upgrades.append("%s x%d" % [(entry["definition"] as UpgradeDefinition).display_name, entry["stacks"]])
	var items: Array[String] = []
	for entry: Dictionary in human_actor.inventory.owned_items():
		items.append("%s x%d" % [(entry["definition"] as ItemDefinition).display_name, entry["stacks"]])
	return {
		"outcome": outcome,
		"survival_seconds": sim_time,
		"level": human_actor.progression.level,
		"kills": kills,
		"total_xp": human_actor.progression.total_xp,
		"character": human_actor.display_name,
		"upgrades": upgrades,
		"items": items,
		"seed": run_seed,
	}
