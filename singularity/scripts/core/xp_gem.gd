class_name XpGem
extends Node3D
## Physical XP pickup. Drifts towards the nearest friendly singularity whose pickup
## radius contains it, and is collected on contact.

const COLLECT_DISTANCE := 0.7

var xp_value: float = 1.0
var gem_id: int = -1
var _session: RunSession
var _collector: SingularityActor
var _pull_speed: float = 0.0
var _mesh_instance: MeshInstance3D
var _age: float = 0.0


func setup(run_session: RunSession, new_gem_id: int, value: float, world_position: Vector3) -> void:
	_session = run_session
	gem_id = new_gem_id
	xp_value = value
	global_position = Vector3(world_position.x, 0.0, world_position.z)
	_mesh_instance = VisualEffects.make_mesh_instance(_build_mesh(), _color_for(value), 1.2)
	_mesh_instance.position.y = 0.55
	add_child(_mesh_instance)
	add_to_group("xp_gems")


func add_value(extra: float) -> void:
	xp_value += extra
	_mesh_instance.material_override = VisualEffects.make_material(_color_for(xp_value), 1.2)


func _physics_process(delta: float) -> void:
	_age += delta
	_mesh_instance.rotation.y += delta * 2.5
	_mesh_instance.position.y = 0.55 + sin(_age * 3.0) * 0.08
	if _collector == null or not _collector.is_alive:
		_collector = _session.find_gem_collector(global_position)
		_pull_speed = 0.0
	if _collector == null:
		return
	var offset: Vector3 = _collector.global_position - global_position
	offset.y = 0.0
	var distance: float = offset.length()
	if distance <= COLLECT_DISTANCE:
		_session.collect_gem(self, _collector)
		return
	_pull_speed = minf(_pull_speed + 30.0 * delta, Balance.config.xp_gem_magnet_speed)
	global_position += offset.normalized() * minf(_pull_speed * delta, distance)


func _build_mesh() -> Mesh:
	var mesh := PrismMesh.new()
	var size: float = 0.28 + 0.12 * clampf(log(maxf(xp_value, 1.0)) / log(10.0), 0.0, 2.0)
	mesh.size = Vector3(size, size * 1.4, size)
	return mesh


static func _color_for(value: float) -> Color:
	if value >= 100.0:
		return Color(1.0, 0.3, 0.9)
	if value >= 25.0:
		return Color(1.0, 0.75, 0.2)
	if value >= 5.0:
		return Color(0.4, 1.0, 0.5)
	return Color(0.3, 0.8, 1.0)
