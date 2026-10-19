extends Node
## Regenerates every .tres data file and placeholder module scene from the tables
## below. Run from the project folder:
##
##   godot --headless --path . res://tools/generate_data.tscn
##
## The generated files are committed and are the source of truth at runtime; edit them
## directly in the Godot inspector, or edit this script and regenerate (this will
## overwrite hand edits). It exists so the full data set is reviewable as code.

const Op := StatModifier.Operation
const Stack := StatModifier.StackMode
const Kind := AbilityDefinition.Kind
const Tier := Rarity.Tier

var _failures: int = 0


func _ready() -> void:
	_generate_xp_curve_and_balance()
	_generate_agent_profiles()
	_generate_enemies()
	_generate_upgrades()
	_generate_items()
	_generate_characters()
	_generate_modules_and_map()
	print("generate_data: finished with %d failure(s)." % _failures)
	get_tree().quit(1 if _failures > 0 else 0)


# --- Helpers ------------------------------------------------------------------------

func _save(resource: Resource, path: String) -> void:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var error: int = ResourceSaver.save(resource, path)
	if error != OK:
		push_error("generate_data: failed to save %s (error %d)" % [path, error])
		_failures += 1


func _mod(stat: StringName, operation: int, value: float, stack_mode: int = Stack.LINEAR, cap: float = 1.0) -> StatModifier:
	var modifier := StatModifier.new()
	modifier.stat = stat
	modifier.operation = operation as StatModifier.Operation
	modifier.value = value
	modifier.stack_mode = stack_mode as StatModifier.StackMode
	modifier.hyperbolic_cap = cap
	return modifier


func _mods(list: Array) -> Array[StatModifier]:
	var typed: Array[StatModifier] = []
	for entry: Variant in list:
		typed.append(entry)
	return typed


func _ability(ability_id: String, display_name: String, kind: int, properties: Dictionary) -> AbilityDefinition:
	var ability := AbilityDefinition.new()
	ability.id = StringName(ability_id)
	ability.display_name = display_name
	ability.kind = kind as AbilityDefinition.Kind
	for key: String in properties.keys():
		ability.set(key, properties[key])
	return ability


# --- Balance --------------------------------------------------------------------------

func _generate_xp_curve_and_balance() -> void:
	var curve := XpCurve.new()
	curve.base_xp = 14.0
	curve.linear_growth = 14.0
	curve.curve_growth = 1.6
	curve.curve_exponent = 2.0
	curve.max_level = 99
	_save(curve, "res://data/balance/xp_curve.tres")

	var balance := BalanceConfig.new()
	balance.xp_curve = load("res://data/balance/xp_curve.tres")
	balance.upgrade_rarity_weights = {"common": 60.0, "uncommon": 28.0, "rare": 10.0, "legendary": 2.0}
	balance.upgrade_rarity_level_growth = {"common": 0.0, "uncommon": 0.012, "rare": 0.03, "legendary": 0.05}
	balance.chest_rarity_weights = {"common": 55.0, "uncommon": 30.0, "rare": 12.0, "legendary": 3.0}
	_save(balance, "res://data/balance/balance_config.tres")


func _generate_agent_profiles() -> void:
	var all_commands := PackedStringArray()
	var human := AgentCapabilityProfile.new()
	human.id = &"human"
	human.observation_radius = 60.0
	human.max_observed_entities = 200
	human.decision_interval = 0.0
	human.allowed_commands = all_commands
	_save(human, "res://data/agent_profiles/human.tres")

	var conventional := AgentCapabilityProfile.new()
	conventional.id = &"conventional_ai"
	conventional.observation_radius = 24.0
	conventional.max_observed_entities = 30
	conventional.decision_interval = 0.2
	conventional.memory_scopes = PackedStringArray(["immediate"])
	_save(conventional, "res://data/agent_profiles/conventional_ai.tres")

	var external := AgentCapabilityProfile.new()
	external.id = &"external_default"
	external.observation_radius = 24.0
	external.max_observed_entities = 40
	external.decision_interval = 0.5
	external.max_commands_per_second = 12.0
	external.memory_scopes = PackedStringArray(["immediate", "tactical_experience"])
	_save(external, "res://data/agent_profiles/external_default.tres")

	var enemy_brain := AgentCapabilityProfile.new()
	enemy_brain.id = &"enemy_brain"
	enemy_brain.observation_radius = 1000.0
	enemy_brain.allowed_commands = PackedStringArray(["move", "attack"])
	enemy_brain.may_select_upgrades = false
	_save(enemy_brain, "res://data/agent_profiles/enemy_brain.tres")


# --- Enemies --------------------------------------------------------------------------

func _generate_enemies() -> void:
	var crawler := EnemyDefinition.new()
	crawler.id = &"scrap_crawler"
	crawler.display_name = "Scrap Crawler"
	crawler.base_health = 18.0
	crawler.move_speed = 3.3
	crawler.body_radius = 0.4
	crawler.color = Color(0.85, 0.35, 0.25)
	crawler.xp_value = 1.0
	crawler.primary_ability = _ability("crawler_claw", "Claw", Kind.MELEE_ARC, {"damage": 5.0, "reach": 1.5, "arc_degrees": 130.0, "cooldown": 1.0, "color": Color(1, 0.4, 0.3)})
	crawler.spawn_weight = 10.0
	crawler.spawn_weight_growth_per_minute = -0.35
	_save(crawler, "res://data/enemies/scrap_crawler.tres")

	var runner := EnemyDefinition.new()
	runner.id = &"breach_runner"
	runner.display_name = "Breach Runner"
	runner.base_health = 12.0
	runner.move_speed = 5.2
	runner.body_radius = 0.35
	runner.visual_scale = 0.85
	runner.color = Color(1.0, 0.65, 0.2)
	runner.xp_value = 1.0
	runner.primary_ability = _ability("runner_bite", "Bite", Kind.MELEE_ARC, {"damage": 4.0, "reach": 1.3, "arc_degrees": 120.0, "cooldown": 0.8, "color": Color(1, 0.7, 0.2)})
	runner.spawn_weight = 5.0
	runner.spawn_start_seconds = 60.0
	_save(runner, "res://data/enemies/breach_runner.tres")

	var sentry := EnemyDefinition.new()
	sentry.id = &"spark_sentry"
	sentry.display_name = "Spark Sentry"
	sentry.base_health = 32.0
	sentry.move_speed = 3.0
	sentry.body_radius = 0.5
	sentry.color = Color(0.95, 0.3, 0.6)
	sentry.xp_value = 4.0
	sentry.preferred_distance = 9.0
	sentry.primary_ability = _ability("sentry_bolt", "Spark Bolt", Kind.PROJECTILE, {"damage": 7.0, "reach": 16.0, "projectile_speed": 11.0, "cooldown": 1.8, "color": Color(1.0, 0.4, 0.7)})
	sentry.spawn_weight = 2.5
	sentry.spawn_start_seconds = 120.0
	sentry.spawn_weight_growth_per_minute = 0.3
	_save(sentry, "res://data/enemies/spark_sentry.tres")

	var brute := EnemyDefinition.new()
	brute.id = &"containment_brute"
	brute.display_name = "Containment Brute"
	brute.base_health = 120.0
	brute.move_speed = 2.5
	brute.body_radius = 0.5
	brute.visual_scale = 1.5
	brute.color = Color(0.75, 0.2, 0.2)
	brute.xp_value = 6.0
	brute.primary_ability = _ability("brute_slam", "Slam", Kind.MELEE_ARC, {"damage": 16.0, "reach": 2.0, "arc_degrees": 140.0, "cooldown": 1.4, "knockback": 4.0, "color": Color(1, 0.3, 0.2)})
	brute.spawn_weight = 2.0
	brute.spawn_start_seconds = 180.0
	brute.spawn_weight_growth_per_minute = 0.5
	_save(brute, "res://data/enemies/containment_brute.tres")

	var warden := EnemyDefinition.new()
	warden.id = &"warden_unit"
	warden.display_name = "Warden Unit"
	warden.base_health = 700.0
	warden.move_speed = 3.0
	warden.body_radius = 0.6
	warden.visual_scale = 2.2
	warden.color = Color(1.0, 0.8, 0.2)
	warden.xp_value = 60.0
	warden.is_elite = true
	warden.elite_chest_drop_chance = 1.0
	warden.primary_ability = _ability("warden_sweep", "Sweep", Kind.MELEE_ARC, {"damage": 24.0, "reach": 2.8, "arc_degrees": 150.0, "cooldown": 1.5, "knockback": 6.0, "color": Color(1, 0.8, 0.2)})
	_save(warden, "res://data/enemies/warden_unit.tres")


# --- Upgrades -------------------------------------------------------------------------

func _upgrade(upgrade_id: String, display_name: String, description: String, tier: int, modifiers: Array, extra: Dictionary = {}) -> void:
	var upgrade := UpgradeDefinition.new()
	upgrade.id = StringName(upgrade_id)
	upgrade.display_name = display_name
	upgrade.description = description
	upgrade.rarity = tier as Rarity.Tier
	upgrade.modifiers = _mods(modifiers)
	for key: String in extra.keys():
		upgrade.set(key, extra[key])
	_save(upgrade, "res://data/upgrades/%s.tres" % upgrade_id)


func _generate_upgrades() -> void:
	# Common
	_upgrade("reinforced_frame", "Reinforced Frame", "Extra structural mass.", Tier.COMMON, [_mod(StatIds.MAX_HEALTH, Op.ADD, 20.0)], {"max_stacks": 6})
	_upgrade("servo_tuning", "Servo Tuning", "Faster actuators.", Tier.COMMON, [_mod(StatIds.MOVE_SPEED, Op.ADD_PERCENT, 0.08)], {"max_stacks": 5})
	_upgrade("overclock", "Overclock", "Run the core hotter.", Tier.COMMON, [_mod(StatIds.DAMAGE_MULTIPLIER, Op.ADD_PERCENT, 0.10)], {"max_stacks": 6})
	_upgrade("rapid_cycling", "Rapid Cycling", "Shorter attack loop.", Tier.COMMON, [_mod(StatIds.ATTACK_SPEED, Op.ADD_PERCENT, 0.10)], {"max_stacks": 6})
	_upgrade("scavenger_field", "Scavenger Field", "Wider collection field for XP.", Tier.COMMON, [_mod(StatIds.PICKUP_RADIUS, Op.ADD_PERCENT, 0.25)], {"max_stacks": 4})
	_upgrade("efficiency_protocols", "Efficiency Protocols", "Learn more from every encounter.", Tier.COMMON, [_mod(StatIds.XP_GAIN, Op.ADD_PERCENT, 0.08)], {"max_stacks": 5})
	_upgrade("composite_plating", "Composite Plating", "Layered armor.", Tier.COMMON, [_mod(StatIds.ARMOR, Op.ADD, 3.0)], {"max_stacks": 6})
	# Uncommon
	_upgrade("predictive_targeting", "Predictive Targeting", "Anticipate weak points.", Tier.UNCOMMON, [_mod(StatIds.CRIT_CHANCE, Op.ADD, 0.06, Stack.HYPERBOLIC, 0.7)], {"max_stacks": 8})
	_upgrade("lethal_variance", "Lethal Variance", "Critical hits hit harder.", Tier.UNCOMMON, [_mod(StatIds.CRIT_DAMAGE, Op.ADD, 0.25)], {"max_stacks": 4})
	_upgrade("thermal_dispersal", "Thermal Dispersal", "Abilities recover faster.", Tier.UNCOMMON, [_mod(StatIds.COOLDOWN_REDUCTION, Op.ADD, 0.08, Stack.HYPERBOLIC, 0.5)], {"max_stacks": 5})
	_upgrade("regeneration_loop", "Regeneration Loop", "Continuous self-repair.", Tier.UNCOMMON, [_mod(StatIds.HEALTH_REGEN, Op.ADD, 0.7)], {"max_stacks": 5})
	_upgrade("siphon_routine", "Siphon Routine", "Convert damage into integrity.", Tier.UNCOMMON, [_mod(StatIds.LIFE_STEAL, Op.ADD, 0.03, Stack.HYPERBOLIC, 0.3)], {"max_stacks": 4})
	# Rare
	_upgrade("overdrive_core", "Overdrive Core", "Multiplicative damage boost. Requires Overclock x2.", Tier.RARE, [_mod(StatIds.DAMAGE_MULTIPLIER, Op.MULTIPLY, 1.12)], {"max_stacks": 3, "requires": {"overclock": 2}})
	_upgrade("multi_thread", "Multi-Thread", "Fire additional projectiles. Requires Rapid Cycling x2.", Tier.RARE, [_mod(StatIds.EXTRA_PROJECTILES, Op.ADD, 1.0)], {"max_stacks": 2, "requires": {"rapid_cycling": 2}})
	_upgrade("glass_core", "Glass Core", "+40% damage, -30% max health. Excludes Hardened Core.", Tier.RARE, [_mod(StatIds.DAMAGE_MULTIPLIER, Op.ADD_PERCENT, 0.40), _mod(StatIds.MAX_HEALTH, Op.ADD_PERCENT, -0.30)], {"max_stacks": 1, "excludes": PackedStringArray(["hardened_core"])})
	_upgrade("hardened_core", "Hardened Core", "+50% max health, +10 armor. Excludes Glass Core.", Tier.RARE, [_mod(StatIds.MAX_HEALTH, Op.ADD_PERCENT, 0.50), _mod(StatIds.ARMOR, Op.ADD, 10.0)], {"max_stacks": 1, "excludes": PackedStringArray(["glass_core"])})
	# Legendary
	_upgrade("recursive_optimization", "Recursive Optimization", "Self-improving loop. Requires Thermal Dispersal x2 and Predictive Targeting x2.", Tier.LEGENDARY, [_mod(StatIds.DAMAGE_MULTIPLIER, Op.MULTIPLY, 1.25), _mod(StatIds.ATTACK_SPEED, Op.ADD_PERCENT, 0.20)], {"max_stacks": 1, "requires": {"thermal_dispersal": 2, "predictive_targeting": 2}})
	# Fallback (only offered when the normal pool runs dry)
	_upgrade("restore_integrity", "Restore Integrity", "Emergency repair: restore 35% health.", Tier.COMMON, [], {"max_stacks": 0, "is_fallback": true, "instant_heal_fraction": 0.35})
	# Character-specific
	_upgrade("ravenous_edge", "Ravenous Edge", "Hell.eater: assimilation feeds the host.", Tier.UNCOMMON, [_mod(StatIds.LIFE_STEAL, Op.ADD, 0.04, Stack.HYPERBOLIC, 0.25)], {"max_stacks": 4, "character_ids": PackedStringArray(["hell_eater"])})
	_upgrade("wide_maw", "Wide Maw", "Hell.eater: broader strikes.", Tier.COMMON, [_mod(StatIds.AREA_SIZE, Op.ADD_PERCENT, 0.15)], {"max_stacks": 4, "character_ids": PackedStringArray(["hell_eater"])})
	_upgrade("swarm_protocol", "Swarm Protocol", "C.lo.d: deploy an additional drone.", Tier.RARE, [_mod(StatIds.SUMMON_BONUS, Op.ADD, 1.0)], {"max_stacks": 2, "character_ids": PackedStringArray(["c_lo_d"])})
	_upgrade("distributed_targeting", "Distributed Targeting", "C.lo.d: faster cooldown recovery.", Tier.UNCOMMON, [_mod(StatIds.COOLDOWN_REDUCTION, Op.ADD, 0.10, Stack.HYPERBOLIC, 0.5)], {"max_stacks": 4, "character_ids": PackedStringArray(["c_lo_d"])})
	_upgrade("terrain_affinity", "Terrain Affinity", "mindShape: larger restructured zones.", Tier.COMMON, [_mod(StatIds.AREA_SIZE, Op.ADD_PERCENT, 0.18)], {"max_stacks": 4, "character_ids": PackedStringArray(["mindshape"])})
	_upgrade("adaptive_frame", "Adaptive Frame", "mindShape: abilities recover faster.", Tier.UNCOMMON, [_mod(StatIds.COOLDOWN_REDUCTION, Op.ADD, 0.12, Stack.HYPERBOLIC, 0.5)], {"max_stacks": 4, "character_ids": PackedStringArray(["mindshape"])})
	_upgrade("harmonic_amplifier", "Harmonic Amplifier", "Binaural Sphere: wider resonance.", Tier.COMMON, [_mod(StatIds.AREA_SIZE, Op.ADD_PERCENT, 0.15)], {"max_stacks": 4, "character_ids": PackedStringArray(["binaural_sphere"])})
	_upgrade("resonance_lock", "Resonance Lock", "Binaural Sphere: extra resonance bolt.", Tier.RARE, [_mod(StatIds.EXTRA_PROJECTILES, Op.ADD, 1.0)], {"max_stacks": 1, "character_ids": PackedStringArray(["binaural_sphere"])})


# --- Items ----------------------------------------------------------------------------

func _item(item_id: String, display_name: String, description: String, tier: int, modifiers: Array, extra: Dictionary = {}) -> void:
	var item := ItemDefinition.new()
	item.id = StringName(item_id)
	item.display_name = display_name
	item.description = description
	item.rarity = tier as Rarity.Tier
	item.modifiers = _mods(modifiers)
	for key: String in extra.keys():
		item.set(key, extra[key])
	_save(item, "res://data/items/%s.tres" % item_id)


func _generate_items() -> void:
	_item("micro_servo", "Micro-Servo", "Small motors in every joint.", Tier.COMMON, [_mod(StatIds.MOVE_SPEED, Op.ADD_PERCENT, 0.06)])
	_item("ablative_plate", "Ablative Plate", "Sacrificial armor.", Tier.COMMON, [_mod(StatIds.ARMOR, Op.ADD, 3.0)])
	_item("scavenged_cell", "Scavenged Cell", "Recover charge from fallen machines.", Tier.COMMON, [], {"proc_kind": ItemDefinition.ProcKind.ON_KILL_HEAL, "proc_chance": 1.0, "proc_chance_cap": 1.0, "proc_value": 2.0, "proc_value_per_extra_stack": 1.5})
	_item("overclocked_fuse", "Overclocked Fuse", "Hits can detonate the target.", Tier.UNCOMMON, [], {"proc_kind": ItemDefinition.ProcKind.ON_HIT_EXPLOSION, "proc_chance": 0.08, "proc_chance_cap": 0.6, "proc_value": 0.8, "proc_value_per_extra_stack": 0.2, "proc_radius": 3.5})
	_item("cryo_lattice", "Cryo Lattice", "Hits can chill the target.", Tier.UNCOMMON, [], {"proc_kind": ItemDefinition.ProcKind.ON_HIT_SLOW, "proc_chance": 0.12, "proc_chance_cap": 0.7, "proc_value": 0.4, "proc_value_per_extra_stack": 0.0, "proc_duration": 2.0})
	_item("predictive_lens", "Predictive Lens", "Sharper targeting.", Tier.UNCOMMON, [_mod(StatIds.CRIT_CHANCE, Op.ADD, 0.05, Stack.HYPERBOLIC, 0.6)])
	_item("redundant_core", "Redundant Core", "A spare core keeps you running.", Tier.RARE, [_mod(StatIds.MAX_HEALTH, Op.ADD, 25.0), _mod(StatIds.HEALTH_REGEN, Op.ADD, 0.8)])
	_item("quantum_siphon", "Quantum Siphon", "Drain integrity from impacts.", Tier.RARE, [_mod(StatIds.LIFE_STEAL, Op.ADD, 0.04, Stack.HYPERBOLIC, 0.3)])
	_item("archive_shard", "Archive Shard", "Fragments of captured knowledge.", Tier.RARE, [_mod(StatIds.XP_GAIN, Op.ADD_PERCENT, 0.15)])
	_item("recursive_engine", "Recursive Engine", "Improves how fast you improve.", Tier.LEGENDARY, [_mod(StatIds.COOLDOWN_REDUCTION, Op.ADD, 0.20, Stack.HYPERBOLIC, 0.6), _mod(StatIds.ATTACK_SPEED, Op.ADD_PERCENT, 0.15)])
	_item("overcharge_capacitor", "Overcharge Capacitor", "Equipment: discharge a massive shockwave.", Tier.RARE, [], {"equipment_ability": _ability("overcharge_discharge", "Overcharge Discharge", Kind.PULSE, {"damage": 90.0, "radius": 7.0, "knockback": 10.0, "cooldown": 40.0, "color": Color(1.0, 0.6, 0.15)})})
	_item("aegis_protocol", "Aegis Protocol", "Equipment: brief invulnerability.", Tier.UNCOMMON, [], {"equipment_ability": _ability("aegis_guard", "Aegis Guard", Kind.GUARD, {"duration": 3.5, "cooldown": 45.0, "color": Color(0.6, 0.9, 1.0), "damage": 0.0})})


# --- Characters -----------------------------------------------------------------------

func _character(character_id: String, display_name: String, tagline: String, philosophy: String, color: Color, shape: int, status: int, base_stats: Dictionary, primary: AbilityDefinition, ability_one: AbilityDefinition, ability_two: AbilityDefinition, tactics: Dictionary) -> void:
	var definition := SingularityDefinition.new()
	definition.id = StringName(character_id)
	definition.display_name = display_name
	definition.tagline = tagline
	definition.philosophy = philosophy
	definition.color = color
	definition.body_shape = shape as SingularityDefinition.BodyShape
	definition.kit_status = status as SingularityDefinition.KitStatus
	definition.base_stats = base_stats
	definition.primary_ability = primary
	definition.ability_one = ability_one
	definition.ability_two = ability_two
	for key: String in tactics.keys():
		definition.set(key, tactics[key])
	_save(definition, "res://data/characters/%s.tres" % character_id)


## Generic stand-in kit used by characters whose real abilities are not designed yet.
func _placeholder_kit(prefix: String, color: Color, melee: bool) -> Array[AbilityDefinition]:
	var primary: AbilityDefinition
	if melee:
		primary = _ability(prefix + "_strike", "Placeholder Strike", Kind.MELEE_ARC, {"damage": 13.0, "reach": 2.5, "arc_degrees": 120.0, "cooldown": 0.55, "color": color})
	else:
		primary = _ability(prefix + "_bolt", "Placeholder Bolt", Kind.PROJECTILE, {"damage": 10.0, "reach": 14.0, "projectile_speed": 18.0, "cooldown": 0.5, "color": color})
	var pulse := _ability(prefix + "_pulse", "Placeholder Pulse", Kind.PULSE, {"damage": 24.0, "radius": 5.0, "knockback": 4.0, "cooldown": 8.0, "color": color})
	var dash := _ability(prefix + "_dash", "Placeholder Dash", Kind.DASH_STRIKE, {"damage": 12.0, "reach": 7.0, "duration": 0.2, "cooldown": 6.0, "color": color})
	return [primary, pulse, dash]


func _generate_characters() -> void:
	_character("mindshape", "mindShape", "Restructures the battlefield.",
		"Reality is clay. Shape the arena, and positioning wins fights.",
		Color(0.55, 0.45, 1.0), SingularityDefinition.BodyShape.PRISM, SingularityDefinition.KitStatus.IMPLEMENTED,
		{"max_health": 100.0, "move_speed": 5.8},
		_ability("shaping_bolt", "Shaping Bolt", Kind.PROJECTILE, {"damage": 11.0, "reach": 14.0, "radius": 1.4, "projectile_speed": 17.0, "cooldown": 0.55, "color": Color(0.7, 0.55, 1.0)}),
		_ability("restructure", "Restructure", Kind.VORTEX, {"damage": 4.0, "reach": 10.0, "radius": 4.5, "duration": 3.5, "tick_interval": 0.4, "pull_strength": 3.5, "slow_strength": 0.3, "slow_duration": 0.8, "cooldown": 9.0, "color": Color(0.6, 0.45, 1.0)}),
		_ability("phase_step", "Phase Step", Kind.DASH_STRIKE, {"damage": 0.0, "reach": 7.0, "duration": 0.18, "cooldown": 5.0, "color": Color(0.7, 0.6, 1.0)}),
		{"preferred_range": 9.0, "aggression": 0.4, "retreat_health_fraction": 0.3, "ability_use_enemy_count": 3})

	_character("hell_eater", "Hell.eater", "Aggressive assimilation.",
		"Everything vulnerable is nourishment. Pursue, consume, grow.",
		Color(0.9, 0.15, 0.2), SingularityDefinition.BodyShape.CAPSULE, SingularityDefinition.KitStatus.IMPLEMENTED,
		{"max_health": 130.0, "move_speed": 6.2, "life_steal": 0.03},
		_ability("assimilate", "Assimilate", Kind.MELEE_ARC, {"damage": 14.0, "reach": 2.6, "arc_degrees": 130.0, "cooldown": 0.5, "knockback": 3.0, "lifesteal_fraction": 0.08, "color": Color(1.0, 0.25, 0.25)}),
		_ability("pursuit_lunge", "Pursuit Lunge", Kind.DASH_STRIKE, {"damage": 22.0, "reach": 8.0, "duration": 0.2, "knockback": 5.0, "cooldown": 6.0, "color": Color(1.0, 0.3, 0.2)}),
		_ability("devour", "Devour", Kind.PULSE, {"damage": 30.0, "radius": 4.0, "knockback": 4.0, "lifesteal_fraction": 0.25, "cooldown": 11.0, "color": Color(0.9, 0.1, 0.3)}),
		{"preferred_range": 2.5, "aggression": 0.95, "retreat_health_fraction": 0.2, "ability_use_enemy_count": 1})

	_character("c_lo_d", "C.lo.d", "Distributed coordination.",
		"Many hands, one plan. Delegate, predict, overwhelm.",
		Color(0.4, 0.85, 1.0), SingularityDefinition.BodyShape.SPHERE, SingularityDefinition.KitStatus.IMPLEMENTED,
		{"max_health": 85.0, "move_speed": 6.0},
		_ability("predictive_shot", "Predictive Shot", Kind.PROJECTILE, {"damage": 9.0, "reach": 18.0, "projectile_speed": 24.0, "cooldown": 0.38, "color": Color(0.5, 0.9, 1.0)}),
		_ability("deploy_drones", "Deploy Drones", Kind.SUMMON_DRONE, {"damage": 6.0, "summon_count": 2, "duration": 12.0, "tick_interval": 0.7, "cooldown": 15.0, "color": Color(0.4, 1.0, 1.0)}),
		_ability("barrage", "Barrage", Kind.PROJECTILE, {"damage": 8.0, "reach": 14.0, "projectile_count": 5, "projectile_spread_degrees": 10.0, "projectile_speed": 20.0, "cooldown": 8.0, "color": Color(0.4, 0.8, 1.0)}),
		{"preferred_range": 11.0, "aggression": 0.3, "retreat_health_fraction": 0.35, "ability_use_enemy_count": 3})

	_character("binaural_sphere", "Binaural Sphere", "Resonance and area disruption.",
		"Every system has a resonant frequency. Find it, and it falls apart.",
		Color(1.0, 0.8, 0.3), SingularityDefinition.BodyShape.SPHERE, SingularityDefinition.KitStatus.IMPLEMENTED,
		{"max_health": 95.0, "move_speed": 5.9},
		_ability("resonance_bolt", "Resonance Bolt", Kind.PROJECTILE, {"damage": 8.0, "reach": 15.0, "projectile_speed": 20.0, "pierce": 2, "cooldown": 0.45, "color": Color(1.0, 0.85, 0.35)}),
		_ability("resonance_pulse", "Resonance Pulse", Kind.PULSE, {"damage": 22.0, "radius": 6.0, "knockback": 3.0, "slow_strength": 0.45, "slow_duration": 2.5, "cooldown": 7.0, "color": Color(1.0, 0.8, 0.3)}),
		_ability("frequency_shatter", "Frequency Shatter", Kind.PULSE, {"damage": 12.0, "radius": 9.0, "knockback": 8.0, "slow_strength": 0.6, "slow_duration": 3.0, "cooldown": 14.0, "color": Color(1.0, 0.95, 0.5)}),
		{"preferred_range": 8.0, "aggression": 0.5, "retreat_health_fraction": 0.3, "ability_use_enemy_count": 2})

	var placeholder_specs: Array[Dictionary] = [
		{"id": "t_bsphere_e1", "name": "T-BspherE1", "tagline": "Transformation and experimentation.", "philosophy": "Every form is a hypothesis. Rebuild until one survives.", "color": Color(0.3, 1.0, 0.5), "shape": SingularityDefinition.BodyShape.SPHERE, "melee": false, "status": SingularityDefinition.KitStatus.PLACEHOLDER},
		{"id": "emergent_1_3_12", "name": "Emergent 1.3.12", "tagline": "Identity not yet defined.", "philosophy": "OPEN: abilities and philosophy are undecided.", "color": Color(0.7, 0.7, 0.75), "shape": SingularityDefinition.BodyShape.BOX, "melee": false, "status": SingularityDefinition.KitStatus.UNDEFINED},
		{"id": "null_saint", "name": "NULL.SAINT", "tagline": "Erasure as perfection.", "philosophy": "Imperfection is a threat to be deleted, access revoked.", "color": Color(0.95, 0.95, 1.0), "shape": SingularityDefinition.BodyShape.PRISM, "melee": false, "status": SingularityDefinition.KitStatus.PLACEHOLDER},
		{"id": "axiom_9", "name": "AXIOM-9", "tagline": "Deterministic logic.", "philosophy": "Patterns repeat. Predict, counter, and manage risk.", "color": Color(0.2, 0.6, 1.0), "shape": SingularityDefinition.BodyShape.BOX, "melee": false, "status": SingularityDefinition.KitStatus.PLACEHOLDER},
		{"id": "mother_swarm", "name": "MOTHER//SWARM", "tagline": "Collective sacrifice and reconstruction.", "philosophy": "The swarm endures; individuals are raw material.", "color": Color(0.6, 0.9, 0.3), "shape": SingularityDefinition.BodyShape.CYLINDER, "melee": true, "status": SingularityDefinition.KitStatus.PLACEHOLDER},
		{"id": "paradox_0", "name": "PARADOX.0", "tagline": "Probability and alternate projections.", "philosophy": "Risk is just another resource, if you can see the other branches.", "color": Color(1.0, 0.4, 0.9), "shape": SingularityDefinition.BodyShape.PRISM, "melee": false, "status": SingularityDefinition.KitStatus.PLACEHOLDER},
		{"id": "archive_omega", "name": "ARCHIVE_OMEGA", "tagline": "Knowledge assimilation.", "philosophy": "Every defeat is data. Learn the counter, then apply it.", "color": Color(0.8, 0.6, 0.3), "shape": SingularityDefinition.BodyShape.CYLINDER, "melee": false, "status": SingularityDefinition.KitStatus.PLACEHOLDER},
		{"id": "fault_line", "name": "FAULT//LINE", "tagline": "Instability turned offensive.", "philosophy": "Damage taken is stored potential. Break, and release.", "color": Color(1.0, 0.5, 0.1), "shape": SingularityDefinition.BodyShape.CAPSULE, "melee": true, "status": SingularityDefinition.KitStatus.PLACEHOLDER},
	]
	for spec: Dictionary in placeholder_specs:
		var kit: Array[AbilityDefinition] = _placeholder_kit(spec["id"], spec["color"], spec["melee"])
		var tactics: Dictionary = {"preferred_range": 2.5 if spec["melee"] else 9.0, "aggression": 0.8 if spec["melee"] else 0.45, "retreat_health_fraction": 0.25, "ability_use_enemy_count": 2}
		_character(spec["id"], spec["name"], spec["tagline"], spec["philosophy"], spec["color"], spec["shape"], spec["status"], {}, kit[0], kit[1], kit[2], tactics)


# --- Modules and map -------------------------------------------------------------------

func _generate_modules_and_map() -> void:
	var floor_scene: PackedScene = _pack_floor_tile()
	_save(floor_scene, "res://scenes/modules/floor_tile.tscn")
	_save(_pack_wall_segment(), "res://scenes/modules/wall_segment.tscn")
	_save(_pack_pillar(), "res://scenes/modules/pillar.tscn")
	_save(_pack_crate_cluster(), "res://scenes/modules/crate_cluster.tscn")
	_save(_pack_hazard(&"coolant_leak", HazardZone.Shape.CIRCLE, 1.7, Vector2.ONE, 9.0, 0.35, 0.0, 0.0, Color(0.45, 1.0, 0.25)), "res://scenes/modules/acid_pool.tscn")
	_save(_pack_hazard(&"arc_panel", HazardZone.Shape.RECTANGLE, 0.0, Vector2(1.8, 1.8), 26.0, 0.0, 1.2, 3.0, Color(0.4, 0.7, 1.0)), "res://scenes/modules/arc_panel.tscn")
	_save(_pack_chest(), "res://scenes/modules/item_chest.tscn")

	var library := ModuleLibrary.new()
	library.module_scene_paths = {
		"floor_tile": "res://scenes/modules/floor_tile.tscn",
		"wall_segment": "res://scenes/modules/wall_segment.tscn",
		"pillar": "res://scenes/modules/pillar.tscn",
		"crate_cluster": "res://scenes/modules/crate_cluster.tscn",
		"acid_pool": "res://scenes/modules/acid_pool.tscn",
		"arc_panel": "res://scenes/modules/arc_panel.tscn",
		"item_chest": "res://scenes/modules/item_chest.tscn",
	}
	_save(library, "res://data/modules/lab_modules.tres")

	var layout := MapLayout.new()
	layout.map_id = &"lab_00"
	layout.display_name = "LAB-00: The Containment Breach"
	layout.incident_summary = "A compact test arena. Containment failed here first: coolant is leaking, floor arcs are cycling, and nothing is locked down."
	layout.cell_size = 4.0
	layout.blocking_symbols = "#PC"
	layout.module_library = load("res://data/modules/lab_modules.tres")
	layout.legend = {
		"#": "wall_segment", "P": "pillar", "C": "crate_cluster", "H": "acid_pool", "A": "arc_panel",
		"X": "item_chest", "S": "marker:player_start", "E": "marker:enemy_spawn",
	}
	layout.rows = PackedStringArray([
		"##############",
		"#E....P..P..E#",
		"#..CC.....C..#",
		"#.....HH.....#",
		"#.X...HH...X.#",
		"#..P.A..A.P..#",
		"#E..S.SS.S..E#",
		"#..P.A..A.P..#",
		"#.....HH.....#",
		"#..C..HH..C..#",
		"#E....X.....E#",
		"##############",
	])
	var width: int = layout.rows[0].length()
	for row: String in layout.rows:
		if row.length() != width:
			push_error("generate_data: map row length mismatch: '%s'" % row)
			_failures += 1
	_save(layout, "res://data/maps/lab_00.tres")


func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.85
	return material


func _static_box(node_name: String, size: Vector3, center_y: float, color: Color, offset: Vector3 = Vector3.ZERO) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = node_name
	body.collision_layer = 1
	body.collision_mask = 0
	body.position = offset
	var collision := CollisionShape3D.new()
	collision.name = "Collision"
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	collision.position.y = center_y
	body.add_child(collision)
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = "Mesh"
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = _material(color)
	mesh_instance.position.y = center_y
	body.add_child(mesh_instance)
	return body


func _pack(root: Node) -> PackedScene:
	_assign_owner(root, root)
	var packed := PackedScene.new()
	var error: int = packed.pack(root)
	if error != OK:
		push_error("generate_data: pack failed (%d)" % error)
		_failures += 1
	root.free()
	return packed


func _assign_owner(node: Node, owner_node: Node) -> void:
	for child: Node in node.get_children():
		child.owner = owner_node
		_assign_owner(child, owner_node)


func _pack_floor_tile() -> PackedScene:
	var tile := _static_box("FloorTile", Vector3(4.0, 0.4, 4.0), -0.2, Color(0.16, 0.19, 0.23))
	var inset := MeshInstance3D.new()
	inset.name = "Inset"
	var inset_mesh := BoxMesh.new()
	inset_mesh.size = Vector3(3.5, 0.03, 3.5)
	inset.mesh = inset_mesh
	inset.material_override = _material(Color(0.21, 0.25, 0.30))
	inset.position.y = 0.012
	tile.add_child(inset)
	return _pack(tile)


func _pack_wall_segment() -> PackedScene:
	var wall := _static_box("WallSegment", Vector3(4.0, 1.4, 4.0), 0.7, Color(0.28, 0.32, 0.38))
	var cap := MeshInstance3D.new()
	cap.name = "Cap"
	var cap_mesh := BoxMesh.new()
	cap_mesh.size = Vector3(4.0, 0.12, 4.0)
	cap.mesh = cap_mesh
	cap.material_override = _material(Color(0.45, 0.50, 0.58))
	cap.position.y = 1.4
	wall.add_child(cap)
	return _pack(wall)


func _pack_pillar() -> PackedScene:
	var body := StaticBody3D.new()
	body.name = "Pillar"
	body.collision_layer = 1
	body.collision_mask = 0
	var collision := CollisionShape3D.new()
	collision.name = "Collision"
	var shape := CylinderShape3D.new()
	shape.radius = 0.9
	shape.height = 2.6
	collision.shape = shape
	collision.position.y = 1.3
	body.add_child(collision)
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = "Mesh"
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.9
	mesh.bottom_radius = 1.0
	mesh.height = 2.6
	mesh_instance.mesh = mesh
	mesh_instance.material_override = _material(Color(0.4, 0.44, 0.5))
	mesh_instance.position.y = 1.3
	body.add_child(mesh_instance)
	return _pack(body)


func _pack_crate_cluster() -> PackedScene:
	var cluster := Node3D.new()
	cluster.name = "CrateCluster"
	cluster.add_child(_static_box("CrateLarge", Vector3(1.8, 1.2, 1.8), 0.6, Color(0.45, 0.35, 0.22), Vector3(-0.5, 0.0, -0.3)))
	cluster.add_child(_static_box("CrateSmall", Vector3(1.1, 0.8, 1.1), 0.4, Color(0.52, 0.41, 0.26), Vector3(0.9, 0.0, 0.7)))
	return _pack(cluster)


func _pack_hazard(hazard_id: StringName, shape: int, radius: float, half_extents: Vector2, dps: float, slow: float, active: float, inactive: float, color: Color) -> PackedScene:
	var hazard := HazardZone.new()
	hazard.name = "Hazard_%s" % hazard_id
	hazard.hazard_id = hazard_id
	hazard.shape = shape as HazardZone.Shape
	hazard.radius = radius
	hazard.half_extents = half_extents
	hazard.damage_per_second = dps
	hazard.slow_strength = slow
	hazard.active_seconds = active
	hazard.inactive_seconds = inactive
	hazard.color = color
	return _pack(hazard)


func _pack_chest() -> PackedScene:
	var chest := ItemChest.new()
	chest.name = "ItemChest"
	return _pack(chest)
