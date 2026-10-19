class_name HumanController
extends ActorController
## Translates keyboard and mouse input into commands for the human's singularity.
## It uses the same gateway as AI and external agents; it has no special powers.

var _tactical_active: bool = false
var _last_aim_point: Vector2 = Vector2.ZERO


func _physics_process(_delta: float) -> void:
	if not is_active():
		return
	var move_input: Vector2 = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var world_move: Vector3 = Basis(Vector3.UP, session.camera_rig.yaw_radians()) * Vector3(move_input.x, 0.0, move_input.y)
	send(ActionCommand.move(Vector2(world_move.x, world_move.z)))

	var aim_point: Variant = _read_aim_point()
	if aim_point != null:
		_last_aim_point = aim_point
		send(ActionCommand.aim(_last_aim_point))

	var primary: AbilityInstance = actor.abilities[0]
	var wants_attack: bool = Input.is_action_pressed("attack_primary")
	var auto_target: Combatant = null
	if not wants_attack and Settings.get_bool("gameplay/auto_attack") and primary.is_ready():
		auto_target = session.get_nearest_hostile(actor.global_position, maxf(primary.definition.reach, 6.0), actor.team_id)
	if primary.is_ready() and (wants_attack or auto_target != null):
		if auto_target != null:
			send(ActionCommand.attack(auto_target.actor_id))
		else:
			send(ActionCommand.attack(-1, _last_aim_point))

	if Input.is_action_just_pressed("ability_one"):
		send(ActionCommand.use_ability(ActionCommand.SLOT_ABILITY_ONE, -1, _last_aim_point))
	if Input.is_action_just_pressed("ability_two"):
		send(ActionCommand.use_ability(ActionCommand.SLOT_ABILITY_TWO, -1, _last_aim_point))
	if Input.is_action_just_pressed("use_equipment"):
		send(ActionCommand.use_ability(ActionCommand.SLOT_EQUIPMENT, -1, _last_aim_point))
	if Input.is_action_just_pressed("interact"):
		var interactable: Node3D = nearest_interactable()
		if interactable != null:
			send(ActionCommand.interact(interactable.get("interactable_id")))


func _unhandled_input(event: InputEvent) -> void:
	if not is_active():
		return
	if event.is_action_pressed("toggle_tactical"):
		set_tactical(not _tactical_active)
	elif _tactical_active and event is InputEventKey and event.pressed and not event.echo:
		var stance_index: int = (event as InputEventKey).keycode - KEY_1
		if stance_index >= 0 and stance_index < ConventionalAIController.Stance.size():
			_command_allies(stance_index as ConventionalAIController.Stance)


func set_tactical(enabled: bool) -> void:
	_tactical_active = enabled
	session.camera_rig.set_tactical(enabled)
	Engine.time_scale = Balance.config.tactical_time_scale if enabled else 1.0
	Events.tactical_mode_changed.emit(enabled)
	if enabled:
		Events.notification_posted.emit("Tactical overview: 1 = Follow, 2 = Hold, 3 = Aggressive", Color(0.6, 0.9, 1.0))


func is_tactical() -> bool:
	return _tactical_active


func _command_allies(stance: ConventionalAIController.Stance) -> void:
	for ally_controller_id: int in session.get_controller_ids():
		var ally_controller := session.get_controller(ally_controller_id) as ConventionalAIController
		if ally_controller != null:
			ally_controller.stance = stance
	Events.notification_posted.emit("Allies: %s" % ConventionalAIController.Stance.keys()[stance].capitalize(), Color(0.6, 0.9, 1.0))


## Nearest interactable inside interact range, or null.
func nearest_interactable() -> Node3D:
	var best: Node3D = null
	var best_distance: float = Balance.config.interact_range
	for node: Node3D in session.get_interactables():
		if not node.has_method("can_interact") or not node.can_interact(actor):
			continue
		var distance: float = Vector2(actor.global_position.x - node.global_position.x, actor.global_position.z - node.global_position.z).length()
		if distance <= best_distance:
			best_distance = distance
			best = node
	return best


func _read_aim_point() -> Variant:
	if DisplayServer.get_name() == "headless":
		return null
	var viewport := get_viewport()
	if viewport == null or not viewport.get_visible_rect().has_point(viewport.get_mouse_position()):
		return null
	var ground_hit: Variant = session.camera_rig.project_mouse_to_ground(viewport.get_mouse_position())
	if ground_hit == null:
		return null
	var hit_point: Vector3 = ground_hit
	return Vector2(hit_point.x, hit_point.z)
