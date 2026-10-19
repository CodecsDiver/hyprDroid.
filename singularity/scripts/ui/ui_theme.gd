class_name UiTheme
extends RefCounted
## Temporary but consistent industrial theme, generated in code so every screen
## and component picks it up from the root window. A high-contrast variant is
## selected through the accessibility settings.

const ACCENT := Color(0.25, 0.82, 0.88)
const ACCENT_DIM := Color(0.15, 0.45, 0.50)
const WARNING := Color(1.0, 0.55, 0.2)
const DANGER := Color(0.95, 0.3, 0.3)
const GOOD := Color(0.35, 0.9, 0.5)


static func build(high_contrast: bool) -> Theme:
	var background: Color = Color.BLACK if high_contrast else Color(0.055, 0.07, 0.09)
	var panel: Color = Color(0.0, 0.0, 0.0) if high_contrast else Color(0.085, 0.11, 0.145)
	var raised: Color = Color(0.12, 0.12, 0.12) if high_contrast else Color(0.13, 0.17, 0.22)
	var hover: Color = Color(0.2, 0.2, 0.2) if high_contrast else Color(0.17, 0.23, 0.30)
	var border: Color = Color.WHITE if high_contrast else Color(0.22, 0.30, 0.38)
	var text: Color = Color.WHITE if high_contrast else Color(0.88, 0.93, 0.97)
	var muted: Color = Color(0.85, 0.85, 0.85) if high_contrast else Color(0.55, 0.64, 0.72)
	var focus: Color = Color(1.0, 0.95, 0.0) if high_contrast else ACCENT

	var theme := Theme.new()
	theme.default_font_size = 18

	theme.set_stylebox("normal", "Button", _box(raised, border, 1, 4, 10))
	theme.set_stylebox("hover", "Button", _box(hover, focus, 1, 4, 10))
	theme.set_stylebox("pressed", "Button", _box(ACCENT_DIM if not high_contrast else Color(0.35, 0.35, 0.0), focus, 2, 4, 10))
	theme.set_stylebox("focus", "Button", _box(Color(0, 0, 0, 0), focus, 3 if high_contrast else 2, 4, 10))
	theme.set_stylebox("disabled", "Button", _box(Color(raised, 0.5), Color(border, 0.4), 1, 4, 10))
	for state_name: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		theme.set_color(state_name, "Button", text)
	theme.set_color("font_disabled_color", "Button", muted)

	theme.set_stylebox("panel", "PanelContainer", _box(panel, border, 1, 6, 16))
	theme.set_stylebox("panel", "Panel", _box(panel, border, 1, 6, 8))
	theme.set_color("font_color", "Label", text)
	theme.set_color("default_color", "RichTextLabel", text)

	theme.set_type_variation("TitleLabel", "Label")
	theme.set_font_size("font_size", "TitleLabel", 40)
	theme.set_color("font_color", "TitleLabel", focus)
	theme.set_type_variation("HeaderLabel", "Label")
	theme.set_font_size("font_size", "HeaderLabel", 24)
	theme.set_color("font_color", "HeaderLabel", focus)
	theme.set_type_variation("MutedLabel", "Label")
	theme.set_color("font_color", "MutedLabel", muted)
	theme.set_font_size("font_size", "MutedLabel", 15)
	theme.set_type_variation("CardPanel", "PanelContainer")
	theme.set_stylebox("panel", "CardPanel", _box(raised, border, 2, 8, 14))
	theme.set_type_variation("ScreenBackground", "Panel")
	theme.set_stylebox("panel", "ScreenBackground", _box(Color(background, 0.92), Color(0, 0, 0, 0), 0, 0, 0))

	theme.set_stylebox("background", "ProgressBar", _box(Color(0.02, 0.03, 0.04, 0.9), border, 1, 3, 0))
	theme.set_stylebox("fill", "ProgressBar", _box(ACCENT, ACCENT, 0, 3, 0))
	theme.set_color("font_color", "ProgressBar", text)
	theme.set_font_size("font_size", "ProgressBar", 14)

	theme.set_stylebox("slider", "HSlider", _box(Color(0.02, 0.03, 0.04), border, 1, 3, 0, 4))
	theme.set_stylebox("grabber_area", "HSlider", _box(ACCENT_DIM, ACCENT_DIM, 0, 3, 0, 4))
	theme.set_stylebox("grabber_area_highlight", "HSlider", _box(ACCENT, ACCENT, 0, 3, 0, 4))

	theme.set_stylebox("panel", "TabContainer", _box(panel, border, 1, 4, 14))
	theme.set_stylebox("tab_selected", "TabContainer", _box(raised, focus, 2, 4, 10))
	theme.set_stylebox("tab_unselected", "TabContainer", _box(panel, border, 1, 4, 10))
	theme.set_stylebox("tab_hovered", "TabContainer", _box(hover, border, 1, 4, 10))
	theme.set_stylebox("tab_focus", "TabContainer", _box(Color(0, 0, 0, 0), focus, 2, 4, 10))
	theme.set_color("font_selected_color", "TabContainer", text)
	theme.set_color("font_unselected_color", "TabContainer", muted)
	theme.set_color("font_hovered_color", "TabContainer", text)
	return theme


static func _box(fill: Color, border: Color, border_width: int, radius: int, margin: int, vertical_margin: int = -1) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(border_width)
	style.set_corner_radius_all(radius)
	style.content_margin_left = margin
	style.content_margin_right = margin
	style.content_margin_top = margin * 0.6 if vertical_margin < 0 else vertical_margin
	style.content_margin_bottom = margin * 0.6 if vertical_margin < 0 else vertical_margin
	return style
