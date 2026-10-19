class_name KeybindRow
extends HBoxContainer
## One row in the Input tab: action name plus a button that captures the next key
## or mouse click as the new binding. Escape cancels the capture.

var action_id: String = ""
var _button: Button
var _capturing: bool = false


func setup(action_entry: Dictionary) -> void:
	action_id = action_entry["id"]
	add_theme_constant_override("separation", 16)
	var label := Label.new()
	label.text = action_entry["label"]
	label.custom_minimum_size = Vector2(240.0, 0.0)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_child(label)
	_button = Button.new()
	_button.custom_minimum_size = Vector2(240.0, 0.0)
	_button.focus_mode = Control.FOCUS_ALL
	_button.pressed.connect(_begin_capture)
	add_child(_button)
	Events.settings_changed.connect(func(_changed_id: StringName) -> void: _refresh_text())
	_refresh_text()


func _refresh_text() -> void:
	if is_instance_valid(_button) and not _capturing:
		_button.text = Settings.describe_binding(action_id)


func _begin_capture() -> void:
	_capturing = true
	_button.text = "Press a key or click..."


func _input(event: InputEvent) -> void:
	if not _capturing:
		return
	var is_key: bool = event is InputEventKey and event.pressed and not event.echo
	var is_click: bool = event is InputEventMouseButton and event.pressed
	if not is_key and not is_click:
		return
	get_viewport().set_input_as_handled()
	_capturing = false
	if is_key and (event as InputEventKey).physical_keycode == KEY_ESCAPE:
		_refresh_text()
		return
	Settings.rebind_action(action_id, event)
	_refresh_text()
	_button.grab_focus.call_deferred()
