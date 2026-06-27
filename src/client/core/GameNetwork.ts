import * as THREE from "three";
import { Projectile } from "../weapons/Projectile";

export function setupMultiplayerUI(this: any) {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const hostname = window.location.hostname || "localhost";
	const defaultWsUrl = `${protocol}//${hostname}:8080`;

	setTimeout(() => {
		if (!this.networkManager.isConnected) {
			console.log("[Auto-Connect] Uniendo a la sala...");
			this.networkManager.connect(defaultWsUrl);
		}
	}, 1000);
}

export function updateConnectionStatus(this: any, connected: boolean, playerId: string | null = null) {
	void this;
	void connected;
	void playerId;
}

export function handleRemoteShoot(this: any, startPos: any, direction: any, type: any, speed: any, damage: any, drop: any, rebote: any, hasImpactEffect: any, hasTracer = false, hasTrajectoryLine = false, customTracerVFX = "Ninguno", customImpactVFX = "Ninguno", tracerDestroyOnCollision = false, tracerStayForever = false, tracerCollisionVFX = "Ninguno", shooterPlayerId: any = null) {
	if (!this.sceneManager || !this.world) return;

	const projectileType = type || "bullet";
	const projectileSpeed = speed !== undefined ? speed : 50;
	const projectileDrop = drop !== undefined ? drop : 1.0;
	const tracerSpeed = projectileType === "bullet" ? projectileSpeed * 3.0 : projectileSpeed;
	const tracerLength = THREE.MathUtils.clamp(Math.max(tracerSpeed, 0) * 0.05, 0.5, 10.0);
	let tempTracer = null;
	const blaster = this.fxBlasterSystem;

	if ((projectileType === "bullet" || hasTracer) && this.sceneManager.scene && blaster) {
		const tracer = blaster.CreateParticle();
		tracer.Start.copy(startPos);

		const dirVec = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
		tracer.End = dirVec.clone().multiplyScalar(tracerLength).add(startPos);
		tracer.Velocity = dirVec.clone().multiplyScalar(tracerSpeed);

		tracer.Colours = [new THREE.Color(0xffff88), new THREE.Color(0xffaa00)];
		tracer.Length = tracerLength;
		tracer.Life = 0.5;
		tracer.TotalLife = 0.5;
		tracer.Width = 0.05;
		tempTracer = tracer;
	}

	const proj = new Projectile(
		this.sceneManager.scene,
		this.world,
		new THREE.Vector3(startPos.x, startPos.y, startPos.z),
		new THREE.Vector3(direction.x, direction.y, direction.z),
		projectileSpeed,
		damage || 10,
		projectileDrop,
		projectileType,
		rebote || false,
		hasImpactEffect || false,
		customTracerVFX,
		customImpactVFX,
		tracerCollisionVFX
	);
	proj.hasTracer = hasTracer;
	proj.hasTrajectoryLine = hasTrajectoryLine;
	proj.blasterSystem = blaster;
	proj.particleSystem = this.character ? this.character.particleSystem : null;
	proj.initialTracer = tempTracer;
	proj.isRemoteBlaster = false;
	proj.tracerDestroyOnCollision = tracerDestroyOnCollision;
	proj.tracerStayForever = tracerStayForever;
	proj.tracerCollisionVFX = tracerCollisionVFX;
	proj.ownerColliderHandle = shooterPlayerId ? (this.networkManager?.remotePlayers?.get(shooterPlayerId)?.collider?.handle ?? null) : null;

	this.projectiles.push(proj);
}
