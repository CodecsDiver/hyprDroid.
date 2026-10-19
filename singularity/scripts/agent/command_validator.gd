class_name CommandValidator
extends RefCounted
## Validates a command against the live simulation. Pure checks: this never mutates
## game state. RunSession applies a command only if validation returns accepted.

static func validate(session: RunSession, controller_id: int, actor_id: int, command: ActionCommand, profile: AgentCapabilityProfile) -> ActionResult:
	if not session.is_run_active():
		return ActionResult.reject(ActionResult.RUN_NOT_ACTIVE, "the run has ended")
	var actor: Combatant = session.get_actor(actor_id)
	if actor == null:
		return ActionResult.reject(ActionResult.UNKNOWN_ACTOR, "no actor %d" % actor_id)
	if not actor.is_alive:
		return ActionResult.reject(ActionResult.ACTOR_DEAD)
	if session.get_controller_for_actor(actor_id) != controller_id:
		return ActionResult.reject(ActionResult.NOT_OWNER, "controller %d does not own actor %d" % [controller_id, actor_id])
	if not profile.allows_command(String(command.type_name())):
		return ActionResult.reject(ActionResult.COMMAND_NOT_ALLOWED, "profile '%s' may not issue %s" % [profile.id, command.type_name()])
	if not _within_rate_limit(session, controller_id, profile):
		return ActionResult.reject(ActionResult.RATE_LIMITED)

	match command.type:
		ActionCommand.Type.MOVE:
			if not _is_finite_vector(command.direction):
				return ActionResult.reject(ActionResult.INVALID_PARAMS, "direction must be finite")
		ActionCommand.Type.AIM:
			if not _is_finite_vector(command.point):
				return ActionResult.reject(ActionResult.INVALID_PARAMS, "point must be finite")
		ActionCommand.Type.ATTACK:
			return _validate_attack(session, actor, command)
		ActionCommand.Type.USE_ABILITY:
			return _validate_ability(session, actor, command)
		ActionCommand.Type.INTERACT:
			return _validate_interact(session, actor, command)
		ActionCommand.Type.SELECT_UPGRADE:
			return _validate_upgrade_selection(actor, command, profile)
	return ActionResult.accept()


static func _validate_attack(session: RunSession, actor: Combatant, command: ActionCommand) -> ActionResult:
	if command.has_point and not _is_finite_vector(command.point):
		return ActionResult.reject(ActionResult.INVALID_PARAMS, "point must be finite")
	if command.target_id >= 0:
		var target: Combatant = session.get_actor(command.target_id)
		if target == null or not target.is_alive:
			return ActionResult.reject(ActionResult.NO_TARGET)
		if not TeamIds.are_hostile(actor.team_id, target.team_id):
			return ActionResult.reject(ActionResult.INVALID_PARAMS, "target is not hostile")
	if actor.abilities.is_empty() or not actor.abilities[0].is_ready():
		return ActionResult.reject(ActionResult.ON_COOLDOWN)
	if actor.is_dashing():
		return ActionResult.reject(ActionResult.ON_COOLDOWN, "busy dashing")
	return ActionResult.accept()


static func _validate_ability(session: RunSession, actor: Combatant, command: ActionCommand) -> ActionResult:
	if command.has_point and not _is_finite_vector(command.point):
		return ActionResult.reject(ActionResult.INVALID_PARAMS, "point must be finite")
	if command.target_id >= 0:
		var target: Combatant = session.get_actor(command.target_id)
		if target == null or not target.is_alive:
			return ActionResult.reject(ActionResult.NO_TARGET)
	var ability: AbilityInstance = actor.get_ability_for_slot(command.slot)
	if command.slot < ActionCommand.SLOT_ABILITY_ONE or command.slot > ActionCommand.SLOT_EQUIPMENT:
		return ActionResult.reject(ActionResult.INVALID_PARAMS, "slot must be 1-3")
	if ability == null:
		return ActionResult.reject(ActionResult.NO_SUCH_ABILITY)
	if not ability.is_ready():
		return ActionResult.reject(ActionResult.ON_COOLDOWN)
	if actor.is_dashing():
		return ActionResult.reject(ActionResult.ON_COOLDOWN, "busy dashing")
	return ActionResult.accept()


static func _validate_interact(session: RunSession, actor: Combatant, command: ActionCommand) -> ActionResult:
	var interactable: Node3D = session.get_interactable(command.target_id)
	if interactable == null or not interactable.has_method("can_interact") or not interactable.can_interact(actor):
		return ActionResult.reject(ActionResult.NO_TARGET)
	var distance: float = Vector2(actor.global_position.x - interactable.global_position.x, actor.global_position.z - interactable.global_position.z).length()
	if distance > Balance.config.interact_range:
		return ActionResult.reject(ActionResult.OUT_OF_RANGE, "within %.1f m required" % Balance.config.interact_range)
	return ActionResult.accept()


static func _validate_upgrade_selection(actor: Combatant, command: ActionCommand, profile: AgentCapabilityProfile) -> ActionResult:
	if not profile.may_select_upgrades:
		return ActionResult.reject(ActionResult.COMMAND_NOT_ALLOWED, "profile may not select upgrades")
	var singularity := actor as SingularityActor
	if singularity == null or singularity.progression.pending_choices.is_empty():
		return ActionResult.reject(ActionResult.NO_PENDING_UPGRADE)
	if command.choice_index < 0 or command.choice_index >= singularity.progression.pending_choices.size():
		return ActionResult.reject(ActionResult.BAD_CHOICE, "choice_index out of range")
	return ActionResult.accept()


static func _within_rate_limit(session: RunSession, controller_id: int, profile: AgentCapabilityProfile) -> bool:
	if profile.max_commands_per_second <= 0.0:
		return true
	return session.consume_command_token(controller_id, profile.max_commands_per_second)


static func _is_finite_vector(value: Vector2) -> bool:
	return is_finite(value.x) and is_finite(value.y) and absf(value.x) <= ActionCommand.MAX_COORDINATE and absf(value.y) <= ActionCommand.MAX_COORDINATE
