import * as THREE from "three";

export class PolygonModel {
  scene: any;
  isLocal: boolean;
  model: any;
  isVisible: boolean;
  polyRightArm: THREE.Group | null;
  polyLeftArm: THREE.Group | null;
  polyRightLeg: THREE.Group | null;
  polyLeftLeg: THREE.Group | null;

  constructor(scene: any, isLocal = true) {
    this.scene = scene;
    this.isLocal = isLocal;
    this.model = null;
    this.isVisible = false;

    // Body Parts
    this.polyRightArm = null;
    this.polyLeftArm = null;
    this.polyRightLeg = null;
    this.polyLeftLeg = null;

    this.createModel();
  }

  createModel() {
    this.model = new THREE.Group();
    this.model.userData.isPlayer = true;
    this.model.userData.isLocalPlayer = this.isLocal;
    this.model.visible = false;

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.9 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const shoesMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3c31, roughness: 1.0 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2 });

    const polyBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), shirtMat);
    polyBody.position.y = 0.35 + 0.7;
    polyBody.castShadow = true;
    this.model.add(polyBody);

    const polyHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
    polyHead.position.set(0, 0.35 + 0.2, 0);
    polyBody.add(polyHead);

    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.42), hairMat);
    hair.position.y = 0.2;
    polyHead.add(hair);

    const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 0.05, 0.2);
    polyHead.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 0.05, 0.2);
    polyHead.add(rightEye);

    this.polyRightArm = new THREE.Group();
    this.polyRightArm.position.set(0.35, 0.25, 0);
    polyBody.add(this.polyRightArm);

    const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skinMat);
    rArmMesh.position.y = -0.35;
    rArmMesh.castShadow = true;
    this.polyRightArm.add(rArmMesh);

    const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), shirtMat);
    rSleeve.position.y = -0.099;
    this.polyRightArm.add(rSleeve);

    this.polyLeftArm = new THREE.Group();
    this.polyLeftArm.position.set(-0.35, 0.25, 0);
    polyBody.add(this.polyLeftArm);

    const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), skinMat);
    lArmMesh.position.y = -0.35;
    lArmMesh.castShadow = true;
    this.polyLeftArm.add(lArmMesh);

    const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), shirtMat);
    lSleeve.position.y = -0.099;
    this.polyLeftArm.add(lSleeve);

    this.polyRightLeg = new THREE.Group();
    this.polyRightLeg.position.set(0.15, 0.7, 0);
    this.model.add(this.polyRightLeg);

    const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pantsMat);
    rLegMesh.position.y = -0.35;
    rLegMesh.castShadow = true;
    this.polyRightLeg.add(rLegMesh);

    const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.35), shoesMat);
    rShoe.position.y = -0.7 + 0.075;
    rShoe.position.z = 0.05;
    rShoe.castShadow = true;
    this.polyRightLeg.add(rShoe);

    this.polyLeftLeg = new THREE.Group();
    this.polyLeftLeg.position.set(-0.15, 0.7, 0);
    this.model.add(this.polyLeftLeg);

    const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pantsMat);
    lLegMesh.position.y = -0.35;
    lLegMesh.castShadow = true;
    this.polyLeftLeg.add(lLegMesh);

    const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.35), shoesMat);
    lShoe.position.y = -0.7 + 0.075;
    lShoe.position.z = 0.05;
    lShoe.castShadow = true;
    this.polyLeftLeg.add(lShoe);

    this.scene.add(this.model);
  }

  setVisible(visible: any) {
    this.isVisible = visible;
    if (this.model) {
      this.model.visible = visible;
    }
  }

  setPosition(pos: any) {
    if (this.model) {
      this.model.position.copy(pos);
    }
  }

  setRotation(rot: any) {
    if (this.model) {
      this.model.rotation.y = rot + Math.PI;
    }
  }

  getPosition() {
    return this.model ? this.model.position.clone() : new THREE.Vector3();
  }

  setHeldItem(item: any) {
    void item;
  }

  update(dt: any, isMoving: any) {
    if (!this.model || !this.isVisible) return;

    if (isMoving) {
      const speed = 10;
      const angle = Math.sin((Date.now() / 1000) * speed);

      if (this.polyRightArm) this.polyRightArm.rotation.x = angle;
      if (this.polyLeftArm) this.polyLeftArm.rotation.x = -angle;

      if (this.polyRightLeg) this.polyRightLeg.rotation.x = -angle;
      if (this.polyLeftLeg) this.polyLeftLeg.rotation.x = angle;
    } else {
      if (this.polyRightArm) this.polyRightArm.rotation.x = THREE.MathUtils.lerp(this.polyRightArm.rotation.x, 0, 0.1);
      if (this.polyLeftArm) this.polyLeftArm.rotation.x = THREE.MathUtils.lerp(this.polyLeftArm.rotation.x, 0, 0.1);
      if (this.polyRightLeg) this.polyRightLeg.rotation.x = THREE.MathUtils.lerp(this.polyRightLeg.rotation.x, 0, 0.1);
      if (this.polyLeftLeg) this.polyLeftLeg.rotation.x = THREE.MathUtils.lerp(this.polyLeftLeg.rotation.x, 0, 0.1);
    }
  }
}
