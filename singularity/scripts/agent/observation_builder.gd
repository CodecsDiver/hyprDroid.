class_name ObservationBuilder
extends RefCounted
## Builds the read-only, JSON-serialisable observation an actor's controller may see.
##
## Visibility is bounded by the controller's AgentCapabilityProfile: entities beyond
## `observation_radius` are omitted, and nothing here exposes hidden simulation
## state (spawn queues, enemy stat sheets, other actors' inventories, RNG seeds).

const SCHEMA_VERSION := 1


static func build(session: RunSession, actor: Combatant, profile: AgentCapabilityProfile) -> Dictionary:
	var origin: Vector3 = actor.global_position
	var radius: float = profile.observation_radius
	var observation: Dictionary = {
		"schema_version": SCHEMA_VERSION,
		"tick": session.tick_count,
		"time_seconds": snappedf(session.sim_time, 0.001),
		"run_active": session.is_run_active(),
		"self": _describe_self(actor),
		"arena": _describe_arena(session),
		"allies": [],
		"enemies": [],
		"pickups": [],
		"hazards": [],
		"interactables": [],
	}

	var allies: Array = []
	var enemies: Array = []
	for combatant: Combatant in session.get_all_living():
		if combatant == actor:
			continue
		var distance: float = _distance_xz(origin, combatant.global_position)
		if distance > radius:
			continue
		if combatant.team_id == actor.team_id:
			allies.append(_describe_ally(combatant, distance))
		else:
			enemies.append(_describe_enemy(combatant, distance))
	observation["allies"] = _closest(allies, profile.max_observed_entities)
	observation["enemies"] = _closest(enemies, profile.max_observed_entities)

	var pickups: Array = []
	for gem: XpGem in session.get_gems():
		var distance: float = _distance_xz(origin, gem.global_position)
		if distance <= radius:
			pickups.append({
				"id": gem.gem_id, "kind": "xp_gem", "value": snappedf(gem.xp_value, 0.1),
				"position": _flat(gem.global_position), "distance": snappedf(distance, 0.01),
			})
	observation["pickups"] = _closest(pickups, maxi(profile.max_observed_entities / 2, 8))

	var interactables: Array = []
	for node: Node3D in session.get_interactables():
		var distance: float = _distance_xz(origin, node.global_position)
		if distance > radius or not node.has_method("can_interact") or not node.can_interact(actor):
			continue
		interactables.append({
			"id": node.get("interactable_id"), "kind": "item_chest", "position": _flat(node.global_position),
			"distance": snappedf(distance, 0.01), "in_range": distance <= Balance.config.interact_range,
		})
	observation["interactables"] = _closest(interactables, 16)

	var hazards: Array = []
	for hazard: Node in session.get_tree().get_nodes_in_group("hazards"):
		var hazard_zone := hazard as HazardZone
		if hazard_zone != null and _distance_xz(origin, hazard_zone.global_position) <= radius + maxf(hazard_zone.radius, hazard_zone.half_extents.length()):
			hazards.append(hazard_zone.describe_for_observation())
	observation["hazards"] = hazards
	return observation


static func _describe_self(actor: Combatant) -> Dictionary:
	var description: Dictionary = {
		"id": actor.actor_id,
		"name": actor.display_name,
		"archetype": String(actor.archetype_id),
		"team": actor.team_id,
		"position": _flat(actor.global_position),
		"aim_point": _flat(actor.aim_point),
		"health": snappedf(actor.health, 0.1),
		"max_health": snappedf(actor.stats.get_value(StatIds.MAX_HEALTH), 0.1),
		"move_speed": snappedf(actor.stats.get_value(StatIds.MOVE_SPEED), 0.01),
		"is_dashing": actor.is_dashing(),
		"abilities": _describe_abilities(actor),
		"stats": actor.stats.snapshot(),
	}
	var singularity := actor as SingularityActor
	if singularity != null:
		description["level"] = singularity.progression.level
		description["xp_in_level"] = snappedf(singularity.progression.xp_in_level, 0.1)
		description["xp_to_next_level"] = snappedf(singularity.progression.xp_to_next_level(), 0.1)
		description["pending_level_ups"] = singularity.progression.pending_level_ups
		description["pending_upgrade_choices"] = _describe_choices(singularity)
		description["upgrades"] = _stack_table(singularity.inventory.upgrade_stacks)
		description["items"] = _stack_table(singularity.inventory.item_stacks)
	return description


static func _describe_abilities(actor: Combatant) -> Array:
	var described: Array = []
	for slot: int in range(0, 4):
		var instance: AbilityInstance = actor.abilities[0] if slot == 0 and not actor.abilities.is_empty() else actor.get_ability_for_slot(slot)
		if instance == null:
			continue
		described.append({
			"slot": slot,
			"id": String(instance.definition.id),
			"name": instance.definition.display_name,
			"kind": AbilityDefinition.Kind.keys()[instance.definition.kind].to_lower(),
			"ready": instance.is_ready(),
			"cooldown_remaining": snappedf(instance.cooldown_remaining, 0.01),
			"reach": _effective_reach(instance.definition),
			"radius": instance.definition.radius,
		})
	return described


## Pulses and guards act around the user, so their "reach" is the area radius (or zero).
static func _effective_reach(definition: AbilityDefinition) -> float:
	match definition.kind:
		AbilityDefinition.Kind.PULSE:
			return definition.radius
		AbilityDefinition.Kind.GUARD:
			return 0.0
		_:
			return definition.reach


static func _describe_choices(singularity: SingularityActor) -> Array:
	var choices: Array = []
	for index: int in singularity.progression.pending_choices.size():
		var upgrade: UpgradeDefinition = singularity.progression.pending_choices[index]
		choices.append({
			"index": index, "id": String(upgrade.id), "name": upgrade.display_name,
			"rarity": Rarity.key(upgrade.rarity), "effects": upgrade.describe_effects(),
			"current_stacks": singularity.inventory.get_upgrade_stacks(upgrade.id),
		})
	return choices


static func _describe_ally(combatant: Combatant, distance: float) -> Dictionary:
	return {
		"id": combatant.actor_id, "name": combatant.display_name, "position": _flat(combatant.global_position),
		"health_fraction": snappedf(combatant.health_fraction(), 0.01), "distance": snappedf(distance, 0.01),
	}


## Public information only: no exact health, damage or stat values for enemies.
static func _describe_enemy(combatant: Combatant, distance: float) -> Dictionary:
	var enemy := combatant as EnemyActor
	return {
		"id": combatant.actor_id,
		"type": String(combatant.archetype_id),
		"position": _flat(combatant.global_position),
		"health_fraction": snappedf(combatant.health_fraction(), 0.01),
		"distance": snappedf(distance, 0.01),
		"is_elite": enemy != null and enemy.definition.is_elite,
		"is_ranged": enemy != null and enemy.definition.preferred_distance > 0.0,
	}


static func _describe_arena(session: RunSession) -> Dictionary:
	var bounds: Rect2 = session.map_info.get("bounds", Rect2())
	return {
		"map": String(session.config.map_id),
		"min": [bounds.position.x, bounds.position.y],
		"max": [bounds.end.x, bounds.end.y],
	}


static func _stack_table(stacks: Dictionary) -> Dictionary:
	var table: Dictionary = {}
	for key: String in stacks.keys():
		table[key] = int(stacks[key])
	return table


static func _closest(entries: Array, limit: int) -> Array:
	entries.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a["distance"]) < float(b["distance"]))
	if entries.size() > limit:
		entries.resize(limit)
	return entries


static func _flat(position: Vector3) -> Array:
	return [snappedf(position.x, 0.01), snappedf(position.z, 0.01)]


static func _distance_xz(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()
