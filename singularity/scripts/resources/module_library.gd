class_name ModuleLibrary
extends Resource
## Maps module ids to scenes. To swap placeholder geometry for Blender assets,
## repoint entries here; map layouts reference ids only.
##
## Module contract (see docs/MODULE_SPEC.md): one grid cell footprint of
## `cell_size` metres, origin at the centre of the cell on the floor surface (y = 0),
## collision on layer 1 ("world"), forward axis -Z.

@export var module_scene_paths: Dictionary = {}


func get_scene(module_id: StringName) -> PackedScene:
	var scene_path: String = String(module_scene_paths.get(String(module_id), ""))
	if scene_path.is_empty():
		push_error("ModuleLibrary: unknown module id '%s'." % module_id)
		return null
	return load(scene_path) as PackedScene
