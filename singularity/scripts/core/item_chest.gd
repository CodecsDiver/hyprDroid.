class_name ItemChest
extends Node3D
## Interactable container granting one random item. Placed by map layouts or
## dropped by elite enemies. Registered with the RunSession so agents can address
## it by id through INTERACT commands.

var interactable_id: int = -1
var is_opened: bool = false
var _session: RunSession
var _lid_material: StandardMaterial3D


func _ready() -> void:
	# Placeholder visuals are built here so the module scene can be a bare script node.
	if get_child_count() == 0:
		var body_mesh := BoxMesh.new()
		body_mesh.size = Vector3(1.4, 0.9, 0.9)
		var body := VisualEffects.make_mesh_instance(body_mesh, Color(0.55, 0.42, 0.2))
		body.position.y = 0.45
		add_child(body)
		var lid_mesh := BoxMesh.new()
		lid_mesh.size = Vector3(1.5, 0.25, 1.0)
		var lid := VisualEffects.make_mesh_instance(lid_mesh, Color(1.0, 0.8, 0.3), 0.8)
		lid.position.y = 1.0
		_lid_material = lid.material_override
		add_child(lid)


func register_with_session(run_session: RunSession) -> void:
	_session = run_session
	interactable_id = run_session.register_interactable(self)


func can_interact(actor: Combatant) -> bool:
	return not is_opened and actor is SingularityActor and actor.is_alive


## Opens the chest and grants an item. Returns the item, or null if not allowed.
func interact(actor: Combatant) -> ItemDefinition:
	if not can_interact(actor):
		return null
	var item: ItemDefinition = UpgradeRoller.roll_chest_item(_session.rng_loot)
	if item == null:
		push_warning("ItemChest: no items available in the catalog.")
		return null
	var singularity := actor as SingularityActor
	var stacks: int = singularity.acquire_item(item)
	if stacks <= 0:
		# Item was at its stack limit; the chest stays closed so the player can try again later.
		return null
	is_opened = true
	if _lid_material != null:
		_lid_material.albedo_color = Color(0.3, 0.3, 0.3)
		_lid_material.emission_enabled = false
	var message: String = "%s acquired: %s%s" % [actor.display_name, item.display_name, " x%d" % stacks if stacks > 1 else ""]
	Events.notification_posted.emit(message, Rarity.color(item.rarity))
	VisualEffects.floating_text(_session.effects_root, global_position, item.display_name, Rarity.color(item.rarity), 56)
	return item
