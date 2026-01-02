import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class DroppedItem {
    constructor(scene, world, item, position) {
        this.scene = scene;
        this.world = world;
        this.item = item;
        this.isCollected = false;

        // Visuals
        this.mesh = new THREE.Group();

        // Contenedor visual para animacion (flotar/rotar)
        this.visualContainer = new THREE.Group();
        this.mesh.add(this.visualContainer);

        // Obtener la representacion visual del item
        const itemMesh = item.getDisplayMesh();
        if (itemMesh) {
            // Clonar para no afectar el original si es un asset compartido
            const clone = itemMesh.clone();
            clone.castShadow = true;

            // Centrar geometria si es necesario, o escalar
            this.visualContainer.add(clone);
        } else {
            // Placeholder: Cubo simple si no hay malla
            const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
            const mat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
            const cube = new THREE.Mesh(geo, mat);
            this.visualContainer.add(cube);
        }

        this.scene.add(this.mesh);

        // Physics Logic
        // Cuerpo dinamico para que caiga al suelo
        let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z)
            .setLinearDamping(1.0) // Un poco de friccion en el aire
            .setAngularDamping(1.0);

        this.rigidBody = this.world.createRigidBody(rigidBodyDesc);

        // Collider esferico para fisica fisica
        let colliderDesc = RAPIER.ColliderDesc.ball(0.3)
            .setRestitution(0.5)
            .setFriction(1.0);

        this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

        // Animation state
        this.timeOffset = Math.random() * 100;
    }

    update(dt, time) {
        if (this.isCollected) return;

        // Sincronizar posicion visual con fisica
        const pos = this.rigidBody.translation();
        this.mesh.position.set(pos.x, pos.y, pos.z);

        // Efecto Minecraft: Flotar y Rotar (Visual only)
        // La fisica maneja la posicion base (suelo), el visual flota relativo a eso

        // Rotacion continua
        this.visualContainer.rotation.y = time * 1.5;

        // Flotar (Bobbing)
        // Offset Y sinusoidal. 
        // Nota: Si el collider es una esfera de 0.3, el centro esta a 0.3 del suelo.
        // Queremos que flote un poco mas arriba visualmente?
        const bob = Math.sin(time * 3.0 + this.timeOffset) * 0.1;
        this.visualContainer.position.y = bob + 0.2; // +0.2 offset base
    }

    dispose() {
        this.scene.remove(this.mesh);
        if (this.collider) this.world.removeCollider(this.collider, false);
        if (this.rigidBody) this.world.removeRigidBody(this.rigidBody);
        this.isCollected = true;
    }
}
