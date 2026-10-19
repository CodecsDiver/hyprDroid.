class_name TeamPalette
extends RefCounted
## Team colours, adjusted by the colour-blind accessibility setting.

static func ally_color() -> Color:
	return Color(0.30, 0.80, 1.00)


static func enemy_color(base: Color) -> Color:
	match Settings.get_int("accessibility/colorblind_mode"):
		1: # Red-green safe: push enemies towards orange-yellow, away from green.
			return base.lerp(Color(1.0, 0.75, 0.10), 0.55)
		2: # Blue-yellow safe: push enemies towards magenta-red.
			return base.lerp(Color(1.0, 0.15, 0.55), 0.55)
		_:
			return base


## Hazards use their authored colour, shifted away from green for red-green safe mode.
static func hazard_color(base: Color) -> Color:
	if Settings.get_int("accessibility/colorblind_mode") == 1:
		return base.lerp(Color(0.9, 0.2, 0.9), 0.7)
	return base
