class_name ActionCommand
extends RefCounted
## A request from a controller (human input, conventional AI, or external agent)
## for one of its actors to do something. Commands are *requests*: the simulation
## validates every one and may reject it. See AGENT_INTERFACE.md.
##
## Wire format (JSON-compatible dictionary):
##   {"type": "move",           "direction": [x, z]}
##   {"type": "aim",            "point": [x, z]}
##   {"type": "attack",         "target_id": 12 | "point": [x, z]}   (both optional)
##   {"type": "use_ability",    "slot": 1|2|3, "target_id": ..., "point": [x, z]}
##   {"type": "interact",       "target_id": 7}
##   {"type": "select_upgrade", "choice_index": 0}

enum Type { MOVE, AIM, ATTACK, USE_ABILITY, INTERACT, SELECT_UPGRADE }

const TYPE_NAMES: Array[String] = ["move", "aim", "attack", "use_ability", "interact", "select_upgrade"]
const SLOT_ABILITY_ONE := 1
const SLOT_ABILITY_TWO := 2
const SLOT_EQUIPMENT := 3
const MAX_COORDINATE := 5000.0

var type: Type = Type.MOVE
var direction: Vector2 = Vector2.ZERO
var point: Vector2 = Vector2.ZERO
var has_point: bool = false
var target_id: int = -1
var slot: int = 0
var choice_index: int = -1


static func move(world_direction: Vector2) -> ActionCommand:
	var command := ActionCommand.new()
	command.type = Type.MOVE
	command.direction = world_direction
	return command


static func aim(world_point: Vector2) -> ActionCommand:
	var command := ActionCommand.new()
	command.type = Type.AIM
	command.point = world_point
	command.has_point = true
	return command


static func attack(attack_target_id: int = -1, world_point: Variant = null) -> ActionCommand:
	var command := ActionCommand.new()
	command.type = Type.ATTACK
	command.target_id = attack_target_id
	if world_point is Vector2:
		command.point = world_point
		command.has_point = true
	return command


static func use_ability(ability_slot: int, ability_target_id: int = -1, world_point: Variant = null) -> ActionCommand:
	var command := ActionCommand.new()
	command.type = Type.USE_ABILITY
	command.slot = ability_slot
	command.target_id = ability_target_id
	if world_point is Vector2:
		command.point = world_point
		command.has_point = true
	return command


static func interact(interactable_id: int) -> ActionCommand:
	var command := ActionCommand.new()
	command.type = Type.INTERACT
	command.target_id = interactable_id
	return command


static func select_upgrade(index: int) -> ActionCommand:
	var command := ActionCommand.new()
	command.type = Type.SELECT_UPGRADE
	command.choice_index = index
	return command


func type_name() -> StringName:
	return StringName(TYPE_NAMES[type])


func to_dict() -> Dictionary:
	var data: Dictionary = {"type": TYPE_NAMES[type]}
	match type:
		Type.MOVE:
			data["direction"] = [direction.x, direction.y]
		Type.AIM:
			data["point"] = [point.x, point.y]
		Type.ATTACK, Type.USE_ABILITY:
			if type == Type.USE_ABILITY:
				data["slot"] = slot
			if target_id >= 0:
				data["target_id"] = target_id
			if has_point:
				data["point"] = [point.x, point.y]
		Type.INTERACT:
			data["target_id"] = target_id
		Type.SELECT_UPGRADE:
			data["choice_index"] = choice_index
	return data


## Parse an untrusted dictionary (e.g. decoded JSON). Returns
## {"command": ActionCommand or null, "error": String}.
static func parse(data: Variant) -> Dictionary:
	if typeof(data) != TYPE_DICTIONARY:
		return _parse_failure("command must be an object")
	var fields: Dictionary = data
	var type_text: String = String(fields.get("type", "")).to_lower()
	var type_index: int = TYPE_NAMES.find(type_text)
	if type_index < 0:
		return _parse_failure("unknown command type '%s'" % type_text)
	var command := ActionCommand.new()
	command.type = type_index as Type
	match command.type:
		Type.MOVE:
			var direction_result: Dictionary = _read_vector2(fields, "direction", true)
			if direction_result.has("error"):
				return _parse_failure(direction_result["error"])
			command.direction = direction_result["value"]
		Type.AIM:
			var aim_result: Dictionary = _read_vector2(fields, "point", true)
			if aim_result.has("error"):
				return _parse_failure(aim_result["error"])
			command.point = aim_result["value"]
			command.has_point = true
		Type.ATTACK, Type.USE_ABILITY:
			if command.type == Type.USE_ABILITY:
				if not _is_integer_value(fields.get("slot")):
					return _parse_failure("slot must be an integer 1-3")
				command.slot = int(fields["slot"])
			if fields.has("target_id"):
				if not _is_integer_value(fields["target_id"]):
					return _parse_failure("target_id must be an integer")
				command.target_id = int(fields["target_id"])
			if fields.has("point"):
				var point_result: Dictionary = _read_vector2(fields, "point", false)
				if point_result.has("error"):
					return _parse_failure(point_result["error"])
				command.point = point_result["value"]
				command.has_point = true
		Type.INTERACT:
			if not _is_integer_value(fields.get("target_id")):
				return _parse_failure("target_id must be an integer")
			command.target_id = int(fields["target_id"])
		Type.SELECT_UPGRADE:
			if not _is_integer_value(fields.get("choice_index")):
				return _parse_failure("choice_index must be an integer")
			command.choice_index = int(fields["choice_index"])
	return {"command": command, "error": ""}


static func _parse_failure(error_text: String) -> Dictionary:
	return {"command": null, "error": error_text}


static func _is_integer_value(value: Variant) -> bool:
	if typeof(value) == TYPE_INT:
		return true
	return typeof(value) == TYPE_FLOAT and is_finite(value) and floorf(value) == value


## Reads a [x, z] pair. Rejects non-finite or absurdly large values.
static func _read_vector2(fields: Dictionary, key: String, required: bool) -> Dictionary:
	if not fields.has(key):
		return {"error": "missing '%s'" % key} if required else {"value": Vector2.ZERO}
	var raw: Variant = fields[key]
	if typeof(raw) != TYPE_ARRAY or (raw as Array).size() != 2:
		return {"error": "'%s' must be [x, z]" % key}
	var raw_array: Array = raw
	for component: Variant in raw_array:
		if typeof(component) != TYPE_INT and typeof(component) != TYPE_FLOAT:
			return {"error": "'%s' components must be numbers" % key}
		if not is_finite(float(component)) or absf(float(component)) > MAX_COORDINATE:
			return {"error": "'%s' components must be finite and within +/-%d" % [key, int(MAX_COORDINATE)]}
	return {"value": Vector2(float(raw_array[0]), float(raw_array[1]))}
