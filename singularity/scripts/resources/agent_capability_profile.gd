class_name AgentCapabilityProfile
extends Resource
## What a controller (human, conventional AI, external agent) may see and do.
##
## This is deliberately separate from character combat statistics: agent decision
## quality and mechanical power are balanced independently.

@export var id: StringName = &""
## Entities further than this from the actor are not included in observations.
@export var observation_radius: float = 22.0
@export var max_observed_entities: int = 40
## Minimum seconds between decisions for AI-driven controllers.
@export var decision_interval: float = 0.25
## 0 disables the limit (used for humans and in-engine AI).
@export var max_commands_per_second: float = 0.0
## Allowed command type names, see ActionCommand.Type. Empty means all commands.
@export var allowed_commands: PackedStringArray = PackedStringArray()
@export var may_select_upgrades: bool = true
## Reserved for future memory systems: scopes this agent may read.
@export var memory_scopes: PackedStringArray = PackedStringArray()


func allows_command(command_type_name: String) -> bool:
	return allowed_commands.is_empty() or allowed_commands.has(command_type_name)
