class_name SpawnDirector
extends Node
## Spawns enemies on a schedule defined entirely by BalanceConfig and the
## EnemyDefinition spawn windows: a continuous trickle, periodic waves, and elites.

var _session: RunSession
var _spawn_budget: float = 0.0
var _next_wave_time: float = 0.0
var _next_elite_time: float = 0.0
var _enemy_definitions: Array[EnemyDefinition] = []
var _elite_definitions: Array[EnemyDefinition] = []


func setup(session: RunSession) -> void:
	_session = session
	var config: BalanceConfig = Balance.config
	_next_wave_time = config.wave_interval_seconds
	_next_elite_time = config.elite_first_spawn_seconds
	for enemy_id: String in Catalog.enemies.keys():
		var definition: EnemyDefinition = Catalog.enemies[enemy_id]
		if definition.is_elite:
			_elite_definitions.append(definition)
		else:
			_enemy_definitions.append(definition)


## Continuous spawn rate (enemies per second) at the given elapsed time.
static func spawn_rate_at(elapsed_seconds: float, config: BalanceConfig) -> float:
	var minutes: float = elapsed_seconds / 60.0
	return minf(config.spawn_rate_start + config.spawn_rate_growth_per_minute * minutes, config.spawn_rate_max)


## Expected XP per spawned (non-elite) enemy at the given time, from spawn weights.
static func average_xp_per_enemy_at(elapsed_seconds: float, definitions: Array[EnemyDefinition]) -> float:
	var total_weight: float = 0.0
	var weighted_xp: float = 0.0
	for definition: EnemyDefinition in definitions:
		var weight: float = definition.weight_at(elapsed_seconds)
		total_weight += weight
		weighted_xp += weight * definition.xp_value
	return weighted_xp / total_weight if total_weight > 0.0 else 0.0


func _physics_process(delta: float) -> void:
	if _session == null or not _session.is_run_active():
		return
	var config: BalanceConfig = Balance.config
	var now: float = _session.sim_time
	_spawn_budget += spawn_rate_at(now, config) * delta
	while _spawn_budget >= 1.0:
		_spawn_budget -= 1.0
		if _session.living_count(TeamIds.ENEMY) < config.max_alive_enemies:
			_spawn_one_regular()
	if now >= _next_wave_time:
		_next_wave_time = now + config.wave_interval_seconds
		_spawn_wave(config)
	if now >= _next_elite_time and not _elite_definitions.is_empty():
		_next_elite_time = now + config.elite_interval_seconds
		var elite: EnemyDefinition = _elite_definitions[_session.rng_spawn.randi() % _elite_definitions.size()]
		_session.spawn_enemy(elite, _pick_spawn_position())
		Events.notification_posted.emit("%s detected" % elite.display_name, Color(1.0, 0.7, 0.3))


func _spawn_one_regular(at_position: Variant = null) -> void:
	var definition: EnemyDefinition = _pick_definition()
	if definition == null:
		return
	var spawn_position: Vector3 = at_position if at_position != null else _pick_spawn_position()
	_session.spawn_enemy(definition, spawn_position)


func _spawn_wave(config: BalanceConfig) -> void:
	var size: int = config.wave_size_base + int(config.wave_size_growth_per_minute * _session.elapsed_minutes())
	var room: int = config.max_alive_enemies - _session.living_count(TeamIds.ENEMY)
	size = mini(size, maxi(room, 0))
	var center: Vector3 = _pick_spawn_position()
	for index: int in size:
		var jitter := Vector3(_session.rng_spawn.randf_range(-2.0, 2.0), 0.0, _session.rng_spawn.randf_range(-2.0, 2.0))
		_spawn_one_regular(_clamp_to_arena(center + jitter))


func _pick_definition() -> EnemyDefinition:
	var now: float = _session.sim_time
	var total: float = 0.0
	for definition: EnemyDefinition in _enemy_definitions:
		total += definition.weight_at(now)
	if total <= 0.0:
		return null
	var roll: float = _session.rng_spawn.randf() * total
	var running: float = 0.0
	for definition: EnemyDefinition in _enemy_definitions:
		running += definition.weight_at(now)
		if roll < running:
			return definition
	return _enemy_definitions[_enemy_definitions.size() - 1]


## Picks a spawn marker roughly one screen away from the nearest friendly actor.
func _pick_spawn_position() -> Vector3:
	var markers: Array = _session.map_info.get("enemy_spawns", [])
	if markers.is_empty():
		return _fallback_spawn_position()
	var config: BalanceConfig = Balance.config
	var farthest: Vector3 = markers[0]
	var farthest_distance: float = -1.0
	for attempt: int in 8:
		var candidate: Vector3 = markers[_session.rng_spawn.randi() % markers.size()]
		var nearest_player: Combatant = _session.get_nearest_hostile(candidate, 1000.0, TeamIds.ENEMY)
		var distance: float = 1000.0
		if nearest_player != null:
			distance = Vector2(nearest_player.global_position.x - candidate.x, nearest_player.global_position.z - candidate.z).length()
		if distance >= config.spawn_distance_min and distance <= config.spawn_distance_max:
			return _clamp_to_arena(candidate + Vector3(_session.rng_spawn.randf_range(-1.0, 1.0), 0.0, _session.rng_spawn.randf_range(-1.0, 1.0)))
		if distance > farthest_distance:
			farthest_distance = distance
			farthest = candidate
	return farthest


func _fallback_spawn_position() -> Vector3:
	var bounds: Rect2 = _session.map_info.get("bounds", Rect2(-20, -20, 40, 40))
	return Vector3(_session.rng_spawn.randf_range(bounds.position.x + 2.0, bounds.end.x - 2.0), 0.0, _session.rng_spawn.randf_range(bounds.position.y + 2.0, bounds.end.y - 2.0))


func _clamp_to_arena(world_position: Vector3) -> Vector3:
	var bounds: Rect2 = _session.map_info.get("bounds", Rect2(-1000, -1000, 2000, 2000))
	return Vector3(clampf(world_position.x, bounds.position.x + 2.0, bounds.end.x - 2.0), 0.0, clampf(world_position.z, bounds.position.y + 2.0, bounds.end.y - 2.0))
