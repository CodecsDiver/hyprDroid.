class_name CharacterSelectScreen
extends MenuScreen
## Pick a singularity and up to two AI-controlled allies, then start the run.

signal start_requested(config: RunConfig)

var _selected_id: StringName = &""
var _roster_buttons: Dictionary = {}
var _name_label: Label
var _tagline_label: Label
var _philosophy_label: Label
var _status_label: Label
var _kit_label: Label
var _stats_label: Label
var _ally_dropdowns: Array[OptionButton] = []
var _swatch: ColorRect


func _init() -> void:
	super._init()
	build_panel("Choose your Singularity", 1040.0)
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 20)
	content.add_child(columns)

	var roster_scroll := ScrollContainer.new()
	roster_scroll.custom_minimum_size = Vector2(300.0, 400.0)
	roster_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	columns.add_child(roster_scroll)
	var roster := VBoxContainer.new()
	roster.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	roster.add_theme_constant_override("separation", 6)
	roster_scroll.add_child(roster)
	for character_id: StringName in Catalog.character_order:
		var definition: SingularityDefinition = Catalog.get_character(character_id)
		var button := Button.new()
		button.text = definition.display_name
		button.toggle_mode = true
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.custom_minimum_size = Vector2(0.0, 40.0)
		button.pressed.connect(_select.bind(character_id))
		button.focus_entered.connect(_select.bind(character_id))
		roster.add_child(button)
		_roster_buttons[String(character_id)] = button
		if _default_focus_missing():
			set_default_focus(button)

	var details_card := PanelContainer.new()
	details_card.theme_type_variation = &"CardPanel"
	details_card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	columns.add_child(details_card)
	var details := VBoxContainer.new()
	details.add_theme_constant_override("separation", 8)
	details_card.add_child(details)
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 12)
	details.add_child(header)
	_swatch = ColorRect.new()
	_swatch.custom_minimum_size = Vector2(28.0, 28.0)
	header.add_child(_swatch)
	_name_label = add_label("", &"HeaderLabel", header)
	_tagline_label = add_label("", &"", details, true)
	_philosophy_label = add_label("", &"MutedLabel", details, true)
	_status_label = add_label("", &"MutedLabel", details)
	add_separator(details)
	_kit_label = add_label("", &"", details)
	add_separator(details)
	_stats_label = add_label("", &"MutedLabel", details, true)

	add_separator()
	var ally_row := HBoxContainer.new()
	ally_row.add_theme_constant_override("separation", 12)
	content.add_child(ally_row)
	add_label("AI allies:", &"", ally_row)
	for slot: int in 2:
		var dropdown := OptionButton.new()
		dropdown.focus_mode = Control.FOCUS_ALL
		dropdown.custom_minimum_size = Vector2(220.0, 0.0)
		dropdown.add_item("None")
		for character_id: StringName in Catalog.character_order:
			dropdown.add_item(Catalog.get_character(character_id).display_name)
		ally_row.add_child(dropdown)
		_ally_dropdowns.append(dropdown)

	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 12)
	content.add_child(buttons)
	var back_button := add_button("Back", func() -> void: back_requested.emit(), buttons)
	back_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var start_button := add_button("Start run", _on_start_pressed, buttons)
	start_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL


func _default_focus_missing() -> bool:
	return _default_focus == null


func _on_shown() -> void:
	var remembered: StringName = StringName(Profile.last_character_id)
	if not Catalog.characters.has(String(remembered)):
		remembered = Catalog.character_order[0]
	_select(remembered)
	set_default_focus(_roster_buttons[String(remembered)])
	for slot: int in _ally_dropdowns.size():
		var dropdown: OptionButton = _ally_dropdowns[slot]
		dropdown.select(0)
		if slot < Profile.last_ally_ids.size():
			var index: int = Catalog.character_order.find(StringName(Profile.last_ally_ids[slot]))
			if index >= 0:
				dropdown.select(index + 1)


func _select(character_id: StringName) -> void:
	_selected_id = character_id
	for key: String in _roster_buttons.keys():
		(_roster_buttons[key] as Button).set_pressed_no_signal(key == String(character_id))
	var definition: SingularityDefinition = Catalog.get_character(character_id)
	if definition == null:
		return
	_swatch.color = definition.color
	_name_label.text = definition.display_name
	_tagline_label.text = definition.tagline
	_philosophy_label.text = definition.philosophy
	_status_label.text = definition.kit_status_label()
	_kit_label.text = "Primary: %s\nAbility 1: %s (%.0fs)\nAbility 2: %s (%.0fs)" % [
		definition.primary_ability.display_name,
		definition.ability_one.display_name, definition.ability_one.cooldown,
		definition.ability_two.display_name, definition.ability_two.cooldown,
	]
	var health: float = float(definition.base_stats.get("max_health", StatIds.default_value(StatIds.MAX_HEALTH)))
	var speed: float = float(definition.base_stats.get("move_speed", StatIds.default_value(StatIds.MOVE_SPEED)))
	_stats_label.text = "Health %d   Speed %.1f   Preferred range %.0f m   Aggression %d%%" % [health, speed, definition.preferred_range, int(definition.aggression * 100.0)]


func _on_start_pressed() -> void:
	var config := RunConfig.new()
	config.character_id = _selected_id
	for dropdown: OptionButton in _ally_dropdowns:
		if dropdown.selected > 0:
			config.ally_character_ids.append(Catalog.character_order[dropdown.selected - 1])
	start_requested.emit(config)
