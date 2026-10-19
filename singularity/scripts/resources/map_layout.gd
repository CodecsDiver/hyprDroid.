class_name MapLayout
extends Resource
## ASCII-grid description of a laboratory map built from modular pieces.
## Each character in `rows` maps through `legend` to a module id in a ModuleLibrary.
## A space is void (no tile). Every non-void cell receives a floor module underneath.

@export var map_id: StringName = &""
@export var display_name: String = ""
@export_multiline var incident_summary: String = ""
@export var cell_size: float = 4.0
@export var rows: PackedStringArray = PackedStringArray()
## Character (String) -> module id (String). The "." key is the bare-floor cell.
@export var legend: Dictionary = {}
## Symbols whose cells are solid obstacles; they leave holes in the navigation mesh.
@export var blocking_symbols: String = ""
@export var floor_module_id: StringName = &"floor_tile"
@export var module_library: ModuleLibrary


func grid_width() -> int:
	var width: int = 0
	for row: String in rows:
		width = maxi(width, row.length())
	return width


func grid_height() -> int:
	return rows.size()
