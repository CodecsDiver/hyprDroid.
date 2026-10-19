class_name AbilityExecutor
extends RefCounted
## Executes ability definitions. All damage flows through build_damage() and
## apply_hit() so crits, armor, life steal and item procs behave identically for
## every ability and every actor.

## Fires `ability` for `actor` toward the actor's aim point. The caller (RunSession)
## has already validated the command; this still guards against bad state.
static func execute(actor: Combatant, ability: AbilityInstance, aim_target: Vector3) -> bool:
	var definition: AbilityDefinition = ability.definition
	if definition == null or actor.session == null:
		return false
	var direction: Vector3 = aim_target - actor.global_position
	direction.y = 0.0
	if direction.length_squared() < 0.0001:
		direction = actor.facing_direction()
	direction = direction.normalized()
	actor.aim_point = actor.global_position + direction * maxf(definition.reach, 1.0)

	match definition.kind:
		AbilityDefinition.Kind.PROJECTILE:
			_fire_projectiles(actor, definition, direction)
		AbilityDefinition.Kind.MELEE_ARC:
			_melee_arc(actor, definition, direction)
		AbilityDefinition.Kind.DASH_STRIKE:
			actor.begin_dash(direction, definition.reach, maxf(definition.duration, 0.05), definition)
		AbilityDefinition.Kind.PULSE:
			_pulse(actor, definition)
		AbilityDefinition.Kind.SUMMON_DRONE:
			_summon_drones(actor, definition)
		AbilityDefinition.Kind.VORTEX:
			_vortex(actor, definition, aim_target)
		AbilityDefinition.Kind.GUARD:
			actor.grant_invulnerability(definition.duration)
			VisualEffects.flash_disc(actor.session.effects_root, actor.global_position, 1.6, definition.color, 0.5)
	ability.start_cooldown(actor.stats)
	Events.ability_used.emit(actor.actor_id, definition.id)
	return true


## Builds a DamageInfo for `actor` using `definition`, rolling a crit.
static func build_damage(actor: Combatant, definition: AbilityDefinition, damage_scale: float = 1.0) -> DamageInfo:
	var info := DamageInfo.new()
	var amount: float = definition.damage * damage_scale * actor.stats.get_value(StatIds.DAMAGE_MULTIPLIER)
	var crit_chance: float = actor.stats.get_value(StatIds.CRIT_CHANCE)
	if crit_chance > 0.0 and actor.session.rng_combat.randf() < crit_chance:
		info.is_crit = true
		amount *= actor.stats.get_value(StatIds.CRIT_DAMAGE)
	info.amount = amount
	info.source_actor_id = actor.actor_id
	info.source_team = actor.team_id
	info.ability_id = definition.id
	info.lifesteal_fraction = definition.lifesteal_fraction
	if definition.slow_strength > 0.0:
		info.slow_multiplier = 1.0 - definition.slow_strength
		info.slow_duration = definition.slow_duration
	return info


## Applies damage and triggers the attacker's on-hit hooks. Returns damage dealt.
static func apply_hit(attacker: Combatant, target: Combatant, info: DamageInfo) -> float:
	var dealt: float = target.take_damage(info)
	if dealt > 0.0 and attacker != null and is_instance_valid(attacker):
		attacker.on_hit_dealt(target, info, dealt)
		if not target.is_alive:
			attacker.on_kill_credited(target)
	return dealt


static func _fire_projectiles(actor: Combatant, definition: AbilityDefinition, direction: Vector3) -> void:
	var count: int = maxi(definition.projectile_count, 1) + int(actor.stats.get_value(StatIds.EXTRA_PROJECTILES))
	var spread: float = deg_to_rad(definition.projectile_spread_degrees)
	var origin: Vector3 = actor.global_position + Vector3(0.0, actor.body_height * 0.6, 0.0) + direction * (actor.body_radius + 0.2)
	for index: int in count:
		var angle_offset: float = 0.0
		if count > 1:
			angle_offset = spread * (float(index) - float(count - 1) * 0.5)
		var shot_direction: Vector3 = direction.rotated(Vector3.UP, angle_offset)
		var projectile := Projectile.new()
		actor.session.projectile_root.add_child(projectile)
		projectile.launch(actor, definition, origin, shot_direction)


static func _melee_arc(actor: Combatant, definition: AbilityDefinition, direction: Vector3) -> void:
	var reach: float = definition.reach * actor.stats.get_value(StatIds.AREA_SIZE)
	var half_arc_cos: float = cos(deg_to_rad(definition.arc_degrees) * 0.5)
	VisualEffects.flash_sector(actor.session.effects_root, actor.global_position, direction, reach, definition.arc_degrees, definition.color)
	for target: Combatant in actor.session.get_hostiles_in_radius(actor.global_position, reach + 0.6, actor.team_id):
		var offset: Vector3 = target.global_position - actor.global_position
		offset.y = 0.0
		var distance: float = offset.length()
		if distance > reach + target.body_radius:
			continue
		if distance > 0.2 and offset.normalized().dot(direction) < half_arc_cos:
			continue
		var info: DamageInfo = build_damage(actor, definition)
		info.knockback_direction = direction
		info.knockback_strength = definition.knockback
		apply_hit(actor, target, info)


static func _pulse(actor: Combatant, definition: AbilityDefinition) -> void:
	var radius: float = definition.radius * actor.stats.get_value(StatIds.AREA_SIZE)
	VisualEffects.flash_disc(actor.session.effects_root, actor.global_position, radius, definition.color, 0.35)
	for target: Combatant in actor.session.get_hostiles_in_radius(actor.global_position, radius, actor.team_id):
		var away: Vector3 = target.global_position - actor.global_position
		away.y = 0.0
		var info: DamageInfo = build_damage(actor, definition)
		info.knockback_direction = away
		info.knockback_strength = definition.knockback
		apply_hit(actor, target, info)


static func _summon_drones(actor: Combatant, definition: AbilityDefinition) -> void:
	var count: int = maxi(definition.summon_count, 1) + int(actor.stats.get_value(StatIds.SUMMON_BONUS))
	actor.session.clear_summons_of(actor.actor_id)
	for index: int in count:
		var drone := SummonedDrone.new()
		actor.session.effects_root.add_child(drone)
		drone.setup(actor, definition, TAU * float(index) / float(count))


static func _vortex(actor: Combatant, definition: AbilityDefinition, aim_target: Vector3) -> void:
	var center: Vector3 = aim_target
	var offset: Vector3 = center - actor.global_position
	offset.y = 0.0
	if offset.length() > definition.reach:
		center = actor.global_position + offset.normalized() * definition.reach
	var effect := AreaEffect.new()
	actor.session.effects_root.add_child(effect)
	effect.start(actor, definition, Vector3(center.x, 0.0, center.z))
