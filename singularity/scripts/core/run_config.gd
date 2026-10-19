class_name RunConfig
extends RefCounted
## Everything needed to start (or restart) a run.

var character_id: StringName = &"hell_eater"
## AI-controlled allied singularities (conventional AI). Empty for solo.
var ally_character_ids: Array[StringName] = []
var map_id: StringName = &"lab_00"
## 0 means "pick a random seed at start".
var random_seed: int = 0
## Optional override of Balance victory time; <= 0 uses the balance config.
var victory_seconds_override: float = 0.0


func duplicate_config() -> RunConfig:
	var copy := RunConfig.new()
	copy.character_id = character_id
	copy.ally_character_ids = ally_character_ids.duplicate()
	copy.map_id = map_id
	copy.random_seed = random_seed
	copy.victory_seconds_override = victory_seconds_override
	return copy
