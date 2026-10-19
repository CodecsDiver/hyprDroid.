class_name VisualEffects
extends RefCounted
## Procedural placeholder visuals: primitive meshes, flashes and floating text.
## Everything here is cosmetic; no gameplay state depends on it.

const MAX_FLOATING_TEXTS := 48
static var _active_floating_texts: int = 0
## The headless dummy renderer cannot build ArrayMeshes; purely cosmetic code skips them there.
static var _is_headless: bool = DisplayServer.get_name() == "headless"


static func make_material(color: Color, emission_energy: float = 0.0, transparent: bool = false) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.8
	if emission_energy > 0.0:
		material.emission_enabled = true
		material.emission = color
		material.emission_energy_multiplier = emission_energy
	if transparent:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return material


static func make_mesh_instance(mesh: Mesh, color: Color, emission_energy: float = 0.0) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = make_material(color, emission_energy)
	return instance


## Flat disc lying on the floor, fading out. Used for pulses and area markers.
static func flash_disc(parent: Node, world_position: Vector3, radius: float, color: Color, lifetime: float = 0.3) -> void:
	if Settings.get_bool("accessibility/reduce_motion"):
		lifetime = minf(lifetime, 0.15)
	var disc_mesh := CylinderMesh.new()
	disc_mesh.top_radius = radius
	disc_mesh.bottom_radius = radius
	disc_mesh.height = 0.05
	disc_mesh.radial_segments = 32
	var disc := MeshInstance3D.new()
	disc.mesh = disc_mesh
	var material: StandardMaterial3D = make_material(Color(color, 0.55), 0.0, true)
	disc.material_override = material
	parent.add_child(disc)
	disc.global_position = Vector3(world_position.x, 0.08, world_position.z)
	var tween: Tween = disc.create_tween()
	tween.tween_property(material, "albedo_color:a", 0.0, lifetime)
	tween.tween_callback(disc.queue_free)


## Pie-slice flash for melee arcs. `facing` is the (unit) direction on the XZ plane.
static func flash_sector(parent: Node, world_position: Vector3, facing: Vector3, radius: float, arc_degrees: float, color: Color, lifetime: float = 0.18) -> void:
	if _is_headless:
		return
	var half_arc: float = deg_to_rad(arc_degrees) * 0.5
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var segments: int = maxi(int(arc_degrees / 12.0), 3)
	for segment_index: int in segments:
		var angle_a: float = -half_arc + (2.0 * half_arc) * float(segment_index) / float(segments)
		var angle_b: float = -half_arc + (2.0 * half_arc) * float(segment_index + 1) / float(segments)
		surface.add_vertex(Vector3.ZERO)
		surface.add_vertex(Vector3(sin(angle_b), 0.0, -cos(angle_b)) * radius)
		surface.add_vertex(Vector3(sin(angle_a), 0.0, -cos(angle_a)) * radius)
	var sector_mesh: ArrayMesh = surface.commit()
	var instance := MeshInstance3D.new()
	instance.mesh = sector_mesh
	var material: StandardMaterial3D = make_material(Color(color, 0.6), 0.0, true)
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	instance.material_override = material
	parent.add_child(instance)
	instance.global_position = Vector3(world_position.x, 0.1, world_position.z)
	instance.rotation.y = atan2(-facing.x, -facing.z)
	var tween: Tween = instance.create_tween()
	tween.tween_property(material, "albedo_color:a", 0.0, lifetime)
	tween.tween_callback(instance.queue_free)


static func floating_text(parent: Node, world_position: Vector3, text: String, color: Color, font_size: int = 48) -> void:
	if not Settings.get_bool("accessibility/damage_numbers"):
		return
	if _active_floating_texts >= MAX_FLOATING_TEXTS:
		return
	_active_floating_texts += 1
	var label := Label3D.new()
	# Count by tree exit so labels freed along with a restarted session still release their slot.
	label.tree_exited.connect(_release_floating_text_slot)
	label.text = text
	label.font_size = font_size
	label.modulate = color
	label.outline_size = 10
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.pixel_size = 0.01
	parent.add_child(label)
	label.global_position = world_position + Vector3(randf_range(-0.3, 0.3), 1.6, randf_range(-0.3, 0.3))
	var rise: float = 0.0 if Settings.get_bool("accessibility/reduce_motion") else 1.2
	var tween: Tween = label.create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "global_position:y", label.global_position.y + rise, 0.6)
	tween.tween_property(label, "modulate:a", 0.0, 0.6).set_delay(0.2)
	tween.chain().tween_callback(label.queue_free)


static func _release_floating_text_slot() -> void:
	_active_floating_texts = maxi(_active_floating_texts - 1, 0)


## Placeholder body mesh for a singularity, distinct per BodyShape for readable silhouettes.
static func body_mesh_for(shape: SingularityDefinition.BodyShape) -> Mesh:
	match shape:
		SingularityDefinition.BodyShape.BOX:
			var box := BoxMesh.new()
			box.size = Vector3(0.9, 1.6, 0.9)
			return box
		SingularityDefinition.BodyShape.SPHERE:
			var sphere := SphereMesh.new()
			sphere.radius = 0.6
			sphere.height = 1.2
			return sphere
		SingularityDefinition.BodyShape.CYLINDER:
			var cylinder := CylinderMesh.new()
			cylinder.top_radius = 0.5
			cylinder.bottom_radius = 0.5
			cylinder.height = 1.7
			return cylinder
		SingularityDefinition.BodyShape.PRISM:
			var prism := PrismMesh.new()
			prism.size = Vector3(1.0, 1.7, 0.9)
			return prism
		_:
			var capsule := CapsuleMesh.new()
			capsule.radius = 0.45
			capsule.height = 1.8
			return capsule
