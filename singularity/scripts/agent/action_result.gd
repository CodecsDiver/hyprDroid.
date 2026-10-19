class_name ActionResult
extends RefCounted
## Outcome of submitting a command to the authoritative simulation.

const OK := &"ok"
const UNKNOWN_ACTOR := &"unknown_actor"
const ACTOR_DEAD := &"actor_dead"
const NOT_OWNER := &"not_owner"
const COMMAND_NOT_ALLOWED := &"command_not_allowed"
const INVALID_PARAMS := &"invalid_params"
const ON_COOLDOWN := &"on_cooldown"
const OUT_OF_RANGE := &"out_of_range"
const NO_PENDING_UPGRADE := &"no_pending_upgrade"
const BAD_CHOICE := &"bad_choice"
const RATE_LIMITED := &"rate_limited"
const NO_SUCH_ABILITY := &"no_such_ability"
const NO_TARGET := &"no_target"
const RUN_NOT_ACTIVE := &"run_not_active"

var accepted: bool = false
var reason: StringName = OK
var message: String = ""
var detail: Dictionary = {}


static func accept(detail_data: Dictionary = {}) -> ActionResult:
	var result := ActionResult.new()
	result.accepted = true
	result.detail = detail_data
	return result


static func reject(reason_code: StringName, human_message: String = "") -> ActionResult:
	var result := ActionResult.new()
	result.accepted = false
	result.reason = reason_code
	result.message = human_message
	return result


func to_dict() -> Dictionary:
	return {"accepted": accepted, "reason": String(reason), "message": message, "detail": detail}
