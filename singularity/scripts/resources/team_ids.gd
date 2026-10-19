class_name TeamIds
extends RefCounted
## Team identifiers. Hostility is simply "different team id".

const PLAYER := 0
const ENEMY := 1
const NEUTRAL := 2


static func are_hostile(team_a: int, team_b: int) -> bool:
	return team_a != team_b and team_a != NEUTRAL and team_b != NEUTRAL
