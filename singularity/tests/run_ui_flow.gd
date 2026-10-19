extends Node
## End-to-end flow through the real Main scene: menu -> character select -> run ->
## pause -> inventory -> level-up -> restart -> defeat -> results -> menu.
## Works headless for assertions. With a display (e.g. under xvfb) it can also save
## screenshots:
##
##   godot --path . --fixed-fps 60 res://tests/run_ui_flow.tscn -- screens=/some/dir

var _passed: int = 0
var _failed: int = 0
var _screens_directory: String = ""
var _main: Node


func _ready() -> void:
	Telemetry.write_reports_to_disk = false
	Profile.persistence_enabled = false
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("screens="):
			_screens_directory = argument.trim_prefix("screens=")
			DirAccess.make_dir_recursive_absolute(_screens_directory)
	_main = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	add_child(_main)
	await _frames(3)
	await _run_flow()
	print("\nui flow checks passed: %d, failed: %d" % [_passed, _failed])
	get_tree().quit(1 if _failed > 0 else 0)


func _check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
	else:
		_failed += 1
		print("FAIL: %s" % description)


func _frames(count: int) -> void:
	for index: int in count:
		await get_tree().physics_frame


func _screenshot(screen_name: String) -> void:
	if _screens_directory.is_empty() or DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	var image: Image = get_viewport().get_texture().get_image()
	image.save_png("%s/%s.png" % [_screens_directory, screen_name])


func _screen(screen_name: String) -> Control:
	return _main._screens[screen_name]


func _press_action(action_name: String) -> void:
	var press := InputEventAction.new()
	press.action = action_name
	press.pressed = true
	Input.parse_input_event(press)
	await _frames(2)
	var release := InputEventAction.new()
	release.action = action_name
	release.pressed = false
	Input.parse_input_event(release)
	await _frames(1)


func _press_key(keycode: Key) -> void:
	var event := InputEventKey.new()
	event.keycode = keycode
	event.physical_keycode = keycode
	event.pressed = true
	Input.parse_input_event(event)
	await _frames(2)
	event = InputEventKey.new()
	event.keycode = keycode
	event.physical_keycode = keycode
	event.pressed = false
	Input.parse_input_event(event)
	await _frames(1)


func _run_flow() -> void:
	_check(GameState.current_state == GameState.State.MAIN_MENU, "boots into the main menu")
	_check(_screen("main_menu").visible and not _screen("pause").visible, "only the main menu is visible at boot")
	await _screenshot("01_main_menu")

	GameState.change_state(GameState.State.CHARACTER_SELECT)
	await _frames(3)
	_check(_screen("character_select").visible, "character select opens")
	_check((_screen("character_select")._roster_buttons as Dictionary).size() == 12, "character select lists all 12 singularities")
	await _screenshot("02_character_select")

	GameState.change_state(GameState.State.MAIN_MENU)
	await _frames(2)
	_main._open_settings("main_menu")
	await _frames(3)
	_check(_screen("settings").visible and not _screen("main_menu").visible, "settings opens over the main menu")
	await _screenshot("03_settings")
	_screen("settings").back_requested.emit()
	await _frames(2)
	_check(_screen("main_menu").visible and not _screen("settings").visible, "closing settings returns to the main menu")

	GameState.change_state(GameState.State.CHARACTER_SELECT)
	var config := RunConfig.new()
	config.character_id = &"c_lo_d"
	config.ally_character_ids = [&"hell_eater", &"binaural_sphere"]
	config.random_seed = 4242
	GameState.start_run(config)
	await _frames(30)
	_check(GameState.current_state == GameState.State.PLAYING, "starting a run enters PLAYING")
	_check(_main._session != null and _main._hud.visible, "run session exists and the HUD is shown")
	var session: RunSession = _main._session
	var start_position: Vector3 = session.human_actor.global_position
	session.human_actor.invulnerable_until = INF # the flow test is about UI, not survival
	await _screenshot("04_gameplay_start")

	# Movement through the real input path.
	Input.action_press("move_right")
	await _frames(60)
	Input.action_release("move_right")
	_check(session.human_actor.global_position.distance_to(start_position) > 2.0, "movement input moves the character (%.1f m)" % session.human_actor.global_position.distance_to(start_position))

	# Let the fight develop, then use abilities through input.
	await _frames(60 * 20)
	await _press_action("ability_one")
	await _press_action("ability_two")
	await _screenshot("05_gameplay_combat")

	# Pause, inventory, resume.
	await _press_action("pause_game")
	_check(GameState.current_state == GameState.State.PAUSED and get_tree().paused and _screen("pause").visible, "Escape pauses and shows the pause menu")
	var time_at_pause: float = session.sim_time
	await _frames(30)
	_check(is_equal_approx(session.sim_time, time_at_pause), "simulation time is frozen while paused")
	await _screenshot("06_pause")
	_screen("pause").inventory_requested.emit()
	await _frames(2)
	_check(_screen("inventory").visible, "inventory opens from the pause menu")
	await _screenshot("07_inventory")
	_screen("inventory").close_requested.emit()
	_screen("pause").back_requested.emit()
	await _frames(3)
	_check(GameState.current_state == GameState.State.PLAYING and not get_tree().paused, "resume returns to PLAYING and unpauses")

	# Inventory hotkey.
	await _press_action("open_inventory")
	_check(GameState.current_state == GameState.State.PAUSED and _screen("inventory").visible, "the inventory hotkey pauses and opens the inventory")
	await _press_action("open_inventory")
	_check(GameState.current_state == GameState.State.PLAYING, "the inventory hotkey toggles back")

	# Level-up with two queued levels.
	var human: SingularityActor = session.human_actor
	var needed: float = Balance.config.xp_curve.total_xp_to_reach(human.progression.level + 2) - human.progression.total_xp
	human.gain_xp(needed / human.stats.get_value(StatIds.XP_GAIN) + 1.0)
	await _frames(3)
	_check(GameState.current_state == GameState.State.LEVEL_UP and _screen("level_up").visible, "gaining a level opens the level-up screen")
	_check(get_tree().paused, "the game is paused during level-up")
	_check((_screen("level_up")._choice_buttons as Array).size() == 3, "three upgrade cards are shown")
	await _screenshot("08_level_up")
	await _press_key(KEY_1)
	_check(GameState.current_state == GameState.State.LEVEL_UP, "a second queued level-up keeps the screen open")
	await _press_key(KEY_2)
	_check(GameState.current_state == GameState.State.PLAYING and human.progression.pending_level_ups == 0, "resolving all queued level-ups resumes play")

	# Tactical overview and ally stances.
	await _press_action("toggle_tactical")
	_check(session.camera_rig.is_tactical, "the tactical key switches to the overview camera")
	await _press_key(KEY_2)
	var stance_ok: bool = true
	var ally_controllers: int = 0
	for controller_id: int in session.get_controller_ids():
		var ally_controller := session.get_controller(controller_id) as ConventionalAIController
		if ally_controller != null:
			ally_controllers += 1
			stance_ok = stance_ok and ally_controller.stance == ConventionalAIController.Stance.HOLD
	_check(ally_controllers == 2 and stance_ok, "number keys in tactical mode set the allies' stance")
	await _screenshot("08b_tactical")
	await _press_action("toggle_tactical")
	_check(not session.camera_rig.is_tactical and is_equal_approx(Engine.time_scale, 1.0), "the tactical key toggles back")

	# Open a chest through input.
	var chest: ItemChest = session.spawn_chest_near(human.global_position + Vector3(1.0, 0.0, 0.0))
	await _frames(2)
	await _press_action("interact")
	_check(chest.is_opened, "the interact key opens a nearby chest")

	# Restart keeps the same configuration but builds a new session.
	var old_session: RunSession = session
	GameState.restart_run()
	await _frames(10)
	_check(_main._session != old_session and GameState.current_state == GameState.State.PLAYING, "restart creates a fresh session")
	_check(_main._session.sim_time < 1.0 and _main._session.kills == 0, "the restarted run starts from zero")

	# Defeat and the results screen.
	var lethal := DamageInfo.new()
	lethal.amount = 100000.0
	_main._session.human_actor.take_damage(lethal)
	await _frames(60 * 3)
	_check(GameState.current_state == GameState.State.RUN_ENDED and _screen("run_end").visible, "dying ends the run and shows the results")
	await _screenshot("09_run_end")
	_screen("run_end").restart_requested.emit()
	await _frames(10)
	_check(GameState.current_state == GameState.State.PLAYING and _main._session.is_run_active(), "restart works from the results screen")
	GameState.pause_game()
	await _frames(2)
	GameState.return_to_main_menu()
	await _frames(5)
	_check(GameState.current_state == GameState.State.MAIN_MENU and _main._session == null and _screen("main_menu").visible, "quitting to the menu clears the run")
	_check(not get_tree().paused and is_equal_approx(Engine.time_scale, 1.0), "the tree is unpaused at the menu")
