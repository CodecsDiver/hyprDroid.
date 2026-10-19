class_name SingularityActor
extends Combatant
## A playable singularity: one character with its own stats, abilities, XP,
## upgrades and items. It is driven by exactly one controller (human, conventional
## AI or, later, an external agent) through validated commands.

var definition: SingularityDefinition
var controller_id: int = -1
var is_human_controlled: bool = false
var progression: ProgressionTracker
var inventory := ActorInventory.new()


func setup(run_session: RunSession, new_actor_id: int, singularity: SingularityDefinition, owner_controller_id: int, human: bool, spawn_position: Vector3) -> void:
	session = run_session
	actor_id = new_actor_id
	definition = singularity
	controller_id = owner_controller_id
	is_human_controlled = human
	team_id = TeamIds.PLAYER
	display_name = singularity.display_name
	archetype_id = singularity.id
	name = "Singularity_%s_%d" % [singularity.id, new_actor_id]

	stats.set_base_values(singularity.base_stats)
	stats.changed.connect(_on_stats_changed)
	health = stats.get_value(StatIds.MAX_HEALTH)
	_last_max_health = health
	progression = ProgressionTracker.new(Balance.config.xp_curve)
	progression.level_gained.connect(_on_level_gained)
	inventory.changed.connect(_on_inventory_changed)

	abilities = [
		AbilityInstance.new(singularity.primary_ability, true),
		AbilityInstance.new(singularity.ability_one),
		AbilityInstance.new(singularity.ability_two),
	]
	var mesh: Mesh = VisualEffects.body_mesh_for(singularity.body_shape)
	build_body(mesh, singularity.color, 0.45, 1.8)
	global_position = spawn_position
	aim_point = spawn_position + Vector3.FORWARD * 3.0
	_refresh_health_bar()


func get_ability_for_slot(slot: int) -> AbilityInstance:
	if slot == ActionCommand.SLOT_EQUIPMENT:
		return inventory.equipment_ability
	return super.get_ability_for_slot(slot)


func _on_tick(delta: float) -> void:
	if inventory.equipment_ability != null:
		inventory.equipment_ability.tick(delta)


# --- Progression ------------------------------------------------------------------

## Adds XP after the xp_gain multiplier. Returns the XP actually credited.
func gain_xp(base_amount: float) -> float:
	var credited: float = base_amount * stats.get_value(StatIds.XP_GAIN)
	progression.add_xp(credited)
	Events.xp_gained.emit(actor_id, credited)
	_ensure_upgrade_choices()
	return credited


func _on_level_gained(new_level: int) -> void:
	Events.level_gained.emit(actor_id, new_level)
	VisualEffects.floating_text(session.effects_root, global_position, "LEVEL %d" % new_level, Color(1.0, 0.95, 0.4), 64)


func _ensure_upgrade_choices() -> void:
	if not progression.needs_choice_roll():
		return
	progression.pending_choices = UpgradeRoller.roll_upgrades(definition.id, inventory, progression.level, session.rng_upgrade, Balance.config.upgrade_choice_count)
	if progression.pending_choices.is_empty():
		# Nothing at all to offer (empty data): drop the queued level-up rather than soft-lock.
		progression.pending_level_ups = maxi(progression.pending_level_ups - 1, 0)
		push_warning("SingularityActor %d: no upgrades available to offer." % actor_id)
		return
	Events.upgrade_choices_ready.emit(actor_id)


## Applies the chosen upgrade. Returns false on an invalid index.
func choose_upgrade(index: int) -> bool:
	var picked: UpgradeDefinition = progression.take_choice(index)
	if picked == null:
		return false
	var new_stacks: int = inventory.add_upgrade(picked)
	if picked.instant_heal_fraction > 0.0:
		heal(stats.get_value(StatIds.MAX_HEALTH) * picked.instant_heal_fraction, &"upgrade")
	Events.upgrade_selected.emit(actor_id, picked.id, new_stacks)
	_ensure_upgrade_choices()
	return true


func acquire_item(item: ItemDefinition) -> int:
	var new_stacks: int = inventory.add_item(item)
	if new_stacks > 0:
		Events.item_acquired.emit(actor_id, item.id, new_stacks)
	return new_stacks


func _on_inventory_changed() -> void:
	inventory.apply_to_stats(stats)


func _on_stats_changed() -> void:
	sync_health_to_max(stats.get_value(StatIds.MAX_HEALTH))


# --- Item procs ------------------------------------------------------------------

func on_hit_dealt(target: Combatant, info: DamageInfo, dealt: float) -> void:
	super.on_hit_dealt(target, info, dealt)
	if not info.can_proc or not target.is_alive:
		return
	for entry: Dictionary in inventory.items_with_proc(ItemDefinition.ProcKind.ON_HIT_EXPLOSION):
		var item: ItemDefinition = entry["definition"]
		var stacks: int = entry["stacks"]
		if session.rng_combat.randf() < item.chance_for_stacks(stacks):
			_trigger_explosion(target.global_position, info.amount * item.value_for_stacks(stacks), item)
	for entry: Dictionary in inventory.items_with_proc(ItemDefinition.ProcKind.ON_HIT_SLOW):
		var item: ItemDefinition = entry["definition"]
		var stacks: int = entry["stacks"]
		if session.rng_combat.randf() < item.chance_for_stacks(stacks):
			target.apply_slow(1.0 - clampf(item.value_for_stacks(stacks), 0.0, 0.9), item.proc_duration)


func on_kill_credited(victim: Combatant) -> void:
	super.on_kill_credited(victim)
	for entry: Dictionary in inventory.items_with_proc(ItemDefinition.ProcKind.ON_KILL_HEAL):
		var item: ItemDefinition = entry["definition"]
		heal(item.value_for_stacks(entry["stacks"]), &"item")


func _trigger_explosion(center: Vector3, damage: float, item: ItemDefinition) -> void:
	var radius: float = item.proc_radius * stats.get_value(StatIds.AREA_SIZE)
	VisualEffects.flash_disc(session.effects_root, center, radius, Color(1.0, 0.6, 0.2), 0.25)
	for hostile: Combatant in session.get_hostiles_in_radius(center, radius, team_id):
		var explosion := DamageInfo.new()
		explosion.amount = damage
		explosion.source_actor_id = actor_id
		explosion.source_team = team_id
		explosion.ability_id = item.id
		explosion.can_proc = false
		AbilityExecutor.apply_hit(self, hostile, explosion)


func _on_died(_killer_actor_id: int) -> void:
	if _visual_root != null:
		_visual_root.rotation.z = deg_to_rad(80.0)
