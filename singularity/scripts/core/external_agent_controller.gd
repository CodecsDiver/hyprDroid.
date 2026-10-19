class_name ExternalAgentController
extends ActorController
## Stub for future out-of-process agents (LAN, MCP). It exposes exactly the two
## calls such an agent needs: get_observation() and submit_command_dict().
## No networking is implemented here by design.

func get_observation() -> Dictionary:
	if not is_active():
		return {"schema_version": ObservationBuilder.SCHEMA_VERSION, "run_active": false}
	return observe()


func submit_command_dict(command_data: Variant) -> Dictionary:
	if session == null or actor == null:
		return ActionResult.reject(ActionResult.UNKNOWN_ACTOR).to_dict()
	return session.submit_command_dict(controller_id, actor.actor_id, command_data).to_dict()
