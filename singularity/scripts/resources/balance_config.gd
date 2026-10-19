class_name BalanceConfig
extends Resource
## Central balance sheet. Every tunable gameplay number should live here or in a
## definition resource, never in gameplay code. See BALANCING.md.

enum XpShareMode { COLLECTOR_ONLY, SHARED_TEAM_EQUAL }

@export_group("Run")
## Survive this long to win. Seconds.
@export var victory_survive_seconds: float = 1800.0
@export var upgrade_choice_count: int = 3
@export var xp_share_mode: XpShareMode = XpShareMode.COLLECTOR_ONLY
## Engine time scale while the tactical overview is active (OPEN design question).
@export var tactical_time_scale: float = 1.0
@export var defeat_delay_seconds: float = 1.5

@export_group("Experience")
@export var xp_curve: XpCurve
@export var xp_gem_magnet_speed: float = 14.0
@export var max_gems_alive: int = 250
@export var gem_lifetime_seconds: float = 0.0 # 0 = never expire

@export_group("Rarity weights")
## Keyed by Rarity.TIER_KEYS.
@export var upgrade_rarity_weights: Dictionary = {}
## Multiplicative weight growth per player level, keyed by tier key.
@export var upgrade_rarity_level_growth: Dictionary = {}
@export var chest_rarity_weights: Dictionary = {}
@export var chest_equipment_chance: float = 0.12

@export_group("Enemy scaling")
@export var enemy_health_growth_per_minute: float = 0.12
@export var enemy_damage_growth_per_minute: float = 0.06
@export var enemy_speed_growth_per_minute: float = 0.01
@export var enemy_speed_growth_cap: float = 0.5

@export_group("Spawn director")
@export var spawn_rate_start: float = 0.9
@export var spawn_rate_growth_per_minute: float = 0.15
@export var spawn_rate_max: float = 6.0
@export var max_alive_enemies: int = 110
@export var spawn_distance_min: float = 16.0
@export var spawn_distance_max: float = 34.0
@export var wave_interval_seconds: float = 45.0
@export var wave_size_base: int = 8
@export var wave_size_growth_per_minute: float = 1.5
@export var elite_first_spawn_seconds: float = 240.0
@export var elite_interval_seconds: float = 150.0

@export_group("Combat")
@export var armor_constant: float = 100.0
@export var knockback_decay: float = 22.0
@export var hazards_hurt_all_teams: bool = true
@export var interact_range: float = 3.2

@export_group("Agents")
@export var human_profile_id: StringName = &"human"
@export var enemy_profile_id: StringName = &"enemy_brain"
@export var default_external_profile_id: StringName = &"external_default"


func upgrade_weight_for(tier: Rarity.Tier, player_level: int) -> float:
	var tier_key: String = Rarity.key(tier)
	var base_weight: float = float(upgrade_rarity_weights.get(tier_key, 1.0))
	var growth: float = float(upgrade_rarity_level_growth.get(tier_key, 0.0))
	return base_weight * (1.0 + growth * float(maxi(player_level - 1, 0)))


func chest_weight_for(tier: Rarity.Tier) -> float:
	return float(chest_rarity_weights.get(Rarity.key(tier), 1.0))
