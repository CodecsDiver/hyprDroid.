extends Node
## Global signal bus. Gameplay systems emit here; UI, telemetry and effects listen.
## Nothing in this file holds state.

# --- Game flow -------------------------------------------------------------
signal game_state_changed(previous_state: int, new_state: int)
signal run_started(run_info: Dictionary)
signal run_ended(outcome: StringName, summary: Dictionary)

# --- Combat ----------------------------------------------------------------
signal damage_dealt(source_actor_id: int, target_actor_id: int, amount: float, is_crit: bool, ability_id: StringName)
signal actor_healed(actor_id: int, amount: float, reason: StringName)
signal actor_died(actor_id: int, killer_actor_id: int, team_id: int, archetype_id: StringName)
signal ability_used(actor_id: int, ability_id: StringName)

# --- Progression -----------------------------------------------------------
signal xp_gained(actor_id: int, amount: float)
signal level_gained(actor_id: int, new_level: int)
signal upgrade_choices_ready(actor_id: int)
signal upgrade_selected(actor_id: int, upgrade_id: StringName, new_stacks: int)
signal item_acquired(actor_id: int, item_id: StringName, new_stacks: int)

# --- Agent interface -------------------------------------------------------
signal command_processed(controller_id: int, actor_id: int, command_type: StringName, accepted: bool, reason: StringName)

# --- Misc ------------------------------------------------------------------
signal settings_changed(setting_id: StringName)
signal notification_posted(message: String, color: Color)
signal tactical_mode_changed(is_active: bool)
