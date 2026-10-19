class_name EnemyDefinition
extends Resource
## Data describing one enemy type and when the spawn director may use it.

@export var id: StringName = &""
@export var display_name: String = ""
@export var base_health: float = 20.0
@export var move_speed: float = 3.0
@export var body_radius: float = 0.45
@export var visual_scale: float = 1.0
@export var color: Color = Color(0.9, 0.3, 0.2)
@export var xp_value: float = 1.0
## Preferred distance to hold from the target; 0 means close to melee range.
@export var preferred_distance: float = 0.0
@export var is_elite: bool = false
@export var elite_chest_drop_chance: float = 0.0
## The single attack this enemy performs. Damage is scaled by enemy damage scaling.
@export var primary_ability: AbilityDefinition
@export_group("Spawning")
@export var spawn_weight: float = 1.0
@export var spawn_start_seconds: float = 0.0
## Negative means the enemy never stops spawning.
@export var spawn_end_seconds: float = -1.0
## Additional weight per elapsed minute (can be negative).
@export var spawn_weight_growth_per_minute: float = 0.0


func weight_at(elapsed_seconds: float) -> float:
	if is_elite:
		return 0.0 # Elites are scheduled separately by the director.
	if elapsed_seconds < spawn_start_seconds:
		return 0.0
	if spawn_end_seconds >= 0.0 and elapsed_seconds > spawn_end_seconds:
		return 0.0
	var minutes_since_start: float = (elapsed_seconds - spawn_start_seconds) / 60.0
	return maxf(spawn_weight + spawn_weight_growth_per_minute * minutes_since_start, 0.0)
