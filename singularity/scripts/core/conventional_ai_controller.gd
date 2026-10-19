class_name ConventionalAIController
extends ActorController
## Rule-based controller for AI-driven singularities (allies). It decides from the
## same observation dictionary and acts through the same command gateway that an
## external language-model agent would use. Decision rate comes from the
## AgentCapabilityProfile; tactical flavour comes from the SingularityDefinition.

enum Stance { FOLLOW, HOLD, AGGRESSIVE }

const GEM_CHASE_DISTANCE := 12.0
const FOLLOW_DISTANCE := 5.0

var stance: Stance = Stance.FOLLOW
var follow_target_id: int = -1

var _decision_timer: float = 0.0
var _definition: SingularityDefinition


func setup(run_session: RunSession, controlled_actor: Combatant, new_controller_id: int, capability_profile: AgentCapabilityProfile) -> void:
	super.setup(run_session, controlled_actor, new_controller_id, capability_profile)
	_definition = (controlled_actor as SingularityActor).definition
	_decision_timer = randf() * capability_profile.decision_interval


func _physics_process(delta: float) -> void:
	if not is_active():
		return
	_decision_timer -= delta
	if _decision_timer > 0.0:
		return
	_decision_timer = maxf(profile.decision_interval, 0.02)
	_decide(observe())


func _decide(observation: Dictionary) -> void:
	var me: Dictionary = observation["self"]
	var choices: Array = me.get("pending_upgrade_choices", [])
	if not choices.is_empty():
		send(ActionCommand.select_upgrade(_pick_upgrade(choices)))
		return

	var position := Vector2(me["position"][0], me["position"][1])
	var enemies: Array = observation["enemies"]
	var health_fraction: float = float(me["health"]) / maxf(float(me["max_health"]), 1.0)
	var move_direction := Vector2.ZERO

	if not enemies.is_empty():
		var nearest: Dictionary = enemies[0]
		var nearest_position := Vector2(nearest["position"][0], nearest["position"][1])
		var to_enemy: Vector2 = nearest_position - position
		var distance: float = float(nearest["distance"])
		var engage_distance: float = 9.0 + 9.0 * _definition.aggression
		var preferred: float = _definition.preferred_range
		if health_fraction < _definition.retreat_health_fraction:
			move_direction = -_centroid_direction(position, enemies)
		elif stance == Stance.HOLD and distance > preferred + 3.0:
			move_direction = Vector2.ZERO
		elif distance > preferred and (stance == Stance.AGGRESSIVE or distance <= engage_distance):
			move_direction = to_enemy.normalized()
		elif distance < preferred * 0.55:
			move_direction = -to_enemy.normalized()
		elif stance != Stance.HOLD:
			move_direction = to_enemy.normalized().orthogonal() * 0.4
		send(ActionCommand.move(move_direction))
		send(ActionCommand.aim(nearest_position))
		_fight(me, enemies, nearest)
		return

	# No enemies in view: loot, then regroup with the leader.
	var nearest_gem: Dictionary = _nearest_entry(observation["pickups"])
	if not nearest_gem.is_empty() and float(nearest_gem["distance"]) <= GEM_CHASE_DISTANCE and stance != Stance.HOLD:
		var gem_position := Vector2(nearest_gem["position"][0], nearest_gem["position"][1])
		move_direction = (gem_position - position).normalized()
	elif stance == Stance.FOLLOW or stance == Stance.AGGRESSIVE:
		for ally: Dictionary in observation["allies"]:
			if int(ally["id"]) == follow_target_id and float(ally["distance"]) > FOLLOW_DISTANCE:
				move_direction = (Vector2(ally["position"][0], ally["position"][1]) - position).normalized()
	send(ActionCommand.move(move_direction))


func _fight(me: Dictionary, enemies: Array, nearest: Dictionary) -> void:
	var nearest_position := Vector2(nearest["position"][0], nearest["position"][1])
	var abilities: Array = me["abilities"]
	var primary: Dictionary = abilities[0]
	if bool(primary["ready"]) and float(nearest["distance"]) <= minf(float(primary["reach"]) + 0.6, 16.0):
		send(ActionCommand.attack(int(nearest["id"])))
	for slot: int in [ActionCommand.SLOT_ABILITY_ONE, ActionCommand.SLOT_ABILITY_TWO]:
		var ability: Dictionary = _ability_in_slot(abilities, slot)
		if ability.is_empty() or not bool(ability["ready"]):
			continue
		var effective_reach: float = maxf(float(ability["reach"]), float(ability["radius"]))
		var enemies_in_reach: int = 0
		for enemy: Dictionary in enemies:
			if float(enemy["distance"]) <= effective_reach + 1.0:
				enemies_in_reach += 1
		if enemies_in_reach >= _definition.ability_use_enemy_count:
			send(ActionCommand.use_ability(slot, -1, nearest_position))
			return


func _pick_upgrade(choices: Array) -> int:
	var best_index: int = 0
	var best_score: float = -1.0
	for choice: Dictionary in choices:
		var score: float = float(Rarity.TIER_KEYS.find(String(choice["rarity"]))) + 1.0
		if score > best_score:
			best_score = score
			best_index = int(choice["index"])
	return best_index


static func _ability_in_slot(abilities: Array, slot: int) -> Dictionary:
	for ability: Dictionary in abilities:
		if int(ability["slot"]) == slot:
			return ability
	return {}


static func _nearest_entry(entries: Array) -> Dictionary:
	return entries[0] if not entries.is_empty() else {}


static func _centroid_direction(origin: Vector2, enemies: Array) -> Vector2:
	var sum := Vector2.ZERO
	for enemy: Dictionary in enemies:
		sum += Vector2(enemy["position"][0], enemy["position"][1])
	var centroid: Vector2 = sum / float(enemies.size())
	return (centroid - origin).normalized()
