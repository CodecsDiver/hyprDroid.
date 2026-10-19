extends Node
## Application shell: owns the UI screens and the current RunSession, and reacts to
## GameState transitions. Gameplay lives in RunSession; this only wires menus to it.

const SCREEN_MAIN_MENU := "main_menu"
const SCREEN_CHARACTER_SELECT := "character_select"
const SCREEN_SETTINGS := "settings"
const SCREEN_PAUSE := "pause"
const SCREEN_LEVEL_UP := "level_up"
const SCREEN_INVENTORY := "inventory"
const SCREEN_RUN_END := "run_end"

var _world_holder: Node3D
var _ui_layer: CanvasLayer
var _ui_root: Control
var _screens: Dictionary = {}
var _hud: HudScreen
var _session: RunSession
var _settings_return_screen: String = SCREEN_MAIN_MENU
var _inventory_from_hotkey: bool = false

var _main_menu: MainMenuScreen
var _character_select: CharacterSelectScreen
var _settings: SettingsScreen
var _pause: PauseScreen
var _level_up: LevelUpScreen
var _inventory: InventoryScreen
var _run_end: RunEndScreen


func _ready() -> void:
	# Main keeps receiving input while the tree is paused (to resume); the world must still freeze.
	process_mode = Node.PROCESS_MODE_ALWAYS
	_world_holder = Node3D.new()
	_world_holder.name = "WorldHolder"
	_world_holder.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(_world_holder)
	_ui_layer = CanvasLayer.new()
	_ui_layer.name = "UiLayer"
	_ui_layer.layer = 10
	_ui_layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(_ui_layer)
	# Controls parented to a CanvasLayer do not inherit Window.theme, so the theme lives on this root.
	_ui_root = Control.new()
	_ui_root.name = "UiRoot"
	_ui_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_ui_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ui_layer.add_child(_ui_root)

	_apply_theme()
	Events.settings_changed.connect(func(setting_id: StringName) -> void:
		if setting_id == &"accessibility/high_contrast":
			_apply_theme())
	_build_screens()
	Events.game_state_changed.connect(_on_game_state_changed)
	GameState.run_requested.connect(_on_run_requested)
	Events.upgrade_choices_ready.connect(_on_upgrade_choices_ready)
	GameState.change_state(GameState.State.MAIN_MENU)


func _notification(what: int) -> void:
	# Pause automatically if the window loses focus mid-run.
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and GameState.current_state == GameState.State.PLAYING:
		GameState.pause_game()


func _apply_theme() -> void:
	_ui_root.theme = UiTheme.build(Settings.get_bool("accessibility/high_contrast"))


func _build_screens() -> void:
	_main_menu = MainMenuScreen.new()
	_character_select = CharacterSelectScreen.new()
	_settings = SettingsScreen.new()
	_pause = PauseScreen.new()
	_level_up = LevelUpScreen.new()
	_inventory = InventoryScreen.new()
	_run_end = RunEndScreen.new()
	_hud = HudScreen.new()
	_screens = {
		SCREEN_MAIN_MENU: _main_menu, SCREEN_CHARACTER_SELECT: _character_select, SCREEN_SETTINGS: _settings,
		SCREEN_PAUSE: _pause, SCREEN_LEVEL_UP: _level_up, SCREEN_INVENTORY: _inventory, SCREEN_RUN_END: _run_end,
	}
	_ui_root.add_child(_hud)
	for screen: Control in _screens.values():
		_ui_root.add_child(screen)

	_main_menu.play_requested.connect(func() -> void: GameState.change_state(GameState.State.CHARACTER_SELECT))
	_main_menu.settings_requested.connect(_open_settings.bind(SCREEN_MAIN_MENU))
	_main_menu.quit_requested.connect(func() -> void: get_tree().quit())

	_character_select.back_requested.connect(func() -> void: GameState.change_state(GameState.State.MAIN_MENU))
	_character_select.start_requested.connect(func(config: RunConfig) -> void: GameState.start_run(config))

	_settings.back_requested.connect(_close_settings)

	_pause.resume_requested.connect(GameState.resume_game)
	_pause.back_requested.connect(GameState.resume_game)
	_pause.inventory_requested.connect(_open_inventory.bind(false))
	_pause.settings_requested.connect(_open_settings.bind(SCREEN_PAUSE))
	_pause.restart_requested.connect(GameState.restart_run)
	_pause.main_menu_requested.connect(GameState.return_to_main_menu)

	_level_up.choice_selected.connect(_on_level_up_choice)

	_inventory.close_requested.connect(_close_inventory)

	_run_end.restart_requested.connect(GameState.restart_run)
	_run_end.character_select_requested.connect(func() -> void: GameState.change_state(GameState.State.CHARACTER_SELECT))
	_run_end.main_menu_requested.connect(GameState.return_to_main_menu)


# --- Screen visibility -----------------------------------------------------------------

func _show_only(visible_names: Array[String], show_hud: bool = false) -> void:
	for screen_name: String in _screens.keys():
		(_screens[screen_name] as Control).visible = visible_names.has(screen_name)
	_hud.visible = show_hud


func _on_game_state_changed(_previous_state: int, new_state: int) -> void:
	match new_state:
		GameState.State.MAIN_MENU:
			_clear_session()
			_show_only([SCREEN_MAIN_MENU])
		GameState.State.CHARACTER_SELECT:
			_clear_session()
			_show_only([SCREEN_CHARACTER_SELECT])
		GameState.State.PLAYING:
			_show_only([], true)
		GameState.State.PAUSED:
			if _inventory_from_hotkey:
				_show_only([SCREEN_INVENTORY], true)
			else:
				_show_only([SCREEN_PAUSE], true)
		GameState.State.LEVEL_UP:
			_show_only([SCREEN_LEVEL_UP], true)
			if _session != null:
				_level_up.show_choices(_session.human_actor)
		GameState.State.RUN_ENDED:
			_run_end.show_summary(GameState.last_run_summary)
			_show_only([SCREEN_RUN_END], true)


func _open_settings(return_screen: String) -> void:
	_settings_return_screen = return_screen
	_screens[return_screen].visible = false
	_settings.visible = true


func _close_settings() -> void:
	_settings.visible = false
	_screens[_settings_return_screen].visible = true


func _open_inventory(from_hotkey: bool) -> void:
	if _session == null:
		return
	_inventory_from_hotkey = from_hotkey
	_inventory.show_for(_session.human_actor)
	_pause.visible = false
	_inventory.visible = true


func _close_inventory() -> void:
	_inventory.visible = false
	if _inventory_from_hotkey:
		_inventory_from_hotkey = false
		GameState.resume_game()
	else:
		_pause.visible = true


# --- Runs ----------------------------------------------------------------------------------

func _on_run_requested(config: RunConfig) -> void:
	_clear_session()
	_session = RunSession.new()
	_world_holder.add_child(_session)
	if not _session.initialize(config):
		push_error("Main: run failed to initialise; returning to the menu.")
		_clear_session()
		GameState.current_state = GameState.State.CHARACTER_SELECT
		GameState.change_state(GameState.State.MAIN_MENU)
		return
	_hud.bind(_session)


func _clear_session() -> void:
	if _session != null:
		_session.queue_free()
		_session = null


func _on_upgrade_choices_ready(actor_id: int) -> void:
	if _session == null or actor_id != _session.human_actor.actor_id:
		return
	if GameState.current_state == GameState.State.PLAYING:
		GameState.change_state(GameState.State.LEVEL_UP)
	elif GameState.current_state == GameState.State.LEVEL_UP:
		_level_up.show_choices(_session.human_actor)


func _on_level_up_choice(index: int) -> void:
	if _session == null:
		return
	var human: SingularityActor = _session.human_actor
	var result: ActionResult = _session.submit_command(RunSession.FIRST_PLAYER_CONTROLLER_ID, human.actor_id, ActionCommand.select_upgrade(index))
	if not result.accepted:
		push_warning("Level-up selection rejected: %s" % result.reason)
		return
	if human.progression.pending_choices.is_empty():
		GameState.resume_game()


func _unhandled_input(event: InputEvent) -> void:
	match GameState.current_state:
		GameState.State.PLAYING:
			if event.is_action_pressed("pause_game"):
				get_viewport().set_input_as_handled()
				GameState.pause_game()
			elif event.is_action_pressed("open_inventory"):
				get_viewport().set_input_as_handled()
				_inventory_from_hotkey = true
				GameState.pause_game()
				_open_inventory(true)
		GameState.State.PAUSED:
			if event.is_action_pressed("open_inventory") and _inventory.visible:
				get_viewport().set_input_as_handled()
				_close_inventory()
