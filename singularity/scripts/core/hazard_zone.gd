class_name HazardZone
extends Node3D
## Environmental damage area. Circular or rectangular footprint on the XZ plane.
## Optionally cycles between active and inactive (with a warning phase).

enum Shape { CIRCLE, RECTANGLE }

@export var hazard_id: StringName = &"hazard"
@export var shape: Shape = Shape.CIRCLE
## Circle radius, or half-extents (x, z) for rectangles, in metres.
@export var radius: float = 1.8
@export var half_extents: Vector2 = Vector2(1.8, 1.8)
@export var damage_per_second: float = 10.0
@export var tick_interval: float = 0.5
@export_range(0.0, 0.9) var slow_strength: float = 0.0
## Zero or negative means permanently active.
@export var active_seconds: float = 0.0
@export var inactive_seconds: float = 0.0
@export var warning_seconds: float = 0.8
@export var color: Color = Color(0.45, 1.0, 0.25)
@export var phase_offset: float = 0.0

var _session: RunSession
var _tick_timer: float = 0.0
var _material: StandardMaterial3D
var _cycle_time: float = 0.0


func _ready() -> void:
	_cycle_time = phase_offset
	var mesh: Mesh
	if shape == Shape.CIRCLE:
		var disc := CylinderMesh.new()
		disc.top_radius = radius
		disc.bottom_radius = radius
		disc.height = 0.05
		mesh = disc
	else:
		var slab := BoxMesh.new()
		slab.size = Vector3(half_extents.x * 2.0, 0.05, half_extents.y * 2.0)
		mesh = slab
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	_material = VisualEffects.make_material(Color(TeamPalette.hazard_color(color), 0.7), 0.0, true)
	instance.material_override = _material
	instance.position.y = 0.04
	add_child(instance)
	add_to_group("hazards")


func register_with_session(run_session: RunSession) -> void:
	_session = run_session


func is_active() -> bool:
	if active_seconds <= 0.0:
		return true
	return fmod(_cycle_time, active_seconds + inactive_seconds) < active_seconds


func is_warning() -> bool:
	if active_seconds <= 0.0:
		return false
	var phase: float = fmod(_cycle_time, active_seconds + inactive_seconds)
	return phase >= active_seconds + inactive_seconds - warning_seconds and phase >= active_seconds


func contains_point(world_position: Vector3) -> bool:
	var offset: Vector3 = world_position - global_position
	if shape == Shape.CIRCLE:
		return Vector2(offset.x, offset.z).length() <= radius
	return absf(offset.x) <= half_extents.x and absf(offset.z) <= half_extents.y


func describe_for_observation() -> Dictionary:
	return {
		"id": String(hazard_id),
		"position": [snappedf(global_position.x, 0.01), snappedf(global_position.z, 0.01)],
		"shape": "circle" if shape == Shape.CIRCLE else "rectangle",
		"radius": radius if shape == Shape.CIRCLE else 0.0,
		"half_extents": [snappedf(half_extents.x, 0.01), snappedf(half_extents.y, 0.01)] if shape == Shape.RECTANGLE else [],
		"active": is_active(),
		"warning": is_warning(),
	}


func _physics_process(delta: float) -> void:
	_cycle_time += delta
	var alpha: float = 0.7
	if not is_active():
		alpha = 0.5 if is_warning() else 0.12
	_material.albedo_color = Color(TeamPalette.hazard_color(color), alpha)
	if _session == null or not is_active():
		return
	_tick_timer -= delta
	if _tick_timer > 0.0:
		return
	_tick_timer = tick_interval
	for combatant: Combatant in _session.get_all_living():
		if not contains_point(combatant.global_position):
			continue
		if not Balance.config.hazards_hurt_all_teams and combatant.team_id == TeamIds.ENEMY:
			continue
		var info := DamageInfo.new()
		info.amount = damage_per_second * tick_interval
		info.source_actor_id = -1
		info.source_team = TeamIds.NEUTRAL
		info.ability_id = StringName("hazard:%s" % hazard_id)
		info.can_proc = false
		if slow_strength > 0.0:
			info.slow_multiplier = 1.0 - slow_strength
			info.slow_duration = tick_interval * 2.0
		combatant.take_damage(info)
