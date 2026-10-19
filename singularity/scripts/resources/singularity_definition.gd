class_name SingularityDefinition
extends Resource
## Data-driven definition of one playable singularity.

enum KitStatus { IMPLEMENTED, PLACEHOLDER, UNDEFINED }
enum BodyShape { CAPSULE, BOX, SPHERE, CYLINDER, PRISM }

@export var id: StringName = &""
@export var display_name: String = ""
@export var tagline: String = ""
@export_multiline var philosophy: String = ""
@export var color: Color = Color(0.3, 0.8, 1.0)
@export var body_shape: BodyShape = BodyShape.CAPSULE
@export var kit_status: KitStatus = KitStatus.PLACEHOLDER
## Overrides for StatIds.DEFAULTS, keyed by stat name (String).
@export var base_stats: Dictionary = {}
@export var primary_ability: AbilityDefinition
@export var ability_one: AbilityDefinition
@export var ability_two: AbilityDefinition
@export_group("Tactical preferences")
## Distance this singularity prefers to fight from, in metres.
@export var preferred_range: float = 6.0
## 0 = cautious, 1 = reckless. Scales how readily the conventional AI engages.
@export_range(0.0, 1.0) var aggression: float = 0.5
@export_range(0.0, 1.0) var retreat_health_fraction: float = 0.25
## Enemies within ability range before the AI spends a cooldown ability.
@export var ability_use_enemy_count: int = 2
@export_group("Agent")
## Capability profile (observation radius, decision rate, allowed commands) when AI-driven.
@export var agent_profile_id: StringName = &"conventional_ai"


func kit_status_label() -> String:
	match kit_status:
		KitStatus.IMPLEMENTED:
			return "Kit implemented"
		KitStatus.PLACEHOLDER:
			return "Placeholder kit"
		_:
			return "Identity undefined"
