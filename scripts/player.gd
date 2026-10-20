extends CharacterBody3D

signal attacked(origin: Vector3, direction: Vector3, heavy: bool)
signal fell

var yaw := 0.0
var pitch := -0.28
var cooldown := 0.0
var slam := false
var locked := false
var invincible := 0.0
var gait := 0.0
var camera_pivot: Node3D
var model: Node3D
var left_arm: Node3D
var right_arm: Node3D
var left_foot: Node3D
var right_foot: Node3D
var arm_pose := 0.0

func _ready() -> void:
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.52
	capsule.height = 1.8
	var collision := CollisionShape3D.new()
	collision.shape = capsule
	collision.position.y = 0.9
	add_child(collision)
	model = Node3D.new()
	add_child(model)
	var fur := Color("6b3d32")
	var dark := Color("372c30")
	var skin := Color("e4af77")
	part(model, Vector3(0, 1.1, 0), Vector3(1.15, 1.25, 0.8), fur)
	part(model, Vector3(0, 1.15, -0.33), Vector3(0.78, 0.85, 0.25), skin)
	part(model, Vector3(0, 1.94, -0.05), Vector3(0.83, 0.85, 0.73), fur)
	part(model, Vector3(0, 1.88, -0.38), Vector3(0.66, 0.49, 0.32), skin)
	part(model, Vector3(-0.18, 2.06, -0.44), Vector3(0.16, 0.17, 0.12), Color.WHITE)
	part(model, Vector3(0.18, 2.06, -0.44), Vector3(0.16, 0.17, 0.12), Color.WHITE)
	for side in [-1.0, 1.0]:
		part(model, Vector3(side * 0.18, 2.06, -0.5), Vector3(0.07, 0.1, 0.05), dark)
	part(model, Vector3(0, 1.83, -0.55), Vector3(0.3, 0.13, 0.1), dark)
	# Teal scarf gives the original character a recognizable silhouette.
	part(model, Vector3(0, 1.63, -0.05), Vector3(0.9, 0.18, 0.77), Color("37ddca"))
	part(model, Vector3(0.38, 1.37, 0.38), Vector3(0.24, 0.6, 0.13), Color("37ddca"))
	left_arm = arm(-1.0, fur, dark)
	right_arm = arm(1.0, fur, dark)
	left_foot = part(model, Vector3(-0.35, 0.24, -0.13), Vector3(0.5, 0.48, 0.7), dark)
	right_foot = part(model, Vector3(0.35, 0.24, -0.13), Vector3(0.5, 0.48, 0.7), dark)
	camera_pivot = Node3D.new()
	camera_pivot.position.y = 1.5
	add_child(camera_pivot)
	var spring := SpringArm3D.new()
	spring.spring_length = 7.6
	spring.margin = 0.25
	spring.add_excluded_object(get_rid())
	camera_pivot.add_child(spring)
	var camera := Camera3D.new()
	camera.fov = 68
	camera.current = true
	spring.add_child(camera)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func part(parent: Node3D, pos: Vector3, size: Vector3, color: Color) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radial_segments = 12
	sphere.rings = 8
	node.mesh = sphere
	node.position = pos
	node.scale = size
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.9
	node.material_override = material
	parent.add_child(node)
	return node

func arm(side: float, fur: Color, dark: Color) -> Node3D:
	var pivot := Node3D.new()
	pivot.position = Vector3(side * 0.65, 1.48, 0)
	model.add_child(pivot)
	part(pivot, Vector3(side * 0.15, -0.35, 0), Vector3(0.6, 0.95, 0.6), fur)
	part(pivot, Vector3(side * 0.18, -0.8, -0.08), Vector3(0.66, 0.58, 0.65), dark)
	return pivot

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw -= event.relative.x * 0.003
		pitch = clampf(pitch - event.relative.y * 0.003, -0.95, 0.25)
	if event.is_action_pressed("pause_mouse"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED
	if event is InputEventMouseButton and event.pressed and Input.mouse_mode == Input.MOUSE_MODE_VISIBLE and not locked:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _physics_process(delta: float) -> void:
	cooldown = maxf(0, cooldown - delta)
	invincible = maxf(0, invincible - delta)
	if Input.is_action_pressed("camera_left"):
		yaw += delta * 1.9
	if Input.is_action_pressed("camera_right"):
		yaw -= delta * 1.9
	camera_pivot.rotation = Vector3(pitch, yaw, 0)
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back") if not locked else Vector2.ZERO
	var direction := Vector3(input.x, 0, input.y).rotated(Vector3.UP, yaw)
	var speed := 9.5 if Input.is_action_pressed("sprint") else 6.5
	velocity.x = move_toward(velocity.x, direction.x * speed, delta * 32)
	velocity.z = move_toward(velocity.z, direction.z * speed, delta * 32)
	if direction.length() > 0.1:
		model.rotation.y = lerp_angle(model.rotation.y, atan2(-direction.x, -direction.z), delta * 14)
	if not is_on_floor():
		velocity.y -= 25 * delta
	elif not slam:
		velocity.y = -0.1
	if Input.is_action_just_pressed("jump") and is_on_floor() and not locked:
		velocity.y = 10.5
	if Input.is_action_just_pressed("slam") and not is_on_floor() and cooldown <= 0 and not locked:
		slam = true
		velocity.y = -25
	if Input.is_action_just_pressed("punch") and cooldown <= 0 and not locked:
		cooldown = 0.32
		arm_pose = 1.0
		attacked.emit(global_position + Vector3.UP, -model.global_basis.z, false)
	move_and_slide()
	if slam and is_on_floor():
		slam = false
		cooldown = 0.45
		attacked.emit(global_position + Vector3.UP * 0.15, Vector3.DOWN, true)
	if global_position.y < -10:
		fell.emit()
	gait += delta * Vector2(velocity.x, velocity.z).length() * 1.5
	arm_pose = move_toward(arm_pose, 0, delta * 4)
	left_arm.rotation.x = sin(gait) * 0.35 - arm_pose * 1.8
	right_arm.rotation.x = -sin(gait) * 0.35 - arm_pose * 1.8
	left_foot.position.y = 0.24 + maxf(0, sin(gait)) * 0.12
	right_foot.position.y = 0.24 + maxf(0, -sin(gait)) * 0.12
	model.visible = invincible <= 0 or fmod(invincible, 0.16) < 0.1
