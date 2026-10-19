extends Node
## Lightweight per-run telemetry. Aggregates combat, progression and agent-command
## statistics from Events and writes a JSON report when the run ends.

const OUTPUT_DIRECTORY := "user://telemetry"
const MAX_LOGGED_EVENTS := 4000

var is_recording: bool = false
var write_reports_to_disk: bool = true
var output_directory: String = OUTPUT_DIRECTORY

var _run_info: Dictionary = {}
var _actor_stats: Dictionary = {}
var _event_log: Array[Dictionary] = []
var _samples: Array[Dictionary] = []
var _command_outcomes: Dictionary = {}
var _upgrade_picks: Dictionary = {}
var _item_pickups: Dictionary = {}
var _enemy_kills_by_type: Dictionary = {}
var _run_clock_seconds: float = 0.0
var _last_report: Dictionary = {}


func _ready() -> void:
	Events.damage_dealt.connect(_on_damage_dealt)
	Events.actor_healed.connect(_on_actor_healed)
	Events.actor_died.connect(_on_actor_died)
	Events.xp_gained.connect(_on_xp_gained)
	Events.level_gained.connect(_on_level_gained)
	Events.upgrade_selected.connect(_on_upgrade_selected)
	Events.item_acquired.connect(_on_item_acquired)
	Events.ability_used.connect(_on_ability_used)
	Events.command_processed.connect(_on_command_processed)


func begin_run(run_info: Dictionary) -> void:
	_run_info = run_info.duplicate(true)
	_actor_stats.clear()
	_event_log.clear()
	_samples.clear()
	_command_outcomes.clear()
	_upgrade_picks.clear()
	_item_pickups.clear()
	_enemy_kills_by_type.clear()
	_run_clock_seconds = 0.0
	is_recording = true
	log_event(&"run_started", run_info)


func set_clock(run_seconds: float) -> void:
	_run_clock_seconds = run_seconds


func log_event(event_type: StringName, data: Dictionary = {}) -> void:
	if not is_recording or _event_log.size() >= MAX_LOGGED_EVENTS:
		return
	_event_log.append({"t": snappedf(_run_clock_seconds, 0.01), "type": String(event_type), "data": data})


func add_sample(sample: Dictionary) -> void:
	if is_recording:
		var stamped: Dictionary = sample.duplicate()
		stamped["t"] = snappedf(_run_clock_seconds, 0.1)
		_samples.append(stamped)


func register_actor(actor_id: int, display_name: String, team_id: int) -> void:
	_stats_for(actor_id)["name"] = display_name
	_stats_for(actor_id)["team"] = team_id


## Finish recording and return the report. Returns the path written ("" when none).
func end_run(outcome: StringName, summary: Dictionary) -> String:
	if not is_recording:
		return ""
	log_event(&"run_ended", {"outcome": String(outcome)})
	is_recording = false
	_last_report = build_report(outcome, summary)
	if not write_reports_to_disk:
		return ""
	DirAccess.make_dir_recursive_absolute(output_directory)
	var timestamp: String = Time.get_datetime_string_from_system().replace(":", "-")
	var report_path: String = "%s/run_%s.json" % [output_directory, timestamp]
	var file := FileAccess.open(report_path, FileAccess.WRITE)
	if file == null:
		push_warning("Telemetry: cannot write %s (error %d)." % [report_path, FileAccess.get_open_error()])
		return ""
	file.store_string(JSON.stringify(_last_report, "\t"))
	return report_path


func build_report(outcome: StringName, summary: Dictionary) -> Dictionary:
	return {
		"schema_version": 1,
		"outcome": String(outcome),
		"run": _run_info,
		"summary": summary,
		"actors": _actor_stats,
		"enemy_kills_by_type": _enemy_kills_by_type,
		"upgrade_picks": _upgrade_picks,
		"item_pickups": _item_pickups,
		"command_outcomes": _command_outcomes,
		"samples": _samples,
		"events": _event_log,
	}


func last_report() -> Dictionary:
	return _last_report


func _stats_for(actor_id: int) -> Dictionary:
	if not _actor_stats.has(actor_id):
		_actor_stats[actor_id] = {
			"damage_dealt": 0.0, "damage_taken": 0.0, "healing": 0.0, "kills": 0,
			"deaths": 0, "xp_gained": 0.0, "level": 1, "abilities_used": {},
		}
	return _actor_stats[actor_id]


func _on_damage_dealt(source_id: int, target_id: int, amount: float, _is_crit: bool, ability_id: StringName) -> void:
	if not is_recording:
		return
	if source_id >= 0:
		var source_stats: Dictionary = _stats_for(source_id)
		source_stats["damage_dealt"] = float(source_stats["damage_dealt"]) + amount
	var target_stats: Dictionary = _stats_for(target_id)
	target_stats["damage_taken"] = float(target_stats["damage_taken"]) + amount
	if String(ability_id).begins_with("hazard"):
		log_event(&"hazard_damage", {"target": target_id, "amount": snappedf(amount, 0.1), "hazard": String(ability_id)})


func _on_actor_healed(actor_id: int, amount: float, _reason: StringName) -> void:
	if is_recording:
		var stats: Dictionary = _stats_for(actor_id)
		stats["healing"] = float(stats["healing"]) + amount


func _on_actor_died(actor_id: int, killer_id: int, team_id: int, archetype_id: StringName) -> void:
	if not is_recording:
		return
	_stats_for(actor_id)["deaths"] = int(_stats_for(actor_id)["deaths"]) + 1
	if killer_id >= 0:
		_stats_for(killer_id)["kills"] = int(_stats_for(killer_id)["kills"]) + 1
	if team_id == TeamIds.ENEMY:
		var key: String = String(archetype_id)
		_enemy_kills_by_type[key] = int(_enemy_kills_by_type.get(key, 0)) + 1
	if team_id == TeamIds.PLAYER or String(archetype_id).begins_with("elite"):
		log_event(&"actor_died", {"actor": actor_id, "killer": killer_id, "archetype": String(archetype_id)})


func _on_xp_gained(actor_id: int, amount: float) -> void:
	if is_recording:
		var stats: Dictionary = _stats_for(actor_id)
		stats["xp_gained"] = float(stats["xp_gained"]) + amount


func _on_level_gained(actor_id: int, new_level: int) -> void:
	if is_recording:
		_stats_for(actor_id)["level"] = new_level
		log_event(&"level_gained", {"actor": actor_id, "level": new_level})


func _on_upgrade_selected(actor_id: int, upgrade_id: StringName, new_stacks: int) -> void:
	if is_recording:
		var key: String = String(upgrade_id)
		_upgrade_picks[key] = int(_upgrade_picks.get(key, 0)) + 1
		log_event(&"upgrade_selected", {"actor": actor_id, "upgrade": key, "stacks": new_stacks})


func _on_item_acquired(actor_id: int, item_id: StringName, new_stacks: int) -> void:
	if is_recording:
		var key: String = String(item_id)
		_item_pickups[key] = int(_item_pickups.get(key, 0)) + 1
		log_event(&"item_acquired", {"actor": actor_id, "item": key, "stacks": new_stacks})


func _on_ability_used(actor_id: int, ability_id: StringName) -> void:
	if is_recording:
		var used: Dictionary = _stats_for(actor_id)["abilities_used"]
		var key: String = String(ability_id)
		used[key] = int(used.get(key, 0)) + 1


func _on_command_processed(controller_id: int, _actor_id: int, command_type: StringName, accepted: bool, reason: StringName) -> void:
	if not is_recording:
		return
	var key: String = "controller_%d/%s/%s" % [controller_id, command_type, "ok" if accepted else String(reason)]
	_command_outcomes[key] = int(_command_outcomes.get(key, 0)) + 1
