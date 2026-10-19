class_name MainMenuScreen
extends MenuScreen

signal play_requested
signal settings_requested
signal quit_requested

var _stats_label: Label


func _init() -> void:
	super._init()
	build_panel("SINGULARITY", 520.0)
	add_label("GLOBAL OPERATIONS", &"HeaderLabel").horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_label("Competition for planetary authority has begun.", &"MutedLabel", null, true).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_separator()
	add_button("Play", func() -> void: play_requested.emit())
	add_button("Settings", func() -> void: settings_requested.emit())
	add_button("Quit", func() -> void: quit_requested.emit())
	add_separator()
	_stats_label = add_label("", &"MutedLabel", null, true)
	_stats_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER


func _on_shown() -> void:
	if Profile.runs_played > 0:
		_stats_label.text = "Runs: %d   Victories: %d   Best survival: %s   Best level: %d" % [Profile.runs_played, Profile.victories, format_time(Profile.best_survival_seconds), Profile.best_level]
	else:
		_stats_label.text = "Prototype build. WASD move, mouse aims, see Settings > Input for all controls."


static func format_time(total_seconds: float) -> String:
	var whole_seconds: int = int(total_seconds)
	return "%02d:%02d" % [whole_seconds / 60, whole_seconds % 60]


func _unhandled_input(_event: InputEvent) -> void:
	pass # The main menu is the root; Escape does nothing here.
