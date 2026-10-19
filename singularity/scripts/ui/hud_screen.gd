class_name HudScreen
extends Control
## In-run heads-up display. Reads state from the bound RunSession every frame (cheap
## polling for the handful of values shown) and listens to Events for toasts.

const ACTION_FOR_SLOT: Array[String] = ["attack_primary", "ability_one", "ability_two", "use_equipment"]

var _session: RunSession
var _health_bar: ProgressBar
var _xp_bar: ProgressBar
var _level_label: Label
var _name_label: Label
var _timer_label: Label
var _kills_label: Label
var _prompt_label: Label
var _toast_box: VBoxContainer
var _ally_box: VBoxContainer
var _debug_label: Label
var _fps_label: Label
var _slot_widgets: Array[Dictionary] = []
var _ally_widgets: Dictionary = {}
var _debug_visible: bool = false


func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	process_mode = Node.PROCESS_MODE_ALWAYS
	visible = false
	_build()
	Events.notification_posted.connect(_show_toast)


func bind(session: RunSession) -> void:
	_session = session
	_ally_widgets.clear()
	for child: Node in _ally_box.get_children():
		child.queue_free()
	for child: Node in _toast_box.get_children():
		child.queue_free()
	_name_label.text = session.human_actor.display_name


func _build() -> void:
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side: String in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 16)
	add_child(margin)
	var layout := Control.new()
	layout.mouse_filter = Control.MOUSE_FILTER_IGNORE
	margin.add_child(layout)

	# Top-left: vitals.
	var vitals := PanelContainer.new()
	vitals.position = Vector2.ZERO
	vitals.custom_minimum_size = Vector2(330.0, 0.0)
	layout.add_child(vitals)
	var vitals_column := VBoxContainer.new()
	vitals_column.add_theme_constant_override("separation", 6)
	vitals.add_child(vitals_column)
	var name_row := HBoxContainer.new()
	vitals_column.add_child(name_row)
	_name_label = _label("", name_row)
	_name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_level_label = _label("Lv 1", name_row)
	_health_bar = _bar(vitals_column, Color(0.9, 0.3, 0.3), 22.0)
	_xp_bar = _bar(vitals_column, Color(0.35, 0.8, 1.0), 14.0)

	# Top-centre: timer and toasts.
	var top_center := VBoxContainer.new()
	top_center.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	top_center.grow_horizontal = Control.GROW_DIRECTION_BOTH
	top_center.custom_minimum_size = Vector2(420.0, 0.0)
	top_center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layout.add_child(top_center)
	_timer_label = _label("00:00", top_center)
	_timer_label.theme_type_variation = &"TitleLabel"
	_timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast_box = VBoxContainer.new()
	_toast_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top_center.add_child(_toast_box)

	# Top-right: run stats.
	_kills_label = _label("", layout)
	_kills_label.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_kills_label.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_kills_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT

	# Left: allies.
	_ally_box = VBoxContainer.new()
	_ally_box.position = Vector2(0.0, 120.0)
	_ally_box.custom_minimum_size = Vector2(240.0, 0.0)
	_ally_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layout.add_child(_ally_box)

	# Bottom-centre: ability bar and interaction prompt.
	var bottom := VBoxContainer.new()
	bottom.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	bottom.grow_horizontal = Control.GROW_DIRECTION_BOTH
	bottom.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bottom.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layout.add_child(bottom)
	_prompt_label = _label("", bottom)
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var slot_row := HBoxContainer.new()
	slot_row.add_theme_constant_override("separation", 10)
	slot_row.alignment = BoxContainer.ALIGNMENT_CENTER
	slot_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bottom.add_child(slot_row)
	for slot: int in ACTION_FOR_SLOT.size():
		_slot_widgets.append(_build_slot(slot_row))

	_debug_label = _label("", layout)
	_debug_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	_debug_label.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_debug_label.visible = false
	_fps_label = _label("", layout)
	_fps_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	_fps_label.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_fps_label.grow_vertical = Control.GROW_DIRECTION_BEGIN


func _label(text_value: String, parent: Control) -> Label:
	var label := Label.new()
	label.text = text_value
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	return label


func _bar(parent: Control, color: Color, height: float) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(0.0, height)
	bar.show_percentage = false
	bar.max_value = 1.0
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	fill.set_corner_radius_all(3)
	bar.add_theme_stylebox_override("fill", fill)
	parent.add_child(bar)
	return bar


func _build_slot(parent: Control) -> Dictionary:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(136.0, 74.0)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(panel)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 2)
	panel.add_child(column)
	var key_label := _label("", column)
	key_label.theme_type_variation = &"MutedLabel"
	var name_label := _label("", column)
	name_label.add_theme_font_size_override("font_size", 13)
	name_label.clip_text = true
	var cooldown := _bar(column, Color(0.4, 0.4, 0.5), 10.0)
	return {"panel": panel, "key": key_label, "name": name_label, "cooldown": cooldown}


func _process(delta: float) -> void:
	if not visible or _session == null or not is_instance_valid(_session.human_actor):
		return
	var actor: SingularityActor = _session.human_actor
	var maximum_health: float = actor.stats.get_value(StatIds.MAX_HEALTH)
	_health_bar.value = actor.health / maximum_health
	_health_bar.tooltip_text = "%d / %d" % [int(actor.health), int(maximum_health)]
	_xp_bar.value = actor.progression.xp_in_level / maxf(actor.progression.xp_to_next_level(), 1.0)
	_level_label.text = "%d / %d HP   Lv %d" % [ceili(actor.health), int(maximum_health), actor.progression.level]
	_timer_label.text = "%s" % MainMenuScreen.format_time(_session.sim_time)
	_kills_label.text = "Kills %d\nEnemies %d\nVictory at %s" % [_session.kills, _session.living_count(TeamIds.ENEMY), MainMenuScreen.format_time(_session.victory_seconds)]
	_update_slots(actor)
	_update_prompt()
	_update_allies()
	_fps_label.visible = Settings.get_bool("graphics/show_fps")
	if _fps_label.visible:
		_fps_label.text = "%d FPS" % Engine.get_frames_per_second()
	if _debug_visible:
		_debug_label.text = "tick %d  seed %d  gems %d  nav %s\nF2 +50 XP  F3 chest  F4 +60 s  F5 god mode" % [_session.tick_count, _session.run_seed, _session.get_gems().size(), _session.has_navigation()]


func _unhandled_key_input(event: InputEvent) -> void:
	if visible and OS.is_debug_build() and event is InputEventKey and event.pressed and not event.echo and (event as InputEventKey).keycode == KEY_F1:
		_debug_visible = not _debug_visible
		_debug_label.visible = _debug_visible


func _update_slots(actor: SingularityActor) -> void:
	for slot: int in _slot_widgets.size():
		var widget: Dictionary = _slot_widgets[slot]
		var instance: AbilityInstance = actor.abilities[0] if slot == 0 else actor.get_ability_for_slot(slot)
		(widget["key"] as Label).text = Settings.describe_binding(ACTION_FOR_SLOT[slot]).get_slice(" / ", 0)
		var cooldown_bar: ProgressBar = widget["cooldown"]
		if instance == null:
			(widget["name"] as Label).text = "-"
			cooldown_bar.value = 0.0
			(widget["panel"] as Control).modulate = Color(1, 1, 1, 0.4)
			continue
		(widget["panel"] as Control).modulate = Color.WHITE
		(widget["name"] as Label).text = instance.definition.display_name
		var remaining_fraction: float = instance.cooldown_fraction(actor.stats)
		cooldown_bar.value = 1.0 - remaining_fraction
		cooldown_bar.modulate = Color(0.5, 1.0, 0.6) if instance.is_ready() else Color(0.7, 0.7, 0.8)


func _update_prompt() -> void:
	var controller := _session.get_controller(RunSession.FIRST_PLAYER_CONTROLLER_ID) as HumanController
	var chest: Node3D = controller.nearest_interactable() if controller != null else null
	_prompt_label.text = "[%s] Open chest" % Settings.describe_binding("interact").get_slice(" / ", 0) if chest != null else ""
	if controller != null and controller.is_tactical() and chest == null:
		_prompt_label.text = "TACTICAL OVERVIEW  -  1 Follow   2 Hold   3 Aggressive   (%s to exit)" % Settings.describe_binding("toggle_tactical")


func _update_allies() -> void:
	var seen: Dictionary = {}
	for combatant: Combatant in _session.get_living_team(TeamIds.PLAYER):
		if combatant == _session.human_actor:
			continue
		seen[combatant.actor_id] = true
		if not _ally_widgets.has(combatant.actor_id):
			var holder := VBoxContainer.new()
			var title := _label(combatant.display_name, holder)
			title.add_theme_font_size_override("font_size", 14)
			var bar := _bar(holder, Color(0.3, 0.9, 0.5), 10.0)
			_ally_box.add_child(holder)
			_ally_widgets[combatant.actor_id] = {"holder": holder, "bar": bar, "title": title}
		var widgets: Dictionary = _ally_widgets[combatant.actor_id]
		(widgets["bar"] as ProgressBar).value = combatant.health_fraction()
		(widgets["title"] as Label).text = "%s  Lv %d" % [combatant.display_name, (combatant as SingularityActor).progression.level]
	for actor_id: int in _ally_widgets.keys():
		if not seen.has(actor_id):
			((_ally_widgets[actor_id] as Dictionary)["holder"] as Node).queue_free()
			_ally_widgets.erase(actor_id)


func _show_toast(message: String, color: Color) -> void:
	if _toast_box == null:
		return
	var toast := Label.new()
	toast.text = message
	toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast.add_theme_color_override("font_color", color)
	toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast_box.add_child(toast)
	while _toast_box.get_child_count() > 5:
		_toast_box.get_child(0).queue_free()
		_toast_box.remove_child(_toast_box.get_child(0))
	var tween: Tween = toast.create_tween()
	tween.tween_interval(3.5)
	tween.tween_property(toast, "modulate:a", 0.0, 0.8)
	tween.tween_callback(toast.queue_free)
