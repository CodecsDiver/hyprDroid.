class_name SettingWidgets
extends RefCounted
## Factory for settings rows. Each row binds one Settings schema entry to a control
## and keeps itself in sync if the setting changes elsewhere (e.g. "reset").

static func build_row(entry: Dictionary) -> Control:
	var setting_id: String = entry["id"]
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	var label := Label.new()
	label.text = entry["label"]
	label.custom_minimum_size = Vector2(280.0, 0.0)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label)
	match String(entry["kind"]):
		"slider":
			row.add_child(_slider(entry, setting_id))
		"toggle":
			row.add_child(_toggle(setting_id))
		"option":
			row.add_child(_option(entry, setting_id))
	return row


static func _slider(entry: Dictionary, setting_id: String) -> Control:
	var holder := HBoxContainer.new()
	holder.add_theme_constant_override("separation", 10)
	var slider := HSlider.new()
	slider.min_value = entry["min"]
	slider.max_value = entry["max"]
	slider.step = entry["step"]
	slider.custom_minimum_size = Vector2(220.0, 28.0)
	slider.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	slider.focus_mode = Control.FOCUS_ALL
	slider.value = Settings.get_float(setting_id)
	var value_label := Label.new()
	value_label.custom_minimum_size = Vector2(60.0, 0.0)
	var suffix: String = entry.get("suffix", "")
	value_label.text = "%d%s" % [int(slider.value), suffix]
	slider.value_changed.connect(func(new_value: float) -> void:
		Settings.set_value(setting_id, new_value)
		value_label.text = "%d%s" % [int(new_value), suffix])
	Events.settings_changed.connect(func(changed_id: StringName) -> void:
		if is_instance_valid(slider) and String(changed_id) == setting_id and not is_equal_approx(slider.value, Settings.get_float(setting_id)):
			slider.set_value_no_signal(Settings.get_float(setting_id))
			value_label.text = "%d%s" % [int(slider.value), suffix])
	holder.add_child(slider)
	holder.add_child(value_label)
	return holder


static func _toggle(setting_id: String) -> Control:
	var check := CheckButton.new()
	check.focus_mode = Control.FOCUS_ALL
	check.button_pressed = Settings.get_bool(setting_id)
	check.toggled.connect(func(pressed: bool) -> void: Settings.set_value(setting_id, pressed))
	Events.settings_changed.connect(func(changed_id: StringName) -> void:
		if is_instance_valid(check) and String(changed_id) == setting_id:
			check.set_pressed_no_signal(Settings.get_bool(setting_id)))
	return check


static func _option(entry: Dictionary, setting_id: String) -> Control:
	var dropdown := OptionButton.new()
	dropdown.focus_mode = Control.FOCUS_ALL
	dropdown.custom_minimum_size = Vector2(240.0, 0.0)
	for option_label: String in entry["labels"]:
		dropdown.add_item(option_label)
	dropdown.select(Settings.get_int(setting_id))
	dropdown.item_selected.connect(func(index: int) -> void: Settings.set_value(setting_id, index))
	Events.settings_changed.connect(func(changed_id: StringName) -> void:
		if is_instance_valid(dropdown) and String(changed_id) == setting_id:
			dropdown.select(Settings.get_int(setting_id)))
	return dropdown
