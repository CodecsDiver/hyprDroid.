class_name ItemDefinition
extends Resource
## An item found during exploration (chests, elite drops). Items stack, may carry
## proc effects, and one "equipment" item can be held as an active ability.

enum ProcKind { NONE, ON_KILL_HEAL, ON_HIT_EXPLOSION, ON_HIT_SLOW }

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var rarity: Rarity.Tier = Rarity.Tier.COMMON
## 0 = unlimited stacks.
@export var max_stacks: int = 0
@export var modifiers: Array[StatModifier] = []
@export var proc_kind: ProcKind = ProcKind.NONE
## Proc chance at one stack (0..1). Further stacks approach `proc_chance_cap`.
@export_range(0.0, 1.0) var proc_chance: float = 1.0
@export_range(0.0, 1.0) var proc_chance_cap: float = 1.0
## Effect magnitude at one stack (heal amount, damage fraction, slow strength).
@export var proc_value: float = 0.0
@export var proc_value_per_extra_stack: float = 0.0
@export var proc_radius: float = 3.0
@export var proc_duration: float = 2.0
## When set, this item is "equipment": it replaces the held active item.
@export var equipment_ability: AbilityDefinition
@export var weight: float = 1.0


func is_equipment() -> bool:
	return equipment_ability != null


func chance_for_stacks(stacks: int) -> float:
	if stacks <= 0:
		return 0.0
	if proc_chance >= proc_chance_cap:
		return proc_chance
	return StatModifier.hyperbolic_total(proc_chance, proc_chance_cap, stacks)


func value_for_stacks(stacks: int) -> float:
	if stacks <= 0:
		return 0.0
	return proc_value + proc_value_per_extra_stack * float(stacks - 1)


func describe_effects(stacks: int = 1) -> String:
	var lines: PackedStringArray = PackedStringArray()
	for modifier: StatModifier in modifiers:
		lines.append(modifier.describe())
	match proc_kind:
		ProcKind.ON_KILL_HEAL:
			lines.append("On kill: heal %.1f" % value_for_stacks(stacks))
		ProcKind.ON_HIT_EXPLOSION:
			lines.append("%d%% on hit: explode for %d%% damage" % [roundi(chance_for_stacks(stacks) * 100.0), roundi(value_for_stacks(stacks) * 100.0)])
		ProcKind.ON_HIT_SLOW:
			lines.append("%d%% on hit: slow %d%%" % [roundi(chance_for_stacks(stacks) * 100.0), roundi(value_for_stacks(stacks) * 100.0)])
	if equipment_ability != null:
		lines.append("Active (%.0fs cooldown): %s" % [equipment_ability.cooldown, equipment_ability.display_name])
	return "\n".join(lines)
