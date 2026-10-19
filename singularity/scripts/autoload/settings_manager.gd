extends Node
## Persistent settings: audio, graphics, input bindings and accessibility.
##
## Settings are described by SCHEMA, so the settings UI is generated from it and
## adding a setting means adding one entry here. Values are validated and clamped on
## load; unknown or malformed entries fall back to defaults.

const SETTINGS_PATH := "user://settings.cfg"
const SETTINGS_VERSION := 1
const MIN_UI_SCALE := 0.8

## Each entry: id, section, label, kind (slider|toggle|option), default,
## and for slider min/max/step/suffix, for option labels.
const SCHEMA: Array[Dictionary] = [
	{"id": "audio/master_volume", "section": "Audio", "label": "Master volume", "kind": "slider", "default": 80, "min": 0, "max": 100, "step": 1, "suffix": "%"},
	{"id": "audio/music_volume", "section": "Audio", "label": "Music volume", "kind": "slider", "default": 70, "min": 0, "max": 100, "step": 1, "suffix": "%"},
	{"id": "audio/sfx_volume", "section": "Audio", "label": "Effects volume", "kind": "slider", "default": 80, "min": 0, "max": 100, "step": 1, "suffix": "%"},
	{"id": "audio/mute_unfocused", "section": "Audio", "label": "Mute when window unfocused", "kind": "toggle", "default": false},
	{"id": "graphics/window_mode", "section": "Graphics", "label": "Window mode", "kind": "option", "default": 0, "labels": ["Windowed", "Fullscreen", "Borderless fullscreen"]},
	{"id": "graphics/vsync", "section": "Graphics", "label": "Vertical sync", "kind": "toggle", "default": true},
	{"id": "graphics/render_scale", "section": "Graphics", "label": "3D render scale", "kind": "slider", "default": 100, "min": 50, "max": 100, "step": 5, "suffix": "%"},
	{"id": "graphics/msaa", "section": "Graphics", "label": "Anti-aliasing (MSAA)", "kind": "option", "default": 0, "labels": ["Off", "2x", "4x"]},
	{"id": "graphics/shadows", "section": "Graphics", "label": "Shadows", "kind": "toggle", "default": true},
	{"id": "graphics/max_fps", "section": "Graphics", "label": "Frame rate limit", "kind": "option", "default": 0, "labels": ["Unlimited", "30", "60", "120", "144"]},
	{"id": "graphics/show_fps", "section": "Graphics", "label": "Show FPS counter", "kind": "toggle", "default": false},
	{"id": "accessibility/ui_scale", "section": "Accessibility", "label": "Interface scale", "kind": "slider", "default": 100, "min": 80, "max": 150, "step": 5, "suffix": "%"},
	{"id": "accessibility/high_contrast", "section": "Accessibility", "label": "High-contrast interface", "kind": "toggle", "default": false},
	{"id": "accessibility/reduce_motion", "section": "Accessibility", "label": "Reduce motion and flashes", "kind": "toggle", "default": false},
	{"id": "accessibility/screen_shake", "section": "Accessibility", "label": "Screen shake", "kind": "slider", "default": 60, "min": 0, "max": 100, "step": 5, "suffix": "%"},
	{"id": "accessibility/damage_numbers", "section": "Accessibility", "label": "Floating damage numbers", "kind": "toggle", "default": true},
	{"id": "accessibility/colorblind_mode", "section": "Accessibility", "label": "Team colour palette", "kind": "option", "default": 0, "labels": ["Standard", "Red-green safe", "Blue-yellow safe"]},
	{"id": "gameplay/auto_attack", "section": "Accessibility", "label": "Auto-attack nearest enemy", "kind": "toggle", "default": false},
]

## Action id -> { label, defaults: ["key:87", "mouse:1", ...] }. Order is display order.
const INPUT_ACTIONS: Array[Dictionary] = [
	{"id": "move_up", "label": "Move up", "defaults": ["key:%d" % KEY_W, "key:%d" % KEY_UP]},
	{"id": "move_down", "label": "Move down", "defaults": ["key:%d" % KEY_S, "key:%d" % KEY_DOWN]},
	{"id": "move_left", "label": "Move left", "defaults": ["key:%d" % KEY_A, "key:%d" % KEY_LEFT]},
	{"id": "move_right", "label": "Move right", "defaults": ["key:%d" % KEY_D, "key:%d" % KEY_RIGHT]},
	{"id": "attack_primary", "label": "Primary attack", "defaults": ["mouse:%d" % MOUSE_BUTTON_LEFT, "key:%d" % KEY_J]},
	{"id": "ability_one", "label": "Ability 1", "defaults": ["mouse:%d" % MOUSE_BUTTON_RIGHT, "key:%d" % KEY_SPACE]},
	{"id": "ability_two", "label": "Ability 2", "defaults": ["key:%d" % KEY_E]},
	{"id": "use_equipment", "label": "Use equipment", "defaults": ["key:%d" % KEY_G]},
	{"id": "interact", "label": "Interact", "defaults": ["key:%d" % KEY_F]},
	{"id": "toggle_tactical", "label": "Tactical overview", "defaults": ["key:%d" % KEY_T]},
	{"id": "camera_rotate_left", "label": "Rotate camera left", "defaults": ["key:%d" % KEY_Q]},
	{"id": "camera_rotate_right", "label": "Rotate camera right", "defaults": ["key:%d" % KEY_R]},
	{"id": "open_inventory", "label": "Inventory", "defaults": ["key:%d" % KEY_TAB, "key:%d" % KEY_I]},
	{"id": "pause_game", "label": "Pause", "defaults": ["key:%d" % KEY_ESCAPE, "key:%d" % KEY_P]},
]

## Overridable so tests never touch the player's real settings file.
var settings_path: String = SETTINGS_PATH
var _values: Dictionary = {}
## action id -> Array of descriptors, only for actions the player has rebound.
var _input_overrides: Dictionary = {}
var _save_scheduled: bool = false
var _is_headless: bool = DisplayServer.get_name() == "headless"


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_reset_values_to_defaults()
	_ensure_audio_buses()
	load_settings()
	apply_input_bindings()
	apply_all()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if get_bool("audio/mute_unfocused"):
			AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), true)
	elif what == NOTIFICATION_APPLICATION_FOCUS_IN:
		AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), false)


# --- Value access -----------------------------------------------------------

func get_value(setting_id: String) -> Variant:
	return _values.get(setting_id, _schema_entry(setting_id).get("default"))


func get_bool(setting_id: String) -> bool:
	return bool(get_value(setting_id))


func get_int(setting_id: String) -> int:
	return int(get_value(setting_id))


func get_float(setting_id: String) -> float:
	return float(get_value(setting_id))


func set_value(setting_id: String, value: Variant) -> void:
	var entry: Dictionary = _schema_entry(setting_id)
	if entry.is_empty():
		push_warning("Settings: unknown setting '%s'." % setting_id)
		return
	var sanitized: Variant = _sanitize(entry, value)
	if _values.get(setting_id) == sanitized:
		return
	_values[setting_id] = sanitized
	_apply_setting(setting_id)
	Events.settings_changed.emit(StringName(setting_id))
	schedule_save()


func schema_entries() -> Array[Dictionary]:
	return SCHEMA


func reset_section_to_defaults(section: String) -> void:
	for entry: Dictionary in SCHEMA:
		if entry["section"] == section:
			set_value(entry["id"], entry["default"])


# --- Input bindings ---------------------------------------------------------

func apply_input_bindings() -> void:
	for action_entry: Dictionary in INPUT_ACTIONS:
		var action_name: StringName = StringName(action_entry["id"])
		if not InputMap.has_action(action_name):
			InputMap.add_action(action_name, 0.4)
		InputMap.action_erase_events(action_name)
		for descriptor: String in get_binding_descriptors(String(action_entry["id"])):
			var input_event: InputEvent = descriptor_to_event(descriptor)
			if input_event != null:
				InputMap.action_add_event(action_name, input_event)


func get_binding_descriptors(action_id: String) -> Array[String]:
	var descriptors: Array[String] = []
	if _input_overrides.has(action_id):
		for descriptor: Variant in _input_overrides[action_id]:
			descriptors.append(String(descriptor))
		return descriptors
	for action_entry: Dictionary in INPUT_ACTIONS:
		if action_entry["id"] == action_id:
			for descriptor: String in action_entry["defaults"]:
				descriptors.append(descriptor)
	return descriptors


func rebind_action(action_id: String, input_event: InputEvent) -> bool:
	var descriptor: String = event_to_descriptor(input_event)
	if descriptor.is_empty():
		return false
	_input_overrides[action_id] = [descriptor]
	apply_input_bindings()
	Events.settings_changed.emit(StringName("input/%s" % action_id))
	schedule_save()
	return true


func reset_input_bindings() -> void:
	_input_overrides.clear()
	apply_input_bindings()
	Events.settings_changed.emit(&"input/all")
	schedule_save()


func describe_binding(action_id: String) -> String:
	var labels: PackedStringArray = PackedStringArray()
	for descriptor: String in get_binding_descriptors(action_id):
		var input_event: InputEvent = descriptor_to_event(descriptor)
		if input_event != null:
			labels.append(input_event.as_text().replace(" (Physical)", "").replace("Left Mouse Button", "LMB").replace("Right Mouse Button", "RMB").replace("Middle Mouse Button", "MMB"))
	return " / ".join(labels) if not labels.is_empty() else "Unbound"


static func event_to_descriptor(input_event: InputEvent) -> String:
	if input_event is InputEventKey:
		var key_event := input_event as InputEventKey
		var keycode: int = key_event.physical_keycode if key_event.physical_keycode != KEY_NONE else key_event.keycode
		return "key:%d" % keycode if keycode != KEY_NONE else ""
	if input_event is InputEventMouseButton:
		return "mouse:%d" % (input_event as InputEventMouseButton).button_index
	return ""


static func descriptor_to_event(descriptor: String) -> InputEvent:
	var parts: PackedStringArray = descriptor.split(":")
	if parts.size() != 2 or not parts[1].is_valid_int():
		return null
	var code: int = parts[1].to_int()
	if parts[0] == "key":
		var key_event := InputEventKey.new()
		key_event.physical_keycode = code as Key
		return key_event
	if parts[0] == "mouse":
		var mouse_event := InputEventMouseButton.new()
		mouse_event.button_index = code as MouseButton
		return mouse_event
	return null


# --- Persistence ------------------------------------------------------------

func schedule_save() -> void:
	if _save_scheduled:
		return
	_save_scheduled = true
	get_tree().create_timer(0.4, true, false, true).timeout.connect(save_settings)


func save_settings() -> void:
	_save_scheduled = false
	var config := ConfigFile.new()
	config.set_value("meta", "version", SETTINGS_VERSION)
	for setting_id: String in _values.keys():
		config.set_value("settings", setting_id, _values[setting_id])
	for action_id: String in _input_overrides.keys():
		config.set_value("input", action_id, _input_overrides[action_id])
	var error: int = config.save(settings_path)
	if error != OK:
		push_warning("Settings: could not save %s (error %d)." % [settings_path, error])


func load_settings() -> void:
	var config := ConfigFile.new()
	var error: int = config.load(settings_path)
	if error != OK:
		if error != ERR_FILE_NOT_FOUND:
			push_warning("Settings: could not read %s (error %d); using defaults." % [settings_path, error])
		return
	for entry: Dictionary in SCHEMA:
		var setting_id: String = entry["id"]
		if config.has_section_key("settings", setting_id):
			_values[setting_id] = _sanitize(entry, config.get_value("settings", setting_id))
	_input_overrides.clear()
	if config.has_section("input"):
		for action_id: String in config.get_section_keys("input"):
			var stored: Variant = config.get_value("input", action_id)
			if typeof(stored) != TYPE_ARRAY:
				continue
			var valid_descriptors: Array[String] = []
			for descriptor: Variant in stored:
				if descriptor_to_event(String(descriptor)) != null:
					valid_descriptors.append(String(descriptor))
			if not valid_descriptors.is_empty() and _is_known_action(action_id):
				_input_overrides[action_id] = valid_descriptors


# --- Applying settings to the engine ---------------------------------------

func apply_all() -> void:
	for entry: Dictionary in SCHEMA:
		_apply_setting(entry["id"])


func _apply_setting(setting_id: String) -> void:
	match setting_id:
		"audio/master_volume", "audio/music_volume", "audio/sfx_volume":
			_apply_audio()
		"graphics/window_mode":
			_apply_window_mode()
		"graphics/vsync":
			if not _is_headless:
				DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if get_bool(setting_id) else DisplayServer.VSYNC_DISABLED)
		"graphics/render_scale":
			get_viewport().scaling_3d_scale = clampf(get_float(setting_id) / 100.0, 0.5, 1.0)
		"graphics/msaa":
			get_viewport().msaa_3d = [Viewport.MSAA_DISABLED, Viewport.MSAA_2X, Viewport.MSAA_4X][clampi(get_int(setting_id), 0, 2)]
		"graphics/max_fps":
			Engine.max_fps = [0, 30, 60, 120, 144][clampi(get_int(setting_id), 0, 4)]
		"accessibility/ui_scale":
			get_tree().root.content_scale_factor = maxf(get_float(setting_id) / 100.0, MIN_UI_SCALE)


func _apply_audio() -> void:
	_set_bus_volume("Master", get_float("audio/master_volume"))
	_set_bus_volume("Music", get_float("audio/music_volume"))
	_set_bus_volume("SFX", get_float("audio/sfx_volume"))


func _set_bus_volume(bus_name: String, percent: float) -> void:
	var bus_index: int = AudioServer.get_bus_index(bus_name)
	if bus_index < 0:
		return
	AudioServer.set_bus_volume_db(bus_index, linear_to_db(clampf(percent / 100.0, 0.0, 1.0)))


func _apply_window_mode() -> void:
	if _is_headless:
		return
	match get_int("graphics/window_mode"):
		1:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN)
		2:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
		_:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)


func _ensure_audio_buses() -> void:
	for bus_name: String in ["Music", "SFX"]:
		if AudioServer.get_bus_index(bus_name) < 0:
			AudioServer.add_bus()
			var new_index: int = AudioServer.bus_count - 1
			AudioServer.set_bus_name(new_index, bus_name)
			AudioServer.set_bus_send(new_index, "Master")


# --- Helpers ----------------------------------------------------------------

func _reset_values_to_defaults() -> void:
	_values.clear()
	for entry: Dictionary in SCHEMA:
		_values[entry["id"]] = entry["default"]


func _schema_entry(setting_id: String) -> Dictionary:
	for entry: Dictionary in SCHEMA:
		if entry["id"] == setting_id:
			return entry
	return {}


func _is_known_action(action_id: String) -> bool:
	for action_entry: Dictionary in INPUT_ACTIONS:
		if action_entry["id"] == action_id:
			return true
	return false


func _sanitize(entry: Dictionary, raw_value: Variant) -> Variant:
	match String(entry["kind"]):
		"toggle":
			return bool(raw_value) if typeof(raw_value) == TYPE_BOOL else entry["default"]
		"slider":
			if typeof(raw_value) != TYPE_INT and typeof(raw_value) != TYPE_FLOAT:
				return entry["default"]
			return clampi(roundi(float(raw_value)), int(entry["min"]), int(entry["max"]))
		"option":
			if typeof(raw_value) != TYPE_INT and typeof(raw_value) != TYPE_FLOAT:
				return entry["default"]
			var label_count: int = (entry["labels"] as Array).size()
			return clampi(roundi(float(raw_value)), 0, label_count - 1)
	return entry["default"]
