class_name PauseScreen
extends MenuScreen

signal resume_requested
signal inventory_requested
signal settings_requested
signal restart_requested
signal main_menu_requested


func _init() -> void:
	super._init()
	build_panel("Paused", 460.0)
	add_button("Resume", func() -> void: resume_requested.emit())
	add_button("Inventory", func() -> void: inventory_requested.emit())
	add_button("Settings", func() -> void: settings_requested.emit())
	add_button("Restart run", func() -> void: restart_requested.emit())
	add_button("Quit to main menu", func() -> void: main_menu_requested.emit())
