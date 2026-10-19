class_name Projectile
extends Node3D
## Simple swept projectile. Hit detection is a distance test against the hostile
## list; walls are checked with a ray against the world physics layer.

var _session: RunSession
var _owner_id: int = -1
var _team_id: int = TeamIds.PLAYER
var _template: DamageInfo
var _direction: Vector3 = Vector3.FORWARD
var _speed: float = 18.0
var _remaining_range: float = 12.0
var _pierce_left: int = 0
var _hit_radius: float = 0.35
var _splash_radius: float = 0.0
var _owner_actor: Combatant
var _hit_ids: Dictionary = {}
var _definition: AbilityDefinition


func launch(owner_actor: Combatant, definition: AbilityDefinition, origin: Vector3, direction: Vector3) -> void:
	_session = owner_actor.session
	_owner_actor = owner_actor
	_owner_id = owner_actor.actor_id
	_team_id = owner_actor.team_id
	_definition = definition
	_template = AbilityExecutor.build_damage(owner_actor, definition)
	_direction = direction
	_speed = definition.projectile_speed
	_remaining_range = definition.reach
	_pierce_left = definition.pierce
	_splash_radius = definition.radius * owner_actor.stats.get_value(StatIds.AREA_SIZE)
	_hit_radius = 0.35 + 0.1 * owner_actor.stats.get_value(StatIds.AREA_SIZE)
	global_position = origin
	var mesh := SphereMesh.new()
	mesh.radius = 0.22
	mesh.height = 0.44
	var color: Color = definition.color if _team_id == TeamIds.PLAYER else TeamPalette.enemy_color(definition.color)
	add_child(VisualEffects.make_mesh_instance(mesh, color, 1.5))


func _physics_process(delta: float) -> void:
	if _session == null:
		queue_free()
		return
	var step: float = _speed * delta
	var previous_position: Vector3 = global_position
	var next_position: Vector3 = previous_position + _direction * step
	if _blocked_by_world(previous_position, next_position):
		_explode()
		return
	global_position = next_position
	_remaining_range -= step
	var ground_position: Vector3 = Vector3(next_position.x, 0.0, next_position.z)
	for target: Combatant in _session.get_hostiles_in_radius(ground_position, _hit_radius + 1.6, _team_id):
		if _hit_ids.has(target.actor_id):
			continue
		var offset: Vector3 = target.global_position - ground_position
		offset.y = 0.0
		if offset.length() > _hit_radius + target.body_radius:
			continue
		_hit_ids[target.actor_id] = true
		_hit_target(target)
		if _pierce_left <= 0:
			_explode()
			return
		_pierce_left -= 1
	if _remaining_range <= 0.0:
		_explode()


func _hit_target(target: Combatant) -> void:
	var info: DamageInfo = _template.duplicate_info()
	info.knockback_direction = _direction
	info.knockback_strength = _definition.knockback
	AbilityExecutor.apply_hit(_valid_owner(), target, info)


func _explode() -> void:
	if _splash_radius > 0.0:
		var center: Vector3 = Vector3(global_position.x, 0.0, global_position.z)
		VisualEffects.flash_disc(_session.effects_root, center, _splash_radius, _definition.color, 0.25)
		for target: Combatant in _session.get_hostiles_in_radius(center, _splash_radius, _team_id):
			if _hit_ids.has(target.actor_id):
				continue
			var info: DamageInfo = _template.duplicate_info()
			info.amount *= 0.6
			info.can_proc = false
			AbilityExecutor.apply_hit(_valid_owner(), target, info)
	queue_free()


func _valid_owner() -> Combatant:
	if _owner_actor != null and is_instance_valid(_owner_actor):
		return _owner_actor
	return null


func _blocked_by_world(from: Vector3, to: Vector3) -> bool:
	var space: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(from, to, Combatant.WORLD_LAYER)
	return not space.intersect_ray(query).is_empty()
