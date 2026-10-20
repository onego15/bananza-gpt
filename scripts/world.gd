extends Node3D

const PlayerScript = preload("res://scripts/player.gd")
const GOAL := 30
var player: CharacterBody3D
var bananas: Array[Node3D] = []
var enemies: Array[Node3D] = []
var blocks: Array[StaticBody3D] = []
var score := 0
var broken := 0
var health := 5
var elapsed := 0.0
var finished := false
var shake := 0.0
var score_label: Label
var health_label: Label
var status_label: Label
var time_label: Label
var end_panel: PanelContainer
var end_label: Label
var progress: ProgressBar
var sounds: AudioStreamPlayer
var rng := RandomNumberGenerator.new()
var materials := {}

func _ready() -> void:
	rng.seed = 80125
	setup_inputs()
	setup_lighting()
	build_island()
	player = PlayerScript.new()
	player.position = Vector3(0, 1, 10)
	add_child(player)
	player.attacked.connect(on_attack)
	player.fell.connect(respawn)
	sounds = AudioStreamPlayer.new()
	add_child(sounds)
	build_ui()

func setup_inputs() -> void:
	if InputMap.has_action("move_forward"):
		return
	var bindings := {"move_forward": [KEY_W, KEY_UP], "move_back": [KEY_S, KEY_DOWN], "move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT], "jump": [KEY_SPACE], "punch": [KEY_J], "slam": [KEY_E], "sprint": [KEY_SHIFT], "pause_mouse": [KEY_ESCAPE], "restart": [KEY_R], "camera_left": [KEY_Q], "camera_right": [KEY_C]}
	for action: String in bindings:
		InputMap.add_action(action)
		for key: int in bindings[action]:
			var event := InputEventKey.new()
			event.physical_keycode = key
			InputMap.action_add_event(action, event)
	var mouse := InputEventMouseButton.new()
	mouse.button_index = MOUSE_BUTTON_LEFT
	InputMap.action_add_event("punch", mouse)

func mat(color: Color) -> StandardMaterial3D:
	if materials.has(color):
		return materials[color]
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.85
	materials[color] = material
	return material

func box(parent: Node3D, pos: Vector3, size: Vector3, color: Color) -> MeshInstance3D:
	var mesh := MeshInstance3D.new()
	var shape := BoxMesh.new()
	shape.size = size
	mesh.mesh = shape
	mesh.material_override = mat(color)
	mesh.position = pos
	parent.add_child(mesh)
	return mesh

func solid(pos: Vector3, size: Vector3, color: Color, breakable: bool = false) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.position = pos
	add_child(body)
	box(body, Vector3.ZERO, size, color)
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	if breakable:
		body.set_meta("color", color)
		blocks.append(body)
	return body

func setup_lighting() -> void:
	var world := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color("147e9d")
	sky_mat.sky_horizon_color = Color("bdebe2")
	sky_mat.ground_bottom_color = Color("2e7283")
	sky_mat.ground_horizon_color = Color("bdebe2")
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("bce6e1")
	env.ambient_light_energy = 0.35
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	world.environment = env
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.light_color = Color("fff1ca")
	sun.light_energy = 0.8
	sun.shadow_enabled = true
	add_child(sun)

func build_island() -> void:
	# Permanent bedrock preserves a traversable route after excavation.
	solid(Vector3(0, -0.75, 0), Vector3(31, 1.5, 31), Color("52a56b"))
	box(self, Vector3(0, -2.0, 0), Vector3(29.5, 1.2, 29.5), Color("996849"))
	box(self, Vector3(0, -3.1, 0), Vector3(26.5, 1.3, 26.5), Color("665243"))
	box(self, Vector3(0, -4.2, 0), Vector3(22, 1.2, 22), Color("4b4644"))
	for x in range(-6, 7):
		for z in range(-6, 5):
			if abs(x) < 2 and z > 0:
				continue
			var height := 0
			if z < -1:
				height = rng.randi_range(1, 3)
			elif abs(x) > 3:
				height = rng.randi_range(1, 2)
			for y in range(height):
				var color := Color("d6a96b") if y < height - 1 else Color("a5be65")
				color = color.lightened(rng.randf_range(-0.07, 0.07))
				var block := solid(Vector3(x * 2.0, y * 2.0 + 1.0, z * 2.0), Vector3.ONE * 1.96, color, true)
				block.set_meta("banana", rng.randf() < 0.27)
	# A readable trail leads from spawn into the dig site.
	for pos in [Vector3(0, 1.0, 7), Vector3(0, 1.0, 4), Vector3(0, 1.0, 1), Vector3(3, 1.0, 0), Vector3(-3, 1.0, 0)]:
		spawn_banana(pos)
	for i in range(8):
		var x := -10.0 + i * 2.8
		spawn_banana(Vector3(x, 7.2, -9))
	for pos in [Vector3(-13, 0, 12), Vector3(13, 0, 11), Vector3(-14, 0, -11), Vector3(13, 0, -13)]:
		palm(pos)
	for pos in [Vector3(-5, 0, 6), Vector3(6, 0, 5), Vector3(0, 0, -1)]:
		spawn_enemy(pos)
	for i in range(25):
		var pos := Vector3(rng.randf_range(-14, 14), 0.05, rng.randf_range(10, 14))
		box(self, pos, Vector3(0.12, rng.randf_range(0.15, 0.45), 0.12), Color("c5dd85"))
	# Distant islands frame the level without imported assets.
	for i in range(10):
		var angle := i * TAU / 10
		var pos := Vector3(cos(angle) * 65, rng.randf_range(-14, 3), sin(angle) * 65)
		box(self, pos, Vector3(12, 3, 10), Color("689d8d"))
		box(self, pos - Vector3(0, 4, 0), Vector3(8, 5, 7), Color("647b77"))

func palm(pos: Vector3) -> void:
	var root := Node3D.new()
	root.position = pos
	add_child(root)
	var trunk := MeshInstance3D.new()
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = 0.23
	cylinder.bottom_radius = 0.4
	cylinder.height = 5.5
	cylinder.radial_segments = 7
	trunk.mesh = cylinder
	trunk.material_override = mat(Color("96704b"))
	trunk.position.y = 2.75
	trunk.rotation.z = 0.12
	root.add_child(trunk)
	for i in range(7):
		var leaf := box(root, Vector3(0, 5.2, 0), Vector3(0.85, 0.16, 4.2), Color("287e57"))
		leaf.rotation = Vector3(0.2, i * TAU / 7, 0)
		leaf.position += leaf.basis.z * 1.3

func spawn_banana(pos: Vector3) -> void:
	var root := Node3D.new()
	root.position = pos
	root.set_meta("base_y", pos.y)
	root.set_meta("phase", rng.randf() * TAU)
	add_child(root)
	for i in range(5):
		var angle := -1.0 + i * 0.5
		var segment := box(root, Vector3(cos(angle) * 0.55 - 0.3, sin(angle) * 0.55, 0), Vector3(0.25, 0.3, 0.23), Color("ffe15b"))
		segment.rotation.z = angle
	box(root, Vector3(0, 0.57, 0), Vector3(0.12, 0.18, 0.12), Color("745636"))
	bananas.append(root)

func spawn_enemy(pos: Vector3) -> void:
	var enemy := Node3D.new()
	enemy.position = pos
	enemy.set_meta("home", pos)
	enemy.set_meta("phase", rng.randf() * TAU)
	add_child(enemy)
	box(enemy, Vector3(0, 0.6, 0), Vector3(0.9, 1, 0.9), Color("d76162"))
	for side in [-1, 1]:
		box(enemy, Vector3(side * 0.23, 0.8, 0.47), Vector3(0.23, 0.22, 0.07), Color("fff2cd"))
		box(enemy, Vector3(side * 0.23, 0.77, 0.52), Vector3(0.09, 0.11, 0.04), Color("433840"))
	enemies.append(enemy)

func on_attack(origin: Vector3, direction: Vector3, heavy: bool) -> void:
	var count := 0
	for block in blocks.duplicate():
		var offset: Vector3 = block.position - origin
		var in_range: bool = offset.length() < (4.2 if heavy else 3.5)
		var in_front: bool = heavy or offset.normalized().dot(direction) > 0.25
		if in_range and in_front:
			count += 1
			broken += 1
			debris(block.position, block.get_meta("color"), 5)
			if block.get_meta("banana", false):
				spawn_banana(block.position)
			blocks.erase(block)
			block.queue_free()
	for enemy in enemies.duplicate():
		var offset: Vector3 = enemy.position + Vector3.UP * 0.5 - origin
		if offset.length() < (4.5 if heavy else 3.2) and (heavy or offset.normalized().dot(direction) > 0.1):
			debris(enemy.position + Vector3.UP, Color("d76162"), 8)
			for i in range(3):
				spawn_banana(enemy.position + Vector3(i * 0.4 - 0.4, 1, 0))
			enemies.erase(enemy)
			enemy.queue_free()
			count += 1
	shake = 0.25 if heavy else 0.1
	tone(110 if count > 0 else 190, 0.12, 0.18)
	if count > 0:
		status_label.text = ("GROUND SMASH!" if heavy else "NICE BREAK!") + "  +%d" % count
		var tween := create_tween()
		status_label.modulate.a = 1
		tween.tween_property(status_label, "modulate:a", 0.0, 1.2)

func debris(pos: Vector3, color: Color, amount: int) -> void:
	for i in range(amount):
		var piece := box(self, pos, Vector3.ONE * rng.randf_range(0.15, 0.38), color)
		var destination := pos + Vector3(rng.randf_range(-2, 2), rng.randf_range(0.3, 2), rng.randf_range(-2, 2))
		var tween := create_tween().set_parallel(true)
		tween.tween_property(piece, "position", destination, 0.42).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tween.tween_property(piece, "rotation", Vector3(3, 2, 4), 0.6)
		tween.tween_property(piece, "scale", Vector3.ZERO, 0.6).set_delay(0.15)
		tween.chain().tween_callback(piece.queue_free)

func _process(delta: float) -> void:
	if Input.is_action_just_pressed("restart"):
		get_tree().reload_current_scene()
		return
	if finished:
		return
	elapsed += delta
	time_label.text = "%02d:%02d" % [int(elapsed) / 60, int(elapsed) % 60]
	for banana in bananas.duplicate():
		banana.rotation.y += delta * 1.6
		var base: float = banana.get_meta("base_y")
		# Freed bananas settle onto the first surface below them.
		var query := PhysicsRayQueryParameters3D.create(banana.position + Vector3.UP * 0.1, banana.position - Vector3.UP * 30)
		query.exclude = [player.get_rid()]
		var hit := get_world_3d().direct_space_state.intersect_ray(query)
		if not hit.is_empty():
			base = move_toward(base, hit.position.y + 1.1, delta * 5)
			banana.set_meta("base_y", base)
		banana.position.y = base + sin(elapsed * 3 + float(banana.get_meta("phase"))) * 0.12
		var distance: float = banana.position.distance_to(player.position + Vector3.UP)
		if distance < 2.3:
			banana.position = banana.position.move_toward(player.position + Vector3.UP, delta * 8)
		if distance < 1.3:
			bananas.erase(banana)
			banana.queue_free()
			score += 1
			tone(580 + (score % 5) * 100, 0.09, 0.12)
			refresh_ui()
			if score >= GOAL:
				win()
	for enemy in enemies:
		var home: Vector3 = enemy.get_meta("home")
		var phase: float = enemy.get_meta("phase")
		enemy.position = home + Vector3(sin(elapsed * 1.2 + phase) * 2, absf(sin(elapsed * 5 + phase)) * 0.15, cos(elapsed + phase) * 1.4)
		if enemy.position.distance_to(player.position) < 1.35 and player.invincible <= 0:
			hurt()
	shake = maxf(0, shake - delta)
	player.camera_pivot.position.x = rng.randf_range(-shake, shake)

func hurt() -> void:
	health -= 1
	player.invincible = 1.8
	player.velocity.y = 6
	shake = 0.35
	tone(85, 0.2, 0.16)
	if health <= 0:
		finished = true
		player.locked = true
		end_label.text = "TAKE A BREATHER\n\nBananas collected: %d / %d\n\nPress R to try again" % [score, GOAL]
		end_panel.show()
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	refresh_ui()

func respawn() -> void:
	player.position = Vector3(0, 2, 10)
	player.velocity = Vector3.ZERO
	player.slam = false
	if not finished:
		hurt()

func win() -> void:
	finished = true
	player.locked = true
	end_label.text = "BANANA BONANZA!\n\n%d bananas   /   %d blocks smashed\nTime: %02d:%02d\n\nPress R for another adventure" % [score, broken, int(elapsed) / 60, int(elapsed) % 60]
	end_panel.show()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func tone(frequency: float, duration: float, volume: float) -> void:
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = 22050
	var data := PackedByteArray()
	var samples := int(duration * 22050)
	data.resize(samples * 2)
	for i in range(samples):
		var envelope := pow(1.0 - float(i) / samples, 2)
		var value := int(sin(TAU * frequency * float(i) / 22050) * envelope * volume * 32767)
		data.encode_s16(i * 2, value)
	stream.data = data
	sounds.stream = stream
	sounds.play()

func label(parent: Node, text: String, font_size: int, color: Color) -> Label:
	var node := Label.new()
	node.text = text
	node.add_theme_font_size_override("font_size", font_size)
	node.add_theme_color_override("font_color", color)
	parent.add_child(node)
	return node

func panel(parent: Node, pos: Vector2, size: Vector2) -> PanelContainer:
	var node := PanelContainer.new()
	node.position = pos
	node.custom_minimum_size = size
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.04, 0.13, 0.15, 0.9)
	style.corner_radius_top_left = 18
	style.corner_radius_top_right = 18
	style.corner_radius_bottom_left = 18
	style.corner_radius_bottom_right = 18
	style.content_margin_left = 24
	style.content_margin_right = 24
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	node.add_theme_stylebox_override("panel", style)
	parent.add_child(node)
	return node

func build_ui() -> void:
	var canvas := CanvasLayer.new()
	add_child(canvas)
	var top := panel(canvas, Vector2(24, 22), Vector2(330, 138))
	var col := VBoxContainer.new()
	top.add_child(col)
	label(col, "B A N A N A   B R E A K", 22, Color("ffe16a"))
	label(col, "01  /  THE SUNLIT DIG", 13, Color("90c5bb"))
	score_label = label(col, "", 28, Color.WHITE)
	progress = ProgressBar.new()
	progress.custom_minimum_size.y = 7
	progress.max_value = GOAL
	progress.show_percentage = false
	col.add_child(progress)
	var info := panel(canvas, Vector2(1025, 22), Vector2(230, 100))
	var info_col := VBoxContainer.new()
	info.add_child(info_col)
	health_label = label(info_col, "", 20, Color("ff9e86"))
	time_label = label(info_col, "00:00", 24, Color.WHITE)
	var guide := panel(canvas, Vector2(24, 611), Vector2(790, 86))
	var guide_col := VBoxContainer.new()
	guide.add_child(guide_col)
	label(guide_col, "WASD  Move     SPACE  Jump     CLICK / J  Punch     E  Air smash", 18, Color("f5e9c8"))
	label(guide_col, "SHIFT  Run     MOUSE / Q C  Camera     ESC  Free cursor     R  Restart", 15, Color("99c4ba"))
	var objective := panel(canvas, Vector2(924, 611), Vector2(332, 86))
	var objective_col := VBoxContainer.new()
	objective.add_child(objective_col)
	label(objective_col, "SMASH. DISCOVER. COLLECT.", 16, Color("ffe16a"))
	label(objective_col, "Find 30 bananas inside the rocks!", 15, Color.WHITE)
	status_label = label(canvas, "", 28, Color("fff29e"))
	status_label.position = Vector2(450, 150)
	status_label.size.x = 380
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	end_panel = panel(canvas, Vector2(340, 225), Vector2(600, 260))
	end_label = label(end_panel, "", 26, Color("ffe16a"))
	end_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	end_panel.hide()
	refresh_ui()

func refresh_ui() -> void:
	score_label.text = "%02d / %d  BANANAS" % [score, GOAL]
	health_label.text = "ENERGY  " + "●".repeat(health) + "○".repeat(5 - health)
	progress.value = score
