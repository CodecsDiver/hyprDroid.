class_name Rarity
extends RefCounted
## Shared rarity tiers for upgrades and items.

enum Tier { COMMON, UNCOMMON, RARE, LEGENDARY }

const TIER_KEYS: Array[String] = ["common", "uncommon", "rare", "legendary"]
const TIER_NAMES: Array[String] = ["Common", "Uncommon", "Rare", "Legendary"]
const TIER_COLORS: Array[Color] = [
	Color(0.75, 0.80, 0.85),
	Color(0.35, 0.85, 0.45),
	Color(0.35, 0.60, 1.00),
	Color(1.00, 0.65, 0.15),
]


static func display_name(tier: Tier) -> String:
	return TIER_NAMES[tier]


static func key(tier: Tier) -> String:
	return TIER_KEYS[tier]


static func color(tier: Tier) -> Color:
	return TIER_COLORS[tier]
