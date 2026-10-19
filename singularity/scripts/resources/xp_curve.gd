class_name XpCurve
extends Resource
## XP required to advance from level L to L+1.
##
## xp_required(L) = base_xp + linear_growth * (L-1) + curve_growth * (L-1) ^ curve_exponent
## A non-empty `table_override` takes priority for the levels it covers (index 0 = level 1).

@export var base_xp: float = 5.0
@export var linear_growth: float = 0.0
@export var curve_growth: float = 0.0
@export var curve_exponent: float = 1.0
@export var max_level: int = 99
@export var table_override: PackedFloat32Array = PackedFloat32Array()


func xp_required(current_level: int) -> float:
	var index: int = current_level - 1
	if index >= 0 and index < table_override.size():
		return maxf(table_override[index], 1.0)
	var steps: float = float(maxi(current_level - 1, 0))
	return maxf(base_xp + linear_growth * steps + curve_growth * pow(steps, curve_exponent), 1.0)


func total_xp_to_reach(target_level: int) -> float:
	var total: float = 0.0
	for level: int in range(1, target_level):
		total += xp_required(level)
	return total
