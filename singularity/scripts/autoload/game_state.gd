extends Node
## Top-level game state machine. Transitions are validated; the scene tree is paused
## for PAUSED and LEVEL_UP. Starting a run is requested here and fulfilled by Main.

enum State { BOOT, MAIN_MENU, CHARACTER_SELECT, PLAYING, PAUSED, LEVEL_UP, RUN_ENDED }

const ALLOWED_TRANSITIONS: Dictionary = {
	State.BOOT: [State.MAIN_MENU],
	State.MAIN_MENU: [State.CHARACTER_SELECT],
	State.CHARACTER_SELECT: [State.MAIN_MENU, State.PLAYING],
	State.PLAYING: [State.PAUSED, State.LEVEL_UP, State.RUN_ENDED, State.MAIN_MENU],
	State.PAUSED: [State.PLAYING, State.MAIN_MENU],
	State.LEVEL_UP: [State.PLAYING, State.RUN_ENDED],
	State.RUN_ENDED: [State.PLAYING, State.MAIN_MENU, State.CHARACTER_SELECT],
}

## Main listens for this to build a fresh run (new or restart).
signal run_requested(config: RunConfig)

var current_state: State = State.BOOT
var current_run_config: RunConfig
var last_run_summary: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func change_state(new_state: State) -> bool:
	if new_state == current_state:
		return true
	var allowed: Array = ALLOWED_TRANSITIONS.get(current_state, [])
	if not allowed.has(new_state):
		push_warning("GameState: blocked transition %s -> %s." % [State.keys()[current_state], State.keys()[new_state]])
		return false
	var previous_state: State = current_state
	current_state = new_state
	get_tree().paused = new_state == State.PAUSED or new_state == State.LEVEL_UP
	if new_state != State.PLAYING and Engine.time_scale != 1.0:
		Engine.time_scale = 1.0
	Events.game_state_changed.emit(previous_state, new_state)
	return true


func is_in_run() -> bool:
	return current_state in [State.PLAYING, State.PAUSED, State.LEVEL_UP]


func start_run(config: RunConfig) -> void:
	if config == null:
		push_error("GameState.start_run: null config.")
		return
	if current_state != State.CHARACTER_SELECT and current_state != State.RUN_ENDED:
		push_warning("GameState.start_run called from %s." % State.keys()[current_state])
		return
	current_run_config = config.duplicate_config()
	Profile.last_character_id = String(config.character_id)
	Profile.last_ally_ids.clear()
	for ally_id: StringName in config.ally_character_ids:
		Profile.last_ally_ids.append(String(ally_id))
	Profile.save_profile()
	run_requested.emit(current_run_config)
	change_state(State.PLAYING)


## Restart with the same configuration (new random seed unless one was fixed).
func restart_run() -> void:
	if current_run_config == null:
		push_warning("GameState.restart_run: no previous run.")
		return
	if current_state == State.PAUSED:
		# Resume first so the paused tree does not swallow the rebuild.
		change_state(State.PLAYING)
	if current_state == State.PLAYING:
		# Rebuild without changing state; Main replaces the world.
		run_requested.emit(current_run_config.duplicate_config())
		return
	if current_state == State.RUN_ENDED:
		run_requested.emit(current_run_config.duplicate_config())
		change_state(State.PLAYING)


func pause_game() -> void:
	if current_state == State.PLAYING:
		change_state(State.PAUSED)


func resume_game() -> void:
	if current_state == State.PAUSED or current_state == State.LEVEL_UP:
		change_state(State.PLAYING)


func end_run(summary: Dictionary) -> void:
	last_run_summary = summary
	change_state(State.RUN_ENDED)


func return_to_main_menu() -> void:
	if current_state == State.PAUSED:
		change_state(State.MAIN_MENU)
	elif current_state in [State.RUN_ENDED, State.CHARACTER_SELECT, State.PLAYING]:
		change_state(State.MAIN_MENU)
