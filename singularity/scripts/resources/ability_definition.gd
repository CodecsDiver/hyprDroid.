class_name AbilityDefinition
extends Resource
## Data describing one ability. `kind` selects the behaviour in AbilityExecutor;
## the remaining fields parameterise it. Unused fields for a kind are ignored.

enum Kind { PROJECTILE, MELEE_ARC, DASH_STRIKE, PULSE, SUMMON_DRONE, VORTEX, GUARD }

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var kind: Kind = Kind.PROJECTILE
@export var cooldown: float = 1.0
## Base damage before the owner's damage multiplier. Zero means "no direct damage".
@export var damage: float = 10.0
## Targeting reach for the ability (melee reach, dash distance, cast range, projectile range).
@export var reach: float = 6.0
## Area radius (pulse, vortex, projectile splash). Scaled by the owner's area_size stat.
@export var radius: float = 0.0
@export_range(0.0, 360.0) var arc_degrees: float = 90.0
@export var projectile_speed: float = 18.0
@export var projectile_count: int = 1
@export var projectile_spread_degrees: float = 12.0
@export var pierce: int = 0
## Seconds: dash time, summon / vortex / guard duration.
@export var duration: float = 0.0
@export var tick_interval: float = 0.5
@export var summon_count: int = 1
@export var knockback: float = 0.0
@export var lifesteal_fraction: float = 0.0
@export_range(0.0, 1.0) var slow_strength: float = 0.0
@export var slow_duration: float = 0.0
## Vortex: pull speed towards the centre, metres per second.
@export var pull_strength: float = 0.0
@export var color: Color = Color(0.4, 0.9, 1.0)


func is_instant_self_cast() -> bool:
	return kind == Kind.GUARD or kind == Kind.PULSE
