class_name Combatant
extends CharacterBody3D
## Shared rules for anything that can fight: health, damage, status effects,
## cooldowns, movement and dashing. Subclasses add behaviour (SingularityActor,
## EnemyActor). All gameplay state changes go through this class so no controller
## can bypass the rules.

signal health_changed(current_health: float, maximum_health: float)
signal died(combatant: Combatant, killer_actor_id: int)

const WORLD_LAYER := 1
const ACTOR_LAYER := 2
const KNOCKBACK_LIMIT := 14.0

var actor_id: int = -1
var team_id: int = TeamIds.PLAYER
var display_name: String = ""
var archetype_id: StringName = &""
var stats := StatSheet.new()
var health: float = 100.0
var is_alive: bool = true
var session: RunSession
var body_radius: float = 0.45
var body_height: float = 1.8

## World-space point the actor is aiming at (y is ignored by abilities).
var aim_point: Vector3 = Vector3.ZERO
var move_intent: Vector2 = Vector2.ZERO
var move_intent_expires_at: float = 0.0
## Index 0 is the primary attack, 1 and 2 are ability slots 1 and 2.
var abilities: Array[AbilityInstance] = []
var invulnerable_until: float = -1.0

var _visual_root: Node3D
var _body_material: StandardMaterial3D
var _base_color: Color = Color.WHITE
var _health_bar_fill: MeshInstance3D
var _health_bar_material: ShaderMaterial
var _health_bar_root: Node3D
var _slow_multiplier: float = 1.0
var _slow_until: float = 0.0
var _impulse_velocity: Vector3 = Vector3.ZERO
var _dash_time_left: float = 0.0
var _dash_velocity: Vector3 = Vector3.ZERO
var _dash_ability: AbilityDefinition
var _dash_hit_ids: Dictionary = {}
var _last_max_health: float = 0.0


func _ready() -> void:
	collision_layer = ACTOR_LAYER
	collision_mask = WORLD_LAYER
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	add_to_group("combatants")


# --- Setup helpers ------------------------------------------------------------

## Builds placeholder collision, body mesh and health bar.
func build_body(mesh: Mesh, color: Color, radius: float, height: float, mesh_scale: float = 1.0) -> void:
	body_radius = radius
	body_height = height
	_base_color = color
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = radius
	capsule.height = maxf(height, radius * 2.0 + 0.01)
	shape.shape = capsule
	shape.position.y = height * 0.5
	add_child(shape)

	_visual_root = Node3D.new()
	add_child(_visual_root)
	var body_instance := MeshInstance3D.new()
	body_instance.mesh = mesh
	_body_material = VisualEffects.make_material(color)
	body_instance.material_override = _body_material
	body_instance.position.y = height * 0.5
	body_instance.scale = Vector3.ONE * mesh_scale
	_visual_root.add_child(body_instance)
	# A small "nose" shows facing direction in the otherwise symmetric placeholder bodies.
	var nose := MeshInstance3D.new()
	var nose_mesh := BoxMesh.new()
	nose_mesh.size = Vector3(0.18, 0.18, 0.4) * mesh_scale
	nose.mesh = nose_mesh
	nose.material_override = VisualEffects.make_material(color.lightened(0.5), 0.6)
	nose.position = Vector3(0.0, height * 0.65, -(radius + 0.1) * mesh_scale)
	_visual_root.add_child(nose)
	_build_health_bar(radius, height * mesh_scale)


const HEALTH_BAR_SHADER_CODE := """
shader_type spatial;
render_mode unshaded, depth_test_disabled, cull_disabled;
uniform float fraction = 1.0;
uniform vec4 fill_color : source_color = vec4(0.3, 1.0, 0.4, 1.0);
void vertex() {
	// Face the camera while keeping the node's position and scale.
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
}
void fragment() {
	bool on_border = UV.x < 0.03 || UV.x > 0.97 || UV.y < 0.12 || UV.y > 0.88;
	vec3 color = on_border ? vec3(0.02, 0.02, 0.03) : (UV.x <= fraction ? fill_color.rgb : vec3(0.12, 0.12, 0.15));
	ALBEDO = color;
	ALPHA = 0.95;
}
"""
static var _health_bar_shader: Shader


func _build_health_bar(radius: float, height: float) -> void:
	if _health_bar_shader == null:
		_health_bar_shader = Shader.new()
		_health_bar_shader.code = HEALTH_BAR_SHADER_CODE
	_health_bar_root = Node3D.new()
	_health_bar_root.position.y = height + 0.55
	_health_bar_root.visible = false
	add_child(_health_bar_root)
	var bar_mesh := QuadMesh.new()
	bar_mesh.size = Vector2(maxf(radius * 2.4, 1.0), 0.16)
	_health_bar_fill = MeshInstance3D.new()
	_health_bar_fill.mesh = bar_mesh
	_health_bar_material = ShaderMaterial.new()
	_health_bar_material.shader = _health_bar_shader
	_health_bar_material.set_shader_parameter("fill_color", Color(0.3, 1.0, 0.4) if team_id == TeamIds.PLAYER else Color(1.0, 0.35, 0.3))
	_health_bar_fill.material_override = _health_bar_material
	_health_bar_root.add_child(_health_bar_fill)


# --- Per-frame ------------------------------------------------------------------

func _physics_process(delta: float) -> void:
	if not is_alive or session == null:
		return
	_tick_status()
	_tick_regeneration(delta)
	for ability: AbilityInstance in abilities:
		ability.tick(delta)
	_on_tick(delta)
	_apply_movement(delta)


## Subclass hook: runs before movement each physics frame.
func _on_tick(_delta: float) -> void:
	pass


func _tick_status() -> void:
	if _slow_multiplier < 1.0 and session.sim_time >= _slow_until:
		_slow_multiplier = 1.0
	if _body_material != null:
		var guarded: bool = session.sim_time < invulnerable_until
		if guarded != _body_material.emission_enabled:
			_body_material.emission_enabled = guarded
			_body_material.emission = Color(0.6, 0.9, 1.0)
			_body_material.emission_energy_multiplier = 1.2


func _tick_regeneration(delta: float) -> void:
	var regeneration: float = stats.get_value(StatIds.HEALTH_REGEN)
	if regeneration > 0.0 and health < stats.get_value(StatIds.MAX_HEALTH):
		heal(regeneration * delta, &"regeneration", false)


func _apply_movement(delta: float) -> void:
	_impulse_velocity = _impulse_velocity.move_toward(Vector3.ZERO, Balance.config.knockback_decay * delta)
	if _dash_time_left > 0.0:
		_dash_time_left -= delta
		velocity = _dash_velocity
		_apply_dash_damage()
		if _dash_time_left <= 0.0:
			_dash_ability = null
			_dash_hit_ids.clear()
	else:
		var desired := Vector3.ZERO
		if session.sim_time <= move_intent_expires_at and move_intent.length_squared() > 0.0001:
			var intent: Vector2 = move_intent.limit_length(1.0)
			desired = Vector3(intent.x, 0.0, intent.y) * stats.get_value(StatIds.MOVE_SPEED) * _slow_multiplier
		velocity = desired + _impulse_velocity
	velocity.y = 0.0
	move_and_slide()
	global_position.y = 0.0
	_update_facing(delta)


func _update_facing(delta: float) -> void:
	if _visual_root == null:
		return
	var facing: Vector3 = aim_point - global_position
	facing.y = 0.0
	if facing.length_squared() < 0.04 and velocity.length_squared() > 0.1:
		facing = velocity
	if facing.length_squared() < 0.0001:
		return
	var target_yaw: float = atan2(-facing.x, -facing.z)
	_visual_root.rotation.y = lerp_angle(_visual_root.rotation.y, target_yaw, clampf(delta * 14.0, 0.0, 1.0))


# --- Rules ----------------------------------------------------------------------

func set_move_intent(direction: Vector2) -> void:
	move_intent = direction.limit_length(1.0)
	# Intent lapses unless refreshed, so a stalled controller cannot keep an actor running forever.
	move_intent_expires_at = session.sim_time + 0.6


func health_fraction() -> float:
	return clampf(health / maxf(stats.get_value(StatIds.MAX_HEALTH), 1.0), 0.0, 1.0)


func is_dashing() -> bool:
	return _dash_time_left > 0.0


func get_ability_for_slot(slot: int) -> AbilityInstance:
	if slot >= ActionCommand.SLOT_ABILITY_ONE and slot <= ActionCommand.SLOT_ABILITY_TWO and slot < abilities.size():
		return abilities[slot]
	return null


func facing_direction() -> Vector3:
	var facing: Vector3 = aim_point - global_position
	facing.y = 0.0
	if facing.length_squared() < 0.0001:
		return Vector3(-sin(_visual_root.rotation.y), 0.0, -cos(_visual_root.rotation.y)) if _visual_root != null else Vector3.FORWARD
	return facing.normalized()


## Returns the damage actually applied after armor and invulnerability.
func take_damage(info: DamageInfo) -> float:
	if not is_alive or info.amount <= 0.0:
		return 0.0
	if session.sim_time < invulnerable_until:
		return 0.0
	var final_amount: float = info.amount
	if not info.ignores_armor:
		var armor: float = maxf(stats.get_value(StatIds.ARMOR), 0.0)
		final_amount *= Balance.config.armor_constant / (Balance.config.armor_constant + armor)
	final_amount = minf(maxf(final_amount, 0.5), health)
	health -= final_amount
	if info.knockback_strength > 0.0:
		_impulse_velocity = (_impulse_velocity + info.knockback_direction.normalized() * info.knockback_strength).limit_length(KNOCKBACK_LIMIT)
	if info.slow_duration > 0.0:
		apply_slow(info.slow_multiplier, info.slow_duration)
	_refresh_health_bar()
	health_changed.emit(health, stats.get_value(StatIds.MAX_HEALTH))
	Events.damage_dealt.emit(info.source_actor_id, actor_id, final_amount, info.is_crit, info.ability_id)
	var text_color: Color = Color(1.0, 0.9, 0.3) if info.is_crit else (Color(1.0, 0.45, 0.4) if team_id == TeamIds.PLAYER else Color(1.0, 1.0, 1.0))
	VisualEffects.floating_text(session.effects_root, global_position, "%d" % roundi(final_amount), text_color, 56 if info.is_crit else 44)
	_flash_hit()
	if health <= 0.0:
		_die(info.source_actor_id)
	return final_amount


func heal(amount: float, reason: StringName = &"heal", show_text: bool = true) -> float:
	if not is_alive or amount <= 0.0:
		return 0.0
	var maximum: float = stats.get_value(StatIds.MAX_HEALTH)
	var applied: float = minf(amount, maximum - health)
	if applied <= 0.0:
		return 0.0
	health += applied
	_refresh_health_bar()
	health_changed.emit(health, maximum)
	if show_text and applied >= 1.0:
		VisualEffects.floating_text(session.effects_root, global_position, "+%d" % roundi(applied), Color(0.4, 1.0, 0.5), 40)
	if reason != &"regeneration":
		Events.actor_healed.emit(actor_id, applied, reason)
	return applied


func apply_slow(multiplier: float, duration: float) -> void:
	if multiplier < _slow_multiplier or session.sim_time >= _slow_until:
		_slow_multiplier = clampf(multiplier, 0.1, 1.0)
	_slow_until = maxf(_slow_until, session.sim_time + duration)


func add_impulse(impulse: Vector3) -> void:
	_impulse_velocity = (_impulse_velocity + impulse).limit_length(KNOCKBACK_LIMIT)


func grant_invulnerability(duration: float) -> void:
	invulnerable_until = maxf(invulnerable_until, session.sim_time + duration)


func begin_dash(direction: Vector3, distance: float, duration: float, ability: AbilityDefinition) -> void:
	var flat: Vector3 = Vector3(direction.x, 0.0, direction.z)
	if flat.length_squared() < 0.0001 or duration <= 0.0:
		return
	_dash_velocity = flat.normalized() * (distance / duration)
	_dash_time_left = duration
	_dash_ability = ability
	_dash_hit_ids.clear()


func _apply_dash_damage() -> void:
	if _dash_ability == null or _dash_ability.damage <= 0.0:
		return
	for target: Combatant in session.get_hostiles_in_radius(global_position, body_radius + 1.1, team_id):
		if _dash_hit_ids.has(target.actor_id):
			continue
		_dash_hit_ids[target.actor_id] = true
		var info: DamageInfo = AbilityExecutor.build_damage(self, _dash_ability)
		info.knockback_direction = _dash_velocity
		info.knockback_strength = _dash_ability.knockback
		AbilityExecutor.apply_hit(self, target, info)


## Hook called after this actor's damage lands. Default: ability + stat life steal.
func on_hit_dealt(_target: Combatant, info: DamageInfo, dealt: float) -> void:
	var steal_fraction: float = stats.get_value(StatIds.LIFE_STEAL) + info.lifesteal_fraction
	if steal_fraction > 0.0:
		heal(dealt * steal_fraction, &"life_steal", false)


## Hook called when this actor is credited with a kill.
func on_kill_credited(_victim: Combatant) -> void:
	pass


func _die(killer_actor_id: int) -> void:
	if not is_alive:
		return
	is_alive = false
	velocity = Vector3.ZERO
	_dash_time_left = 0.0
	collision_layer = 0
	collision_mask = 0
	if _health_bar_root != null:
		_health_bar_root.visible = false
	died.emit(self, killer_actor_id)
	_on_died(killer_actor_id)


## Subclass hook: runs after `died` is emitted.
func _on_died(_killer_actor_id: int) -> void:
	pass


func _refresh_health_bar() -> void:
	if _health_bar_root == null:
		return
	var fraction: float = health_fraction()
	_health_bar_root.visible = is_alive and (fraction < 0.999 or team_id == TeamIds.PLAYER)
	_health_bar_material.set_shader_parameter("fraction", fraction)


func _flash_hit() -> void:
	if _body_material == null or Settings.get_bool("accessibility/reduce_motion"):
		return
	_body_material.albedo_color = Color.WHITE
	var tween: Tween = create_tween()
	tween.tween_property(_body_material, "albedo_color", _base_color, 0.12)


func sync_health_to_max(new_maximum: float) -> void:
	if _last_max_health <= 0.0:
		_last_max_health = new_maximum
		return
	if new_maximum > _last_max_health:
		health += new_maximum - _last_max_health
	health = minf(health, new_maximum)
	_last_max_health = new_maximum
	_refresh_health_bar()
	health_changed.emit(health, new_maximum)
