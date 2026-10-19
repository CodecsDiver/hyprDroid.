class_name InventoryScreen
extends MenuScreen
## Read-only overview of the human actor's stats, upgrades, items and equipment.

signal close_requested

var _actor: SingularityActor
var _stats_label: Label
var _upgrades_label: Label
var _items_label: Label
var _equipment_label: Label


func _init() -> void:
	super._init()
	build_panel("Inventory", 900.0)
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 20)
	content.add_child(columns)
	_stats_label = _column(columns, "Stats")
	_upgrades_label = _column(columns, "Upgrades (level-ups)")
	_items_label = _column(columns, "Items and equipment")
	_equipment_label = _items_label
	add_button("Close", func() -> void: close_requested.emit())
	back_requested.connect(func() -> void: close_requested.emit())


func _column(parent: Control, heading: String) -> Label:
	var card := PanelContainer.new()
	card.theme_type_variation = &"CardPanel"
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.custom_minimum_size = Vector2(270.0, 340.0)
	parent.add_child(card)
	var column := VBoxContainer.new()
	card.add_child(column)
	add_label(heading, &"HeaderLabel", column)
	var body := add_label("", &"", column, true)
	return body


func show_for(actor: SingularityActor) -> void:
	_actor = actor
	_refresh()


func _on_shown() -> void:
	_refresh()


func _refresh() -> void:
	if _actor == null or not is_instance_valid(_actor):
		return
	var lines: PackedStringArray = PackedStringArray()
	lines.append("%s - level %d" % [_actor.display_name, _actor.progression.level])
	lines.append("XP %d / %d" % [int(_actor.progression.xp_in_level), int(_actor.progression.xp_to_next_level())])
	lines.append("")
	for stat_name: String in StatIds.all_ids():
		var value: float = _actor.stats.get_value(StringName(stat_name))
		var shown: String = "%d%%" % roundi(value * 100.0) if StatIds.is_percent_stat(StringName(stat_name)) else String.num(value, 2)
		lines.append("%s: %s" % [StatIds.display_name(StringName(stat_name)), shown])
	_stats_label.text = "\n".join(lines)

	var upgrade_lines: PackedStringArray = PackedStringArray()
	for entry: Dictionary in _actor.inventory.owned_upgrades():
		var upgrade: UpgradeDefinition = entry["definition"]
		upgrade_lines.append("%s x%d" % [upgrade.display_name, entry["stacks"]])
	_upgrades_label.text = "\n".join(upgrade_lines) if not upgrade_lines.is_empty() else "None yet."

	var item_lines: PackedStringArray = PackedStringArray()
	for entry: Dictionary in _actor.inventory.owned_items():
		var item: ItemDefinition = entry["definition"]
		item_lines.append("%s x%d\n    %s" % [item.display_name, entry["stacks"], item.describe_effects(entry["stacks"]).replace("\n", "; ")])
	_items_label.text = "\n".join(item_lines) if not item_lines.is_empty() else "No items. Open chests with %s." % Settings.describe_binding("interact")
