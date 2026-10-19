extends Node
## Prints one real observation (as JSON) from a short simulated run, for agent
## developers. Run:
##
##   godot --headless --path . --fixed-fps 60 res://tools/dump_observation.tscn

func _ready() -> void:
	Telemetry.write_reports_to_disk = false
	Profile.persistence_enabled = false
	GameState.current_state = GameState.State.PLAYING
	var config := RunConfig.new()
	config.character_id = &"c_lo_d"
	config.ally_character_ids = [&"hell_eater"]
	config.random_seed = 12345
	var session := RunSession.new()
	add_child(session)
	session.initialize(config)
	var agent_actor: SingularityActor = session._spawn_singularity(Catalog.get_character(&"binaural_sphere"), 77, false, session.human_actor.global_position + Vector3(2.0, 0.0, 2.0))
	var external := ExternalAgentController.new()
	session.attach_controller(external, agent_actor, 77, Catalog.get_agent_profile(&"external_default"))
	for frame: int in 60 * 25:
		await get_tree().physics_frame
	agent_actor.gain_xp(40.0)
	print(JSON.stringify(external.get_observation(), "  "))
	print("--- result of a valid command:")
	print(JSON.stringify(external.submit_command_dict({"type": "move", "direction": [1, 0]})))
	print("--- result of an invalid command:")
	print(JSON.stringify(external.submit_command_dict({"type": "use_ability", "slot": 7})))
	get_tree().quit()
