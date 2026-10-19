class_name MapBuilder
extends Node3D
## Builds a laboratory from a MapLayout and its ModuleLibrary, then bakes navigation.
##
## Returns a dictionary with:
##   bounds        Rect2 of the playable floor on the XZ plane
##   player_starts Array[Vector3]
##   enemy_spawns  Array[Vector3]

const MARKER_PREFIX := "marker:"
const MARKER_PLAYER_START := "marker:player_start"
const MARKER_ENEMY_SPAWN := "marker:enemy_spawn"

var _navigation_region: NavigationRegion3D


func build(layout: MapLayout, session: RunSession) -> Dictionary:
	var library: ModuleLibrary = layout.module_library
	var player_starts: Array[Vector3] = []
	var enemy_spawns: Array[Vector3] = []
	if library == null:
		push_error("MapBuilder: layout '%s' has no module library." % layout.map_id)
		return {"bounds": Rect2(-20, -20, 40, 40), "player_starts": player_starts, "enemy_spawns": enemy_spawns}

	_navigation_region = NavigationRegion3D.new()
	_navigation_region.name = "NavigationRegion"
	add_child(_navigation_region)

	var cell: float = layout.cell_size
	var width: int = layout.grid_width()
	var height: int = layout.grid_height()
	var origin := Vector3(-(width - 1) * cell * 0.5, 0.0, -(height - 1) * cell * 0.5)
	var floor_scene: PackedScene = library.get_scene(layout.floor_module_id)

	for row_index: int in height:
		var row_text: String = layout.rows[row_index]
		for column_index: int in row_text.length():
			var symbol: String = row_text[column_index]
			if symbol == " ":
				continue
			var cell_position: Vector3 = origin + Vector3(column_index * cell, 0.0, row_index * cell)
			if floor_scene != null:
				_place(floor_scene, cell_position, session)
			if symbol == ".":
				continue
			var module_id: String = String(layout.legend.get(symbol, ""))
			if module_id.is_empty():
				push_warning("MapBuilder: symbol '%s' at (%d, %d) is not in the legend." % [symbol, column_index, row_index])
				continue
			if module_id == MARKER_PLAYER_START:
				player_starts.append(cell_position)
			elif module_id == MARKER_ENEMY_SPAWN:
				enemy_spawns.append(cell_position)
			else:
				var scene: PackedScene = library.get_scene(StringName(module_id))
				if scene != null:
					_place(scene, cell_position, session)

	_build_environment()
	_bake_navigation(layout, origin)
	var bounds := Rect2(origin.x - cell * 0.5, origin.z - cell * 0.5, width * cell, height * cell)
	return {"bounds": bounds, "player_starts": player_starts, "enemy_spawns": enemy_spawns}


func get_navigation_map() -> RID:
	return _navigation_region.get_navigation_map() if _navigation_region != null else RID()


func _place(scene: PackedScene, world_position: Vector3, session: RunSession) -> void:
	var instance: Node = scene.instantiate()
	_navigation_region.add_child(instance)
	if instance is Node3D:
		(instance as Node3D).global_position = world_position
	if instance.has_method("register_with_session"):
		instance.register_with_session(session)


## Bakes the navigation mesh from the layout grid rather than from rendered or
## collision geometry, so it works identically with placeholder primitives, Blender
## assets and the headless renderer. Walkable cells contribute a floor quad;
## cells whose symbol is in `blocking_symbols` leave a hole. Agent radius erosion
## then keeps paths clear of walls.
func _bake_navigation(layout: MapLayout, origin: Vector3) -> void:
	var cell: float = layout.cell_size
	var half: float = cell * 0.5
	var triangles := PackedVector3Array()
	for row_index: int in layout.grid_height():
		var row_text: String = layout.rows[row_index]
		for column_index: int in row_text.length():
			var symbol: String = row_text[column_index]
			if symbol == " " or layout.blocking_symbols.contains(symbol):
				continue
			var center: Vector3 = origin + Vector3(column_index * cell, 0.0, row_index * cell)
			var corner_a := Vector3(center.x - half, 0.0, center.z - half)
			var corner_b := Vector3(center.x + half, 0.0, center.z - half)
			var corner_c := Vector3(center.x + half, 0.0, center.z + half)
			var corner_d := Vector3(center.x - half, 0.0, center.z + half)
			triangles.append_array([corner_a, corner_b, corner_c, corner_a, corner_c, corner_d])
	var source_geometry := NavigationMeshSourceGeometryData3D.new()
	source_geometry.add_faces(triangles, Transform3D.IDENTITY)
	var navigation_mesh := NavigationMesh.new()
	navigation_mesh.cell_size = 0.25
	navigation_mesh.cell_height = 0.25
	navigation_mesh.agent_radius = 0.5
	navigation_mesh.agent_height = 1.75
	navigation_mesh.agent_max_climb = 0.25
	NavigationServer3D.bake_from_source_geometry_data(navigation_mesh, source_geometry)
	_navigation_region.navigation_mesh = navigation_mesh


func _build_environment() -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.04, 0.05, 0.07)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.55, 0.62, 0.72)
	environment.ambient_light_energy = 0.45
	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-58.0, 30.0, 0.0)
	sun.light_energy = 0.85
	sun.shadow_enabled = Settings.get_bool("graphics/shadows")
	sun.add_to_group("main_light")
	add_child(sun)
	Events.settings_changed.connect(_on_settings_changed.bind(sun))


func _on_settings_changed(setting_id: StringName, sun: DirectionalLight3D) -> void:
	if setting_id == &"graphics/shadows" and is_instance_valid(sun):
		sun.shadow_enabled = Settings.get_bool("graphics/shadows")
