class_name RunEndScreen
extends MenuScreen

signal restart_requested
signal character_select_requested
signal main_menu_requested

var _summary_label: Label
var _build_label: Label


func _init() -> void:
	super._init()
	build_panel("Run complete", 640.0)
	_summary_label = add_label("", &"", null, true)
	_build_label = add_label("", &"MutedLabel", null, true)
	add_separator()
	add_button("Restart", func() -> void: restart_requested.emit())
	add_button("Character select", func() -> void: character_select_requested.emit())
	add_button("Main menu", func() -> void: main_menu_requested.emit())


func show_summary(summary: Dictionary) -> void:
	var won: bool = StringName(summary.get("outcome", &"")) == &"victory"
	set_title("VICTORY" if won else "DEFEAT")
	_summary_label.text = "%s\nSurvived %s   Level %d   Kills %d   Total XP %d" % [
		summary.get("character", "?"),
		MainMenuScreen.format_time(float(summary.get("survival_seconds", 0.0))),
		int(summary.get("level", 1)), int(summary.get("kills", 0)), int(summary.get("total_xp", 0.0)),
	]
	var upgrades: Array = summary.get("upgrades", [])
	var items: Array = summary.get("items", [])
	_build_label.text = "Upgrades: %s\nItems: %s\nSeed: %s" % [
		", ".join(PackedStringArray(upgrades)) if not upgrades.is_empty() else "none",
		", ".join(PackedStringArray(items)) if not items.is_empty() else "none",
		summary.get("seed", 0),
	]


func _unhandled_input(_event: InputEvent) -> void:
	pass # Escape does not dismiss the results.
