class_name LevelUpScreen
extends MenuScreen
## Presents the pending upgrade choices. Keys 1-3 pick directly; arrows/Tab and
## Enter work too. Emits the chosen index; the caller issues the command.

signal choice_selected(index: int)

var _cards_row: HBoxContainer
var _subtitle: Label
var _choice_buttons: Array[Button] = []


func _init() -> void:
	super._init()
	build_panel("LEVEL UP", 980.0)
	_subtitle = add_label("", &"HeaderLabel")
	_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_cards_row = HBoxContainer.new()
	_cards_row.add_theme_constant_override("separation", 16)
	_cards_row.alignment = BoxContainer.ALIGNMENT_CENTER
	content.add_child(_cards_row)
	add_label("Press 1, 2 or 3, or use the arrow keys and Enter.", &"MutedLabel", null, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER


func show_choices(actor: SingularityActor) -> void:
	for child: Node in _cards_row.get_children():
		child.queue_free()
	_choice_buttons.clear()
	var queued: int = actor.progression.pending_level_ups
	_subtitle.text = "Level %d reached%s" % [actor.progression.level, "  (%d more queued)" % (queued - 1) if queued > 1 else ""]
	for index: int in actor.progression.pending_choices.size():
		var upgrade: UpgradeDefinition = actor.progression.pending_choices[index]
		var owned: int = actor.inventory.get_upgrade_stacks(upgrade.id)
		var button := Button.new()
		button.custom_minimum_size = Vector2(290.0, 290.0)
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.clip_text = false
		var stack_text: String = "Owned: %d%s" % [owned, "/%d" % upgrade.max_stacks if upgrade.max_stacks > 0 else ""] if owned > 0 else "New"
		button.text = "[%d] %s\n%s  -  %s\n\n%s\n\n%s" % [index + 1, upgrade.display_name, Rarity.display_name(upgrade.rarity), stack_text, upgrade.describe_effects(), upgrade.description]
		button.add_theme_color_override("font_color", Rarity.color(upgrade.rarity))
		button.add_theme_color_override("font_hover_color", Rarity.color(upgrade.rarity).lightened(0.3))
		button.add_theme_color_override("font_focus_color", Rarity.color(upgrade.rarity).lightened(0.3))
		button.pressed.connect(func() -> void: choice_selected.emit(index))
		_cards_row.add_child(button)
		_choice_buttons.append(button)
	if not _choice_buttons.is_empty():
		set_default_focus(_choice_buttons[0])
		focus_default.call_deferred()


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		var slot: int = (event as InputEventKey).keycode - KEY_1
		if slot >= 0 and slot < _choice_buttons.size():
			get_viewport().set_input_as_handled()
			choice_selected.emit(slot)
	# Escape intentionally does nothing: a level-up must be resolved.
