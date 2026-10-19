extends Node
## Registry of all data-driven definitions, loaded from res://data at startup.
## Lookups are by id; missing ids return null and log an error.

const CHARACTER_DIR := "res://data/characters"
const UPGRADE_DIR := "res://data/upgrades"
const ITEM_DIR := "res://data/items"
const ENEMY_DIR := "res://data/enemies"
const AGENT_PROFILE_DIR := "res://data/agent_profiles"
const MAP_DIR := "res://data/maps"

var characters: Dictionary = {}
var upgrades: Dictionary = {}
var items: Dictionary = {}
var enemies: Dictionary = {}
var agent_profiles: Dictionary = {}
var maps: Dictionary = {}

## Ordered for UI display.
var character_order: Array[StringName] = []


func _ready() -> void:
	reload()


func reload() -> void:
	characters = _load_directory(CHARACTER_DIR)
	upgrades = _load_directory(UPGRADE_DIR)
	items = _load_directory(ITEM_DIR)
	enemies = _load_directory(ENEMY_DIR)
	agent_profiles = _load_directory(AGENT_PROFILE_DIR)
	maps = _load_directory(MAP_DIR)
	character_order.clear()
	var character_ids: Array = characters.keys()
	character_ids.sort()
	for character_id: Variant in character_ids:
		character_order.append(StringName(character_id))
	# Keep the roster in the order the GDD lists it.
	var preferred_order: Array[StringName] = [
		&"mindshape", &"hell_eater", &"c_lo_d", &"t_bsphere_e1", &"binaural_sphere", &"emergent_1_3_12",
		&"null_saint", &"axiom_9", &"mother_swarm", &"paradox_0", &"archive_omega", &"fault_line",
	]
	var ordered: Array[StringName] = []
	for character_id: StringName in preferred_order:
		if characters.has(String(character_id)):
			ordered.append(character_id)
	for character_id: StringName in character_order:
		if not ordered.has(character_id):
			ordered.append(character_id)
	character_order = ordered


func get_character(character_id: StringName) -> SingularityDefinition:
	return _lookup(characters, character_id, "character") as SingularityDefinition


func get_upgrade(upgrade_id: StringName) -> UpgradeDefinition:
	return _lookup(upgrades, upgrade_id, "upgrade") as UpgradeDefinition


func get_item(item_id: StringName) -> ItemDefinition:
	return _lookup(items, item_id, "item") as ItemDefinition


func get_enemy(enemy_id: StringName) -> EnemyDefinition:
	return _lookup(enemies, enemy_id, "enemy") as EnemyDefinition


func get_agent_profile(profile_id: StringName) -> AgentCapabilityProfile:
	var profile: AgentCapabilityProfile = _lookup(agent_profiles, profile_id, "agent profile") as AgentCapabilityProfile
	if profile == null:
		profile = AgentCapabilityProfile.new()
		profile.id = profile_id
	return profile


func get_map(map_id: StringName) -> MapLayout:
	return _lookup(maps, map_id, "map") as MapLayout


func upgrades_for_character(character_id: StringName) -> Array[UpgradeDefinition]:
	var result: Array[UpgradeDefinition] = []
	for upgrade_id: String in upgrades.keys():
		var upgrade: UpgradeDefinition = upgrades[upgrade_id]
		if upgrade.is_available_to(character_id):
			result.append(upgrade)
	return result


func _lookup(table: Dictionary, definition_id: StringName, label: String) -> Resource:
	var key: String = String(definition_id)
	if not table.has(key):
		push_error("Catalog: unknown %s id '%s'." % [label, key])
		return null
	return table[key]


## Loads every .tres in a directory, keyed by the resource's `id` property
## (or `map_id` for maps). Handles the ".remap" suffix used in exported builds.
func _load_directory(directory_path: String) -> Dictionary:
	var table: Dictionary = {}
	var directory := DirAccess.open(directory_path)
	if directory == null:
		push_error("Catalog: cannot open %s" % directory_path)
		return table
	for file_name: String in directory.get_files():
		var clean_name: String = file_name.trim_suffix(".remap")
		if not clean_name.ends_with(".tres"):
			continue
		var loaded: Resource = load("%s/%s" % [directory_path, clean_name])
		if loaded == null:
			push_error("Catalog: failed to load %s/%s" % [directory_path, clean_name])
			continue
		var definition_id: String = ""
		if "map_id" in loaded:
			definition_id = String(loaded.get("map_id"))
		elif "id" in loaded:
			definition_id = String(loaded.get("id"))
		if definition_id.is_empty():
			push_error("Catalog: %s/%s has no id." % [directory_path, clean_name])
			continue
		if table.has(definition_id):
			push_error("Catalog: duplicate id '%s' in %s." % [definition_id, directory_path])
		table[definition_id] = loaded
	return table
