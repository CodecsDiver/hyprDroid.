class_name ProgressionTracker
extends RefCounted
## Level and XP bookkeeping for one actor. Leveling can happen several times in one
## XP grant; each level queues one upgrade choice (`pending_level_ups`). Surplus XP
## carries over into the next level.

signal level_gained(new_level: int)

var curve: XpCurve
var level: int = 1
var xp_in_level: float = 0.0
var total_xp: float = 0.0
var pending_level_ups: int = 0
## The currently offered choices for the oldest pending level-up (empty if not rolled yet).
var pending_choices: Array[UpgradeDefinition] = []


func _init(xp_curve: XpCurve) -> void:
	curve = xp_curve


func xp_to_next_level() -> float:
	return curve.xp_required(level)


func is_max_level() -> bool:
	return level >= curve.max_level


## Adds XP and returns how many levels were gained.
func add_xp(amount: float) -> int:
	if amount <= 0.0:
		return 0
	total_xp += amount
	if is_max_level():
		return 0
	xp_in_level += amount
	var gained: int = 0
	while not is_max_level() and xp_in_level >= xp_to_next_level():
		xp_in_level -= xp_to_next_level()
		level += 1
		pending_level_ups += 1
		gained += 1
		level_gained.emit(level)
	if is_max_level():
		xp_in_level = 0.0
	return gained


func needs_choice_roll() -> bool:
	return pending_level_ups > 0 and pending_choices.is_empty()


func has_pending_choice() -> bool:
	return not pending_choices.is_empty()


## Resolves the current choice. Returns the picked upgrade or null on a bad index.
func take_choice(index: int) -> UpgradeDefinition:
	if index < 0 or index >= pending_choices.size():
		return null
	var picked: UpgradeDefinition = pending_choices[index]
	pending_choices = []
	pending_level_ups = maxi(pending_level_ups - 1, 0)
	return picked
