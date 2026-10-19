class_name ActorInventory
extends RefCounted
## Upgrades (from levelling) and items (from exploration) owned by one actor.
## Kept separate on purpose: they come from different sources and use different pools.

signal changed

var upgrade_stacks: Dictionary = {}
var item_stacks: Dictionary = {}
var equipment_item: ItemDefinition
var equipment_ability: AbilityInstance

var _upgrade_definitions: Dictionary = {}
var _item_definitions: Dictionary = {}


func get_upgrade_stacks(upgrade_id: StringName) -> int:
	return int(upgrade_stacks.get(String(upgrade_id), 0))


func get_item_stacks(item_id: StringName) -> int:
	return int(item_stacks.get(String(item_id), 0))


func can_take_upgrade(definition: UpgradeDefinition) -> bool:
	return definition.max_stacks <= 0 or get_upgrade_stacks(definition.id) < definition.max_stacks


## Returns the new stack count, or 0 if the upgrade is already at its limit.
func add_upgrade(definition: UpgradeDefinition) -> int:
	if not can_take_upgrade(definition):
		return 0
	var key: String = String(definition.id)
	upgrade_stacks[key] = get_upgrade_stacks(definition.id) + 1
	_upgrade_definitions[key] = definition
	changed.emit()
	return int(upgrade_stacks[key])


## Adds an item (or swaps equipment). Returns the new stack count.
func add_item(definition: ItemDefinition) -> int:
	var key: String = String(definition.id)
	if definition.is_equipment():
		equipment_item = definition
		equipment_ability = AbilityInstance.new(definition.equipment_ability)
		item_stacks[key] = 1
		_item_definitions[key] = definition
		changed.emit()
		return 1
	if definition.max_stacks > 0 and get_item_stacks(definition.id) >= definition.max_stacks:
		return 0
	item_stacks[key] = get_item_stacks(definition.id) + 1
	_item_definitions[key] = definition
	changed.emit()
	return int(item_stacks[key])


## Pushes every owned upgrade and item into the stat sheet as modifier sources.
func apply_to_stats(stats: StatSheet) -> void:
	for key: String in upgrade_stacks.keys():
		var upgrade: UpgradeDefinition = _upgrade_definitions[key]
		stats.set_source(StringName("upgrade:%s" % key), upgrade.modifiers, int(upgrade_stacks[key]))
	for key: String in item_stacks.keys():
		var item: ItemDefinition = _item_definitions[key]
		if item.is_equipment():
			continue
		stats.set_source(StringName("item:%s" % key), item.modifiers, int(item_stacks[key]))


## Items with a given proc kind as [{definition, stacks}].
func items_with_proc(kind: ItemDefinition.ProcKind) -> Array[Dictionary]:
	var matches: Array[Dictionary] = []
	for key: String in item_stacks.keys():
		var item: ItemDefinition = _item_definitions[key]
		if item.proc_kind == kind:
			matches.append({"definition": item, "stacks": int(item_stacks[key])})
	return matches


func owned_upgrades() -> Array[Dictionary]:
	var owned: Array[Dictionary] = []
	for key: String in upgrade_stacks.keys():
		owned.append({"definition": _upgrade_definitions[key], "stacks": int(upgrade_stacks[key])})
	return owned


func owned_items() -> Array[Dictionary]:
	var owned: Array[Dictionary] = []
	for key: String in item_stacks.keys():
		owned.append({"definition": _item_definitions[key], "stacks": int(item_stacks[key])})
	return owned
