class_name StatIds
extends RefCounted
## Canonical stat identifiers, default base values, clamping limits and display names.

const MAX_HEALTH := &"max_health"
const HEALTH_REGEN := &"health_regen"
const MOVE_SPEED := &"move_speed"
const ARMOR := &"armor"
const DAMAGE_MULTIPLIER := &"damage_multiplier"
const ATTACK_SPEED := &"attack_speed"
const COOLDOWN_REDUCTION := &"cooldown_reduction"
const CRIT_CHANCE := &"crit_chance"
const CRIT_DAMAGE := &"crit_damage"
const PICKUP_RADIUS := &"pickup_radius"
const XP_GAIN := &"xp_gain"
const LIFE_STEAL := &"life_steal"
const AREA_SIZE := &"area_size"
const EXTRA_PROJECTILES := &"extra_projectiles"
const SUMMON_BONUS := &"summon_bonus"

## Keys are plain Strings so the table can be a constant Dictionary.
const DEFAULTS: Dictionary = {
	"max_health": 100.0,
	"health_regen": 0.5,
	"move_speed": 6.0,
	"armor": 0.0,
	"damage_multiplier": 1.0,
	"attack_speed": 1.0,
	"cooldown_reduction": 0.0,
	"crit_chance": 0.05,
	"crit_damage": 1.5,
	"pickup_radius": 3.0,
	"xp_gain": 1.0,
	"life_steal": 0.0,
	"area_size": 1.0,
	"extra_projectiles": 0.0,
	"summon_bonus": 0.0,
}

## (minimum, maximum) per stat.
const LIMITS: Dictionary = {
	"max_health": Vector2(1.0, 100000.0),
	"health_regen": Vector2(0.0, 500.0),
	"move_speed": Vector2(0.5, 16.0),
	"armor": Vector2(-50.0, 500.0),
	"damage_multiplier": Vector2(0.05, 100.0),
	"attack_speed": Vector2(0.2, 6.0),
	"cooldown_reduction": Vector2(0.0, 0.6),
	"crit_chance": Vector2(0.0, 1.0),
	"crit_damage": Vector2(1.0, 10.0),
	"pickup_radius": Vector2(0.5, 30.0),
	"xp_gain": Vector2(0.1, 20.0),
	"life_steal": Vector2(0.0, 0.5),
	"area_size": Vector2(0.25, 4.0),
	"extra_projectiles": Vector2(0.0, 12.0),
	"summon_bonus": Vector2(0.0, 6.0),
}

const DISPLAY_NAMES: Dictionary = {
	"max_health": "Max Health",
	"health_regen": "Health Regen / s",
	"move_speed": "Move Speed",
	"armor": "Armor",
	"damage_multiplier": "Damage",
	"attack_speed": "Attack Speed",
	"cooldown_reduction": "Cooldown Reduction",
	"crit_chance": "Crit Chance",
	"crit_damage": "Crit Damage",
	"pickup_radius": "Pickup Radius",
	"xp_gain": "XP Gain",
	"life_steal": "Life Steal",
	"area_size": "Area Size",
	"extra_projectiles": "Extra Projectiles",
	"summon_bonus": "Extra Summons",
}

## Stats displayed as percentages when written out for the player.
const PERCENT_STATS: Array[String] = [
	"cooldown_reduction", "crit_chance", "life_steal",
]


static func all_ids() -> Array[String]:
	var ids: Array[String] = []
	for key: String in DEFAULTS.keys():
		ids.append(key)
	return ids


static func default_value(stat: StringName) -> float:
	return float(DEFAULTS.get(String(stat), 0.0))


static func clamp_value(stat: StringName, value: float) -> float:
	var limits: Vector2 = LIMITS.get(String(stat), Vector2(-1.0e9, 1.0e9))
	return clampf(value, limits.x, limits.y)


static func display_name(stat: StringName) -> String:
	return String(DISPLAY_NAMES.get(String(stat), String(stat)))


static func is_percent_stat(stat: StringName) -> bool:
	return PERCENT_STATS.has(String(stat))
