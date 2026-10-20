extends SceneTree

var game: Node3D
var failures := 0

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, description: String) -> void:
	if condition:
		print("PASS: " + description)
	else:
		push_error("FAIL: " + description)
		failures += 1

func run() -> void:
	game = load("res://main.tscn").instantiate()
	root.add_child(game)
	await create_timer(0.5).timeout
	check(game.blocks.size() > 100, "destructible island generated")
	var available: int = game.bananas.size() + game.enemies.size() * 3
	for block in game.blocks:
		if block.get_meta("banana", false):
			available += 1
	check(available >= game.GOAL, "enough bananas to finish: %d" % available)
	check(game.player.is_on_floor(), "player lands on island")
	Input.action_press("jump")
	await physics_frame
	await physics_frame
	Input.action_release("jump")
	check(game.player.velocity.y > 0, "jump gives upward velocity")
	Input.action_press("slam")
	await physics_frame
	await physics_frame
	Input.action_release("slam")
	check(game.player.slam or game.player.cooldown > 0, "air smash activates")
	await create_timer(0.4).timeout
	check(not game.player.slam, "air smash resolves on landing")
	var before: int = game.blocks.size()
	var target: Vector3 = game.blocks[0].position
	game.on_attack(target + Vector3(0, 0, 2), Vector3.FORWARD, false)
	check(game.blocks.size() < before, "directional punch destroys blocks")
	before = game.blocks.size()
	game.on_attack(Vector3(0, 1, -6), Vector3.DOWN, true)
	check(game.blocks.size() < before, "ground smash destroys nearby terrain")
	game.spawn_banana(game.player.position + Vector3.UP)
	await create_timer(0.1).timeout
	check(game.score > 0, "nearby banana is collected")
	var enemy_count: int = game.enemies.size()
	game.on_attack(game.enemies[0].position, Vector3.DOWN, true)
	check(game.enemies.size() < enemy_count, "enemy defeated by smash")
	game.player.position.y = -15
	await create_timer(0.1).timeout
	check(game.player.position.y > 0 and game.health == 4, "fall respawns player and costs energy")
	game.score = game.GOAL - 1
	game.spawn_banana(game.player.position + Vector3.UP)
	await create_timer(0.1).timeout
	check(game.finished and game.end_panel.visible, "goal displays victory")
	game.finished = false
	game.health = 1
	game.hurt()
	check(game.finished and game.health == 0, "energy depletion ends game")
	game.queue_free()
	await process_frame
	game = load("res://main.tscn").instantiate()
	root.add_child(game)
	await create_timer(0.1).timeout
	check(game.health == 5 and game.score == 0 and not game.finished, "restart resets gameplay state")
	print("SMOKE TEST COMPLETE: %d failures" % failures)
	game.queue_free()
	await process_frame
	await process_frame
	quit(failures)
