class_name AbilityInstance
extends RefCounted
## Runtime state (cooldown) of one ability on one actor.

var definition: AbilityDefinition
var cooldown_remaining: float = 0.0
var is_primary: bool = false


func _init(ability_definition: AbilityDefinition, primary: bool = false) -> void:
	definition = ability_definition
	is_primary = primary


func is_ready() -> bool:
	return cooldown_remaining <= 0.0


func tick(delta: float) -> void:
	if cooldown_remaining > 0.0:
		cooldown_remaining = maxf(cooldown_remaining - delta, 0.0)


## Primary attacks scale with attack_speed; other abilities with cooldown_reduction.
func start_cooldown(stats: StatSheet) -> void:
	var base_cooldown: float = definition.cooldown
	if is_primary:
		cooldown_remaining = base_cooldown / maxf(stats.get_value(StatIds.ATTACK_SPEED), 0.2)
	else:
		cooldown_remaining = base_cooldown * (1.0 - stats.get_value(StatIds.COOLDOWN_REDUCTION))


func cooldown_fraction(stats: StatSheet) -> float:
	var full: float = definition.cooldown
	if is_primary:
		full /= maxf(stats.get_value(StatIds.ATTACK_SPEED), 0.2)
	else:
		full *= (1.0 - stats.get_value(StatIds.COOLDOWN_REDUCTION))
	return clampf(cooldown_remaining / maxf(full, 0.001), 0.0, 1.0)
