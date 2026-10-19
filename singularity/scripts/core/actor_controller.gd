class_name ActorController
extends Node
## Base class for anything that drives an actor. A controller never touches the
## actor directly: it observes via ObservationBuilder and acts via
## RunSession.submit_command(), exactly like a remote agent would.

var session: RunSession
var actor: Combatant
var controller_id: int = -1
var profile: AgentCapabilityProfile


func setup(run_session: RunSession, controlled_actor: Combatant, new_controller_id: int, capability_profile: AgentCapabilityProfile) -> void:
	session = run_session
	actor = controlled_actor
	controller_id = new_controller_id
	profile = capability_profile


func is_active() -> bool:
	return session != null and session.is_run_active() and actor != null and is_instance_valid(actor) and actor.is_alive


func observe() -> Dictionary:
	return ObservationBuilder.build(session, actor, profile)


func send(command: ActionCommand) -> ActionResult:
	return session.submit_command(controller_id, actor.actor_id, command)
