class_name UpgradeRoller
extends RefCounted
## Chooses level-up options and item drops with weighted, duplicate-free rolls.

static func is_eligible(definition: UpgradeDefinition, character_id: StringName, inventory: ActorInventory) -> bool:
	if definition.is_fallback or not definition.is_available_to(character_id):
		return false
	if not inventory.can_take_upgrade(definition):
		return false
	for required_id: Variant in definition.requires.keys():
		if inventory.get_upgrade_stacks(StringName(required_id)) < int(definition.requires[required_id]):
			return false
	for excluded_id: String in definition.excludes:
		if inventory.get_upgrade_stacks(StringName(excluded_id)) > 0:
			return false
	return true


## Rolls `count` distinct upgrades. Fallback upgrades fill any shortfall so the
## player is never offered fewer options than the pool can supply.
static func roll_upgrades(character_id: StringName, inventory: ActorInventory, level: int, rng: RandomNumberGenerator, count: int) -> Array[UpgradeDefinition]:
	var candidates: Array[UpgradeDefinition] = []
	var fallbacks: Array[UpgradeDefinition] = []
	for definition: UpgradeDefinition in Catalog.upgrades_for_character(character_id):
		if definition.is_fallback:
			if inventory.can_take_upgrade(definition):
				fallbacks.append(definition)
		elif is_eligible(definition, character_id, inventory):
			candidates.append(definition)

	var chosen: Array[UpgradeDefinition] = []
	while chosen.size() < count and not candidates.is_empty():
		var weights: PackedFloat32Array = PackedFloat32Array()
		for definition: UpgradeDefinition in candidates:
			weights.append(maxf(Balance.config.upgrade_weight_for(definition.rarity, level) * definition.weight, 0.0))
		var picked_index: int = _weighted_index(weights, rng)
		var picked: UpgradeDefinition = candidates[picked_index]
		candidates.remove_at(picked_index)
		# Mutually exclusive options (e.g. Glass Core vs Hardened Core) are never offered together.
		if not _conflicts_with_any(picked, chosen):
			chosen.append(picked)
	var fallback_index: int = 0
	while chosen.size() < count and fallback_index < fallbacks.size():
		chosen.append(fallbacks[fallback_index])
		fallback_index += 1
	return chosen


static func roll_chest_item(rng: RandomNumberGenerator) -> ItemDefinition:
	var config: BalanceConfig = Balance.config
	var want_equipment: bool = rng.randf() < config.chest_equipment_chance
	var pool: Array[ItemDefinition] = []
	for item: ItemDefinition in _all_items():
		if item.is_equipment() == want_equipment:
			pool.append(item)
	if pool.is_empty():
		for item: ItemDefinition in _all_items():
			pool.append(item)
	if pool.is_empty():
		return null
	var weights: PackedFloat32Array = PackedFloat32Array()
	for item: ItemDefinition in pool:
		weights.append(maxf(config.chest_weight_for(item.rarity) * item.weight, 0.0))
	return pool[_weighted_index(weights, rng)]


static func _all_items() -> Array[ItemDefinition]:
	var items: Array[ItemDefinition] = []
	for item_id: String in Catalog.items.keys():
		items.append(Catalog.items[item_id])
	return items


static func _conflicts_with_any(option: UpgradeDefinition, others: Array[UpgradeDefinition]) -> bool:
	for other: UpgradeDefinition in others:
		if option.excludes.has(String(other.id)) or other.excludes.has(String(option.id)):
			return true
	return false


static func _weighted_index(weights: PackedFloat32Array, rng: RandomNumberGenerator) -> int:
	var total: float = 0.0
	for weight: float in weights:
		total += weight
	if total <= 0.0:
		return rng.randi_range(0, weights.size() - 1)
	var roll: float = rng.randf() * total
	var running: float = 0.0
	for index: int in weights.size():
		running += weights[index]
		if roll < running:
			return index
	return weights.size() - 1
