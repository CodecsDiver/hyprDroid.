class_name CameraRig
extends Node3D
## Orthographic isometric camera: 45 degrees of yaw (rotatable in 45-degree steps),
## ~35.264 degrees of elevation, smooth follow and zoom, plus a zoomed-out tactical view.

const ELEVATION_DEGREES := 35.264
const BASE_YAW_DEGREES := 45.0
const YAW_STEP_DEGREES := 45.0
const DEFAULT_SIZE := 22.0
const MIN_SIZE := 12.0
const MAX_SIZE := 34.0
const TACTICAL_SIZE := 46.0
const FOLLOW_SHARPNESS := 7.0
const ZOOM_STEP := 1.5

var camera: Camera3D
var is_tactical: bool = false

var _yaw_pivot: Node3D
var _pitch_pivot: Node3D
var _target_yaw: float = deg_to_rad(BASE_YAW_DEGREES)
var _current_yaw: float = deg_to_rad(BASE_YAW_DEGREES)
var _chosen_size: float = DEFAULT_SIZE
var _follow_target: Node3D
var _shake_strength: float = 0.0


func _ready() -> void:
	_yaw_pivot = Node3D.new()
	_yaw_pivot.rotation.y = _current_yaw
	add_child(_yaw_pivot)
	_pitch_pivot = Node3D.new()
	_pitch_pivot.rotation.x = -deg_to_rad(ELEVATION_DEGREES)
	_yaw_pivot.add_child(_pitch_pivot)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = DEFAULT_SIZE
	camera.near = 0.1
	camera.far = 160.0
	camera.position = Vector3(0.0, 0.0, 70.0)
	_pitch_pivot.add_child(camera)
	camera.make_current()


func set_follow_target(target: Node3D) -> void:
	_follow_target = target


func center_on(world_position: Vector3) -> void:
	global_position = Vector3(world_position.x, 0.0, world_position.z)


func yaw_radians() -> float:
	return _current_yaw


func set_tactical(enabled: bool) -> void:
	is_tactical = enabled


func add_shake(strength: float) -> void:
	var scale: float = Settings.get_float("accessibility/screen_shake") / 100.0
	if Settings.get_bool("accessibility/reduce_motion"):
		scale = 0.0
	_shake_strength = maxf(_shake_strength, strength * scale)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("camera_rotate_left"):
		_target_yaw -= deg_to_rad(YAW_STEP_DEGREES)
	elif event.is_action_pressed("camera_rotate_right"):
		_target_yaw += deg_to_rad(YAW_STEP_DEGREES)
	elif event is InputEventMouseButton and event.pressed:
		var mouse_event := event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_chosen_size = clampf(_chosen_size - ZOOM_STEP, MIN_SIZE, MAX_SIZE)
		elif mouse_event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_chosen_size = clampf(_chosen_size + ZOOM_STEP, MIN_SIZE, MAX_SIZE)


func _process(delta: float) -> void:
	var smooth: bool = not Settings.get_bool("accessibility/reduce_motion")
	var blend: float = 1.0 - exp(-FOLLOW_SHARPNESS * delta)
	if _follow_target != null and is_instance_valid(_follow_target):
		var goal := Vector3(_follow_target.global_position.x, 0.0, _follow_target.global_position.z)
		global_position = global_position.lerp(goal, blend if smooth else 1.0)
	_current_yaw = lerp_angle(_current_yaw, _target_yaw, 1.0 - exp(-10.0 * delta) if smooth else 1.0)
	_yaw_pivot.rotation.y = _current_yaw
	var goal_size: float = TACTICAL_SIZE if is_tactical else _chosen_size
	camera.size = lerpf(camera.size, goal_size, 1.0 - exp(-6.0 * delta) if smooth else 1.0)
	if _shake_strength > 0.01:
		camera.h_offset = randf_range(-1.0, 1.0) * _shake_strength
		camera.v_offset = randf_range(-1.0, 1.0) * _shake_strength
		_shake_strength = lerpf(_shake_strength, 0.0, 1.0 - exp(-12.0 * delta))
	else:
		camera.h_offset = 0.0
		camera.v_offset = 0.0
		_shake_strength = 0.0


## Projects a screen position onto the y = 0 ground plane. Returns null if it misses.
func project_mouse_to_ground(screen_position: Vector2) -> Variant:
	if camera == null or not camera.is_inside_tree():
		return null
	var ray_origin: Vector3 = camera.project_ray_origin(screen_position)
	var ray_direction: Vector3 = camera.project_ray_normal(screen_position)
	return Plane(Vector3.UP, 0.0).intersects_ray(ray_origin, ray_direction)
