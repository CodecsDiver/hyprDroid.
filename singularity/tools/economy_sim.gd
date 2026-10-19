extends Node
## Projects player level against elapsed time from the spawn director and XP curve in
## the current data files. This is a model, not a measurement: it assumes the player
## kills a fixed fraction of what spawns and collects all of the XP.
##
##   godot --headless --path . res://tools/economy_sim.tscn -- kill_fraction=0.9 xp_gain=1.0

const TARGETS: Array[Dictionary] = [
	{"minutes": 1, "low": 2, "high": 3},
	{"minutes": 3, "low": 4, "high": 6},
	{"minutes": 5, "low": 7, "high": 9},
	{"minutes": 10, "low": 12, "high": 16},
	{"minutes": 15, "low": 17, "high": 21},
	{"minutes": 20, "low": 22, "high": 26},
	{"minutes": 30, "low": 30, "high": 35},
]


func _ready() -> void:
	var kill_fraction: float = 0.9
	var xp_gain: float = 1.0
	for argument: String in OS.get_cmdline_user_args():
		var parts: PackedStringArray = argument.split("=")
		if parts.size() == 2 and parts[0] == "kill_fraction":
			kill_fraction = parts[1].to_float()
		elif parts.size() == 2 and parts[0] == "xp_gain":
			xp_gain = parts[1].to_float()
	var exit_code: int = _run(kill_fraction, xp_gain)
	get_tree().quit(exit_code)


func _run(kill_fraction: float, xp_gain: float) -> int:
	var config: BalanceConfig = Balance.config
	var regular: Array[EnemyDefinition] = []
	var elites: Array[EnemyDefinition] = []
	for enemy_id: String in Catalog.enemies.keys():
		var definition: EnemyDefinition = Catalog.enemies[enemy_id]
		if definition.is_elite:
			elites.append(definition)
		else:
			regular.append(definition)

	var level: int = 1
	var xp_in_level: float = 0.0
	var total_xp: float = 0.0
	var spawn_budget: float = 0.0
	var next_wave: float = config.wave_interval_seconds
	var next_elite: float = config.elite_first_spawn_seconds
	var level_at_minute: Dictionary = {}
	var seconds: int = 0
	while seconds <= 1800:
		var now: float = float(seconds)
		var enemies_spawned: float = SpawnDirector.spawn_rate_at(now, config)
		var gained: float = enemies_spawned * SpawnDirector.average_xp_per_enemy_at(now, regular)
		if now >= next_wave:
			next_wave += config.wave_interval_seconds
			var wave_size: float = float(config.wave_size_base) + config.wave_size_growth_per_minute * (now / 60.0)
			gained += wave_size * SpawnDirector.average_xp_per_enemy_at(now, regular)
		if now >= next_elite and not elites.is_empty():
			next_elite += config.elite_interval_seconds
			gained += elites[0].xp_value
		gained *= kill_fraction * xp_gain
		total_xp += gained
		xp_in_level += gained
		while xp_in_level >= config.xp_curve.xp_required(level) and level < config.xp_curve.max_level:
			xp_in_level -= config.xp_curve.xp_required(level)
			level += 1
		if seconds % 60 == 0:
			level_at_minute[seconds / 60] = level
		seconds += 1

	print("Economy projection (kill_fraction=%.2f, xp_gain=%.2f)" % [kill_fraction, xp_gain])
	print("minute | projected level | target range | status")
	var failures: int = 0
	for target: Dictionary in TARGETS:
		var projected: int = level_at_minute[target["minutes"]]
		var within: bool = projected >= int(target["low"]) and projected <= int(target["high"])
		if not within:
			failures += 1
		print("%6d | %15d | %5d - %-5d | %s" % [target["minutes"], projected, target["low"], target["high"], "ok" if within else "OUT OF RANGE"])
	print("total XP at 30:00: %.0f" % total_xp)
	return failures
