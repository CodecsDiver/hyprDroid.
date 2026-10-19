class_name SummonedDrone
extends Node3D
## Short-lived autonomous drone that orbits its owner and shoots nearby hostiles.

const ORBIT_RADIUS := 2.4
const ORBIT_SPEED := 2.2
const FIRE_RANGE := 13.0

var owner_actor_id: int = -1
var _owner_actor: Combatant
var _definition: AbilityDefinition
var _angle: float = 0.0
var _lifetime_left: float = 0.0
var _fire_timer: float = 0.0
var _projectile_definition := AbilityDefinition.new()


func setup(owner_actor: Combatant, definition: AbilityDefinition, start_angle: float) -> void:
	_owner_actor = owner_actor
	owner_actor_id = owner_actor.actor_id
	_definition = definition
	_angle = start_angle
	_lifetime_left = definition.duration
	_fire_timer = randf() * definition.tick_interval
	add_to_group("summons")
	var mesh := SphereMesh.new()
	mesh.radius = 0.28
	mesh.height = 0.56
	add_child(VisualEffects.make_mesh_instance(mesh, definition.color, 1.4))
	# Drones fire basic bolts parameterised from the summoning ability.
	_projectile_definition.id = StringName("%s_bolt" % definition.id)
	_projectile_definition.kind = AbilityDefinition.Kind.PROJECTILE
	_projectile_definition.damage = definition.damage
	_projectile_definition.reach = FIRE_RANGE + 2.0
	_projectile_definition.projectile_speed = 20.0
	_projectile_definition.color = definition.color
	_update_position()


func _physics_process(delta: float) -> void:
	if _owner_actor == null or not is_instance_valid(_owner_actor) or not _owner_actor.is_alive:
		queue_free()
		return
	_lifetime_left -= delta
	if _lifetime_left <= 0.0:
		queue_free()
		return
	_angle += ORBIT_SPEED * delta
	_update_position()
	_fire_timer -= delta
	if _fire_timer <= 0.0:
		_fire_timer = _definition.tick_interval
		_fire_at_nearest()


func _update_position() -> void:
	var offset := Vector3(cos(_angle), 0.0, sin(_angle)) * ORBIT_RADIUS
	global_position = _owner_actor.global_position + offset + Vector3(0.0, 1.8, 0.0)


func _fire_at_nearest() -> void:
	var session: RunSession = _owner_actor.session
	var nearest: Combatant = session.get_nearest_hostile(global_position, FIRE_RANGE, _owner_actor.team_id)
	if nearest == null:
		return
	var direction: Vector3 = nearest.global_position - global_position
	direction.y = 0.0
	if direction.length_squared() < 0.01:
		return
	var projectile := Projectile.new()
	session.projectile_root.add_child(projectile)
	projectile.launch(_owner_actor, _projectile_definition, global_position, direction.normalized())
