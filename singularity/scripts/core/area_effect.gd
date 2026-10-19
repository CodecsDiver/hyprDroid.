class_name AreaEffect
extends Node3D
## A timed ground area that damages, slows and/or pulls hostiles (e.g. a vortex).

var _session: RunSession
var _owner_actor: Combatant
var _definition: AbilityDefinition
var _radius: float = 4.0
var _time_left: float = 0.0
var _tick_timer: float = 0.0
var _disc_material: StandardMaterial3D


func start(owner_actor: Combatant, definition: AbilityDefinition, center: Vector3) -> void:
	_session = owner_actor.session
	_owner_actor = owner_actor
	_definition = definition
	_radius = definition.radius * owner_actor.stats.get_value(StatIds.AREA_SIZE)
	_time_left = definition.duration
	global_position = center
	var disc_mesh := CylinderMesh.new()
	disc_mesh.top_radius = _radius
	disc_mesh.bottom_radius = _radius
	disc_mesh.height = 0.04
	disc_mesh.radial_segments = 40
	var disc := MeshInstance3D.new()
	disc.mesh = disc_mesh
	_disc_material = VisualEffects.make_material(Color(definition.color, 0.35), 0.0, true)
	disc.material_override = _disc_material
	disc.position.y = 0.06
	add_child(disc)


func _physics_process(delta: float) -> void:
	if _session == null:
		queue_free()
		return
	_time_left -= delta
	if _time_left <= 0.0:
		queue_free()
		return
	var owner_valid: bool = _owner_actor != null and is_instance_valid(_owner_actor)
	var owner_team: int = _owner_actor.team_id if owner_valid else TeamIds.PLAYER
	var targets: Array[Combatant] = _session.get_hostiles_in_radius(global_position, _radius, owner_team)
	if _definition.pull_strength > 0.0:
		for target: Combatant in targets:
			var toward_center: Vector3 = global_position - target.global_position
			toward_center.y = 0.0
			if toward_center.length() > 0.4:
				target.move_and_collide(toward_center.normalized() * _definition.pull_strength * delta)
	_tick_timer -= delta
	if _tick_timer <= 0.0:
		_tick_timer = _definition.tick_interval
		for target: Combatant in targets:
			if _definition.slow_strength > 0.0:
				target.apply_slow(1.0 - _definition.slow_strength, maxf(_definition.slow_duration, _definition.tick_interval * 1.5))
			if _definition.damage > 0.0 and owner_valid:
				var info: DamageInfo = AbilityExecutor.build_damage(_owner_actor, _definition)
				AbilityExecutor.apply_hit(_owner_actor, target, info)
	_disc_material.albedo_color.a = 0.15 + 0.2 * (0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.01))
