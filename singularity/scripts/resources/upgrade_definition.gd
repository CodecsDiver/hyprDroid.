class_name UpgradeDefinition
extends Resource
## A level-up upgrade. Distinct from ItemDefinition (items come from exploration).

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var rarity: Rarity.Tier = Rarity.Tier.COMMON
@export var weight: float = 1.0
@export var max_stacks: int = 5
@export var modifiers: Array[StatModifier] = []
## Prerequisites: upgrade id (String) -> minimum stacks required.
@export var requires: Dictionary = {}
## Upgrades that cannot be taken once any of these is owned.
@export var excludes: PackedStringArray = PackedStringArray()
## Empty means "available to every singularity".
@export var character_ids: PackedStringArray = PackedStringArray()
## Fallbacks are offered only when the normal pool cannot fill the choice list.
@export var is_fallback: bool = false
## Instant heal on pickup as a fraction of max health (used by fallbacks).
@export var instant_heal_fraction: float = 0.0


func is_available_to(character_id: StringName) -> bool:
	return character_ids.is_empty() or character_ids.has(String(character_id))


func describe_effects() -> String:
	var lines: PackedStringArray = PackedStringArray()
	for modifier: StatModifier in modifiers:
		lines.append(modifier.describe())
	if instant_heal_fraction > 0.0:
		lines.append("Restore %d%% health" % roundi(instant_heal_fraction * 100.0))
	return "\n".join(lines)
