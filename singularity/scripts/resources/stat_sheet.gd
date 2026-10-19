class_name StatSheet
extends RefCounted
## Computed stats for one combatant: base values plus modifier sources.
##
## A "source" is anything that grants modifiers at some stack count (an upgrade,
## an item, a temporary effect). Sources are replaced wholesale, so callers never
## need to subtract an old contribution.

signal changed

var _base_values: Dictionary = {}
## source id (String) -> { "modifiers": Array[StatModifier], "stacks": int }
var _sources: Dictionary = {}
var _cache: Dictionary = {}


func set_base_values(overrides: Dictionary) -> void:
	_base_values.clear()
	for key: Variant in overrides.keys():
		_base_values[String(key)] = float(overrides[key])
	_invalidate()


func set_base(stat: StringName, value: float) -> void:
	_base_values[String(stat)] = value
	_invalidate()


func get_base(stat: StringName) -> float:
	var key: String = String(stat)
	if _base_values.has(key):
		return float(_base_values[key])
	return StatIds.default_value(stat)


func set_source(source_id: StringName, modifiers: Array[StatModifier], stacks: int) -> void:
	if stacks <= 0:
		remove_source(source_id)
		return
	_sources[String(source_id)] = {"modifiers": modifiers, "stacks": stacks}
	_invalidate()


func remove_source(source_id: StringName) -> void:
	if _sources.erase(String(source_id)):
		_invalidate()


func get_value(stat: StringName) -> float:
	var key: String = String(stat)
	if _cache.has(key):
		return float(_cache[key])
	var computed: float = _compute(stat)
	_cache[key] = computed
	return computed


func snapshot() -> Dictionary:
	var values: Dictionary = {}
	for stat_name: String in StatIds.all_ids():
		values[stat_name] = snappedf(get_value(StringName(stat_name)), 0.001)
	return values


func _compute(stat: StringName) -> float:
	var additive: float = 0.0
	var percent_pool: float = 0.0
	var multiplier: float = 1.0
	for source: Dictionary in _sources.values():
		var stacks: int = source["stacks"]
		var modifiers: Array[StatModifier] = source["modifiers"]
		for modifier: StatModifier in modifiers:
			if modifier.stat != stat:
				continue
			var contribution: float = modifier.effective_value(stacks)
			match modifier.operation:
				StatModifier.Operation.ADD:
					additive += contribution
				StatModifier.Operation.ADD_PERCENT:
					percent_pool += contribution
				StatModifier.Operation.MULTIPLY:
					multiplier *= contribution
	var total: float = (get_base(stat) + additive) * maxf(1.0 + percent_pool, 0.05) * multiplier
	return StatIds.clamp_value(stat, total)


func _invalidate() -> void:
	_cache.clear()
	changed.emit()
