class_name SettingsScreen
extends MenuScreen
## Tabbed settings built from Settings.SCHEMA plus the input rebinding list.

func _init() -> void:
	super._init()
	build_panel("Settings", 760.0)
	var tabs := TabContainer.new()
	tabs.custom_minimum_size = Vector2(0.0, 420.0)
	tabs.tab_focus_mode = Control.FOCUS_ALL
	content.add_child(tabs)

	var sections: Array[String] = ["Audio", "Graphics", "Accessibility"]
	var first_control: Control = null
	for section: String in sections:
		var page := VBoxContainer.new()
		page.name = section
		page.add_theme_constant_override("separation", 10)
		var scroll := ScrollContainer.new()
		scroll.name = section
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		scroll.add_child(page)
		page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tabs.add_child(scroll)
		for entry: Dictionary in Settings.schema_entries():
			if entry["section"] == section:
				var row: Control = SettingWidgets.build_row(entry)
				page.add_child(row)
				if first_control == null:
					first_control = _find_focusable(row)
		var reset_button := Button.new()
		reset_button.text = "Reset %s to defaults" % section
		reset_button.pressed.connect(Settings.reset_section_to_defaults.bind(section))
		page.add_child(reset_button)

	var input_page := VBoxContainer.new()
	input_page.add_theme_constant_override("separation", 6)
	var input_scroll := ScrollContainer.new()
	input_scroll.name = "Input"
	input_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	input_scroll.add_child(input_page)
	input_page.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tabs.add_child(input_scroll)
	var hint := Label.new()
	hint.theme_type_variation = &"MutedLabel"
	hint.text = "Select an action, then press the new key or mouse button. Esc cancels. Rebinding replaces all of an action's bindings."
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	input_page.add_child(hint)
	for action_entry: Dictionary in Settings.INPUT_ACTIONS:
		var row := KeybindRow.new()
		input_page.add_child(row)
		row.setup(action_entry)
	var reset_input := Button.new()
	reset_input.text = "Reset all bindings"
	reset_input.pressed.connect(Settings.reset_input_bindings)
	input_page.add_child(reset_input)

	add_button("Back", func() -> void: back_requested.emit())
	if first_control != null:
		set_default_focus(first_control)


func _find_focusable(root: Node) -> Control:
	for child: Node in root.get_children():
		var control := child as Control
		if control != null and control.focus_mode != Control.FOCUS_NONE:
			return control
		var nested: Control = _find_focusable(child)
		if nested != null:
			return nested
	return null
