extends Node
## Small persistent player profile (JSON in user://). Separate from Settings.

const PROFILE_PATH := "user://profile.json"
const PROFILE_VERSION := 1

var best_survival_seconds: float = 0.0
var best_level: int = 1
var runs_played: int = 0
var victories: int = 0
var last_character_id: String = ""
var last_ally_ids: Array[String] = []
## Automated tests switch this off so they never touch the player's profile.
var persistence_enabled: bool = true
var profile_path: String = PROFILE_PATH


func _ready() -> void:
	load_profile()


func load_profile() -> void:
	if not FileAccess.file_exists(profile_path):
		return
	var file := FileAccess.open(profile_path, FileAccess.READ)
	if file == null:
		push_warning("Profile: cannot read %s (error %d)." % [profile_path, FileAccess.get_open_error()])
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("Profile: file is corrupt; starting with a fresh profile.")
		return
	var data: Dictionary = parsed
	best_survival_seconds = maxf(float(data.get("best_survival_seconds", 0.0)), 0.0)
	best_level = maxi(int(data.get("best_level", 1)), 1)
	runs_played = maxi(int(data.get("runs_played", 0)), 0)
	victories = maxi(int(data.get("victories", 0)), 0)
	last_character_id = String(data.get("last_character_id", ""))
	last_ally_ids.clear()
	var stored_allies: Variant = data.get("last_ally_ids", [])
	if typeof(stored_allies) == TYPE_ARRAY:
		for ally_id: Variant in stored_allies:
			last_ally_ids.append(String(ally_id))


func save_profile() -> void:
	if not persistence_enabled:
		return
	var file := FileAccess.open(profile_path, FileAccess.WRITE)
	if file == null:
		push_warning("Profile: cannot write %s (error %d)." % [profile_path, FileAccess.get_open_error()])
		return
	file.store_string(JSON.stringify({
		"version": PROFILE_VERSION,
		"best_survival_seconds": best_survival_seconds,
		"best_level": best_level,
		"runs_played": runs_played,
		"victories": victories,
		"last_character_id": last_character_id,
		"last_ally_ids": last_ally_ids,
	}, "\t"))


func record_run(summary: Dictionary) -> void:
	runs_played += 1
	if StringName(summary.get("outcome", &"")) == &"victory":
		victories += 1
	best_survival_seconds = maxf(best_survival_seconds, float(summary.get("survival_seconds", 0.0)))
	best_level = maxi(best_level, int(summary.get("level", 1)))
	save_profile()
