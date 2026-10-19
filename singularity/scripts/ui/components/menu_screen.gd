class_name MenuScreen
extends Control
## Base class for full-screen menus: dim backdrop, centred panel, title, content
## column, consistent keyboard focus handling and Escape-to-go-back.

signal back_requested

var content: VBoxContainer
var _title_label: Label
var _default_focus: Control
var _panel: PanelContainer


func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	process_mode = Node.PROCESS_MODE_ALWAYS
	visible = false
	visibility_changed.connect(_on_visibility_changed)


## Creates the backdrop and centred panel. Call once from the subclass _init/_ready.
func build_panel(title: String, panel_width: float = 560.0) -> VBoxContainer:
	var backdrop := Panel.new()
	backdrop.theme_type_variation = &"ScreenBackground"
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(backdrop)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	_panel = PanelContainer.new()
	_panel.custom_minimum_size = Vector2(panel_width, 0.0)
	center.add_child(_panel)
	content = VBoxContainer.new()
	content.add_theme_constant_override("separation", 12)
	_panel.add_child(content)
	_title_label = Label.new()
	_title_label.theme_type_variation = &"TitleLabel"
	_title_label.text = title
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(_title_label)
	return content


func set_title(title: String) -> void:
	_title_label.text = title


func add_button(label_text: String, on_pressed: Callable, parent: Control = null) -> Button:
	var button := Button.new()
	button.text = label_text
	button.custom_minimum_size = Vector2(0.0, 44.0)
	button.focus_mode = Control.FOCUS_ALL
	button.pressed.connect(on_pressed)
	(parent if parent != null else content).add_child(button)
	if _default_focus == null:
		_default_focus = button
	return button


func add_label(label_text: String, variation: StringName = &"", parent: Control = null, wrap: bool = false) -> Label:
	var label := Label.new()
	label.text = label_text
	if variation != &"":
		label.theme_type_variation = variation
	if wrap:
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size.x = 120.0
	(parent if parent != null else content).add_child(label)
	return label


func add_separator(parent: Control = null) -> void:
	(parent if parent != null else content).add_child(HSeparator.new())


func set_default_focus(control: Control) -> void:
	_default_focus = control


func focus_default() -> void:
	if is_inside_tree() and is_instance_valid(_default_focus) and _default_focus.is_visible_in_tree():
		_default_focus.grab_focus()


func _on_visibility_changed() -> void:
	if visible:
		_on_shown()
		focus_default.call_deferred()


## Subclass hook, runs when the screen becomes visible (refresh dynamic content here).
func _on_shown() -> void:
	pass


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		back_requested.emit()
