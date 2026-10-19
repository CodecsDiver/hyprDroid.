extends Node
## Loads the central BalanceConfig resource and exposes it as `Balance.config`.
## Edit data/balance/balance_config.tres (or call reload()) to tune the game.

const CONFIG_PATH := "res://data/balance/balance_config.tres"

var config: BalanceConfig


func _ready() -> void:
	reload()


func reload() -> void:
	var loaded: BalanceConfig = null
	if ResourceLoader.exists(CONFIG_PATH):
		loaded = load(CONFIG_PATH) as BalanceConfig
	if loaded == null:
		push_error("Balance: could not load %s; falling back to built-in defaults." % CONFIG_PATH)
		loaded = BalanceConfig.new()
		loaded.xp_curve = XpCurve.new()
		loaded.upgrade_rarity_weights = {"common": 60.0, "uncommon": 28.0, "rare": 10.0, "legendary": 2.0}
		loaded.chest_rarity_weights = {"common": 60.0, "uncommon": 28.0, "rare": 10.0, "legendary": 2.0}
	config = loaded
