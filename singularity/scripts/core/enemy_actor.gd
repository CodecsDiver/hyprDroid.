class_name EnemyActor
extends Combatant
## Hostile NPC. Movement and attacks are issued as validated commands through the
## same gateway as every other actor; conventional navigation picks the direction.

const PATH_REFRESH_INTERVAL := 0.45
const TARGET_REFRESH_INTERVAL := 0.3
const DIRECT_CHASE_DISTANCE := 3.0
const WAYPOINT_REACHED_DISTANCE := 0.9

var definition: EnemyDefinition
var _target: Combatant
var _next_target_refresh: float = 0.0
var _next_path_refresh: float = 0.0
var _path_points: PackedVector3Array = PackedVector3Array()
var _path_index: int = 0
var _speed_jitter: float = 1.0


func setup(run_session: RunSession, new_actor_id: int, enemy: EnemyDefinition, spawn_position: Vector3, minutes_elapsed: float) -> void:
	session = run_session
	actor_id = new_actor_id
	definition = enemy
	team_id = TeamIds.ENEMY
	display_name = enemy.display_name
	archetype_id = StringName("elite_%s" % enemy.id) if enemy.is_elite else enemy.id
	name = "Enemy_%s_%d" % [enemy.id, new_actor_id]

	var config: BalanceConfig = Balance.config
	var health_scale: float = 1.0 + config.enemy_health_growth_per_minute * minutes_elapsed
	var damage_scale: float = 1.0 + config.enemy_damage_growth_per_minute * minutes_elapsed
	var speed_scale: float = 1.0 + minf(config.enemy_speed_growth_per_minute * minutes_elapsed, config.enemy_speed_growth_cap)
	_speed_jitter = session.rng_spawn.randf_range(0.92, 1.08)
	stats.set_base_values({
		"max_health": enemy.base_health * health_scale,
		"health_regen": 0.0,
		"move_speed": enemy.move_speed * speed_scale * _speed_jitter,
		"damage_multiplier": damage_scale,
		"crit_chance": 0.0,
	})
	health = stats.get_value(StatIds.MAX_HEALTH)
	_last_max_health = health
	abilities = [AbilityInstance.new(enemy.primary_ability, false)]
	abilities[0].cooldown_remaining = session.rng_spawn.randf() * enemy.primary_ability.cooldown

	var mesh: Mesh = _mesh_for(enemy)
	build_body(mesh, TeamPalette.enemy_color(enemy.color), enemy.body_radius * enemy.visual_scale, 1.5 * enemy.visual_scale, enemy.visual_scale)
	global_position = spawn_position
	_next_target_refresh = session.rng_spawn.randf() * TARGET_REFRESH_INTERVAL
	_next_path_refresh = session.rng_spawn.randf() * PATH_REFRESH_INTERVAL


func _mesh_for(enemy: EnemyDefinition) -> Mesh:
	if enemy.is_elite:
		var elite_mesh := PrismMesh.new()
		elite_mesh.size = Vector3(1.0, 1.5, 1.0)
		return elite_mesh
	if enemy.primary_ability.kind == AbilityDefinition.Kind.PROJECTILE:
		var ranged_mesh := SphereMesh.new()
		ranged_mesh.radius = 0.5
		ranged_mesh.height = 1.0
		return ranged_mesh
	var box_mesh := BoxMesh.new()
	box_mesh.size = Vector3(0.8, 1.2, 0.8)
	return box_mesh


func _on_tick(_delta: float) -> void:
	_refresh_target()
	if _target == null:
		set_move_intent(Vector2.ZERO)
		return
	var to_target: Vector3 = _target.global_position - global_position
	to_target.y = 0.0
	var distance: float = to_target.length()
	aim_point = _target.global_position

	var attack_reach: float = definition.primary_ability.reach
	var desired_direction: Vector3 = Vector3.ZERO
	if definition.preferred_distance > 0.0:
		# Ranged: approach to preferred distance, back off when crowded, otherwise hold.
		if distance > definition.preferred_distance:
			desired_direction = _direction_towards(to_target, distance)
		elif distance < definition.preferred_distance * 0.6:
			desired_direction = -to_target.normalized()
	elif distance > attack_reach * 0.7:
		desired_direction = _direction_towards(to_target, distance)

	_submit(ActionCommand.move(Vector2(desired_direction.x, desired_direction.z)))
	var in_range: bool = distance <= attack_reach + _target.body_radius if definition.preferred_distance <= 0.0 else distance <= attack_reach
	if in_range and abilities[0].is_ready():
		_submit(ActionCommand.attack(_target.actor_id, Vector2(_target.global_position.x, _target.global_position.z)))


func _submit(command: ActionCommand) -> void:
	session.submit_command(RunSession.ENEMY_CONTROLLER_ID, actor_id, command)


func _refresh_target() -> void:
	if session.sim_time < _next_target_refresh and _target != null and _target.is_alive:
		return
	_next_target_refresh = session.sim_time + TARGET_REFRESH_INTERVAL
	_target = session.get_nearest_hostile(global_position, 1000.0, team_id)


## Direction to move towards the target, following the navigation mesh when the
## straight line is long. Falls back to a direct line if no path is available.
func _direction_towards(to_target: Vector3, distance: float) -> Vector3:
	if distance <= DIRECT_CHASE_DISTANCE or not session.has_navigation():
		return to_target.normalized()
	if session.sim_time >= _next_path_refresh:
		_next_path_refresh = session.sim_time + PATH_REFRESH_INTERVAL
		_path_points = session.find_path(global_position, _target.global_position)
		_path_index = 1
	while _path_index < _path_points.size():
		var waypoint: Vector3 = _path_points[_path_index]
		var offset: Vector3 = waypoint - global_position
		offset.y = 0.0
		if offset.length() < WAYPOINT_REACHED_DISTANCE:
			_path_index += 1
			continue
		return offset.normalized()
	return to_target.normalized()


func _on_died(_killer_actor_id: int) -> void:
	if _visual_root != null:
		var tween: Tween = create_tween()
		tween.tween_property(_visual_root, "scale", Vector3.ZERO, 0.18)
		tween.tween_callback(queue_free)
	else:
		queue_free()
