import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let template: Promise<THREE.Group> | null = null;
export interface MotorbikeVisual extends THREE.Group {
  resizeMotorbike: (size: { x: number; y: number; z: number }) => void;
  animateMotorbike: (distance: number, steering: number, lean: number) => void;
}

export function createMotorbikeModel(size: { x: number; y: number; z: number }): MotorbikeVisual {
  const root = new THREE.Group() as MotorbikeVisual;
  const suspension = new THREE.Group();
  const fitted = new THREE.Group();
  root.add(suspension);
  suspension.add(fitted);
  // A visible loading marker also makes placement/selecting possible before the GLB arrives.
  const placeholder = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x4d91aa, wireframe: true }));
  root.add(placeholder);
  let dimensions = { ...size };
  let boundsSize: THREE.Vector3 | null = null;
  let front: THREE.Object3D | undefined;
  let rear: THREE.Object3D | undefined;
  let frontRest = new THREE.Quaternion();
  let rearRest = new THREE.Quaternion();
  let wheelAngle = 0;
  root.resizeMotorbike = (next) => {
    dimensions = { ...next };
    placeholder.scale.set(next.x, next.y, next.z);
    if (boundsSize) fitted.scale.set(next.x / boundsSize.x, next.y / boundsSize.y, next.z / boundsSize.z);
  };
  root.resizeMotorbike(dimensions);
  root.animateMotorbike = (distance, steering, lean) => {
    suspension.rotation.z = lean;
    wheelAngle = (wheelAngle - distance / Math.max(0.1, dimensions.y * 0.22)) % (Math.PI * 2);
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), wheelAngle);
    if (rear) rear.quaternion.copy(rearRest).multiply(spin);
    if (front) front.quaternion.copy(frontRest)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), steering * 0.35))
      .multiply(spin);
  };
  if (!template) {
    template = new GLTFLoader().loadAsync('/assets/vehiculos/Motorbike.glb').then(gltf => gltf.scene).catch(error => {
      template = null;
      throw error;
    });
  }
  void template.then(source => {
    const model = clone(source);
    // Instance-owned resources allow map deletion without disposing another motorcycle.
    model.traverse((child: any) => {
      if (!child.isMesh) return;
      child.geometry = child.geometry.clone();
      child.material = Array.isArray(child.material) ? child.material.map((m: THREE.Material) => m.clone()) : child.material.clone();
      child.castShadow = child.receiveShadow = true;
    });
    const box = new THREE.Box3().setFromObject(model);
    boundsSize = box.getSize(new THREE.Vector3()).max(new THREE.Vector3(0.001, 0.001, 0.001));
    model.position.sub(box.getCenter(new THREE.Vector3()));
    fitted.add(model);
    model.traverse(node => {
      if (/^FrontWheel/i.test(node.name)) front = node;
      if (/^RearWheel/i.test(node.name)) rear = node;
    });
    if (front) frontRest.copy(front.quaternion);
    if (rear) rearRest.copy(rear.quaternion);
    root.resizeMotorbike(dimensions);
    root.remove(placeholder);
    placeholder.geometry.dispose();
    placeholder.material.dispose();
    root.userData.motorbikeLoaded = true;
  }).catch(error => {
    placeholder.material.color.setHex(0xef4444);
    console.error('No se pudo cargar Motorbike.glb', error);
  });
  return root;
}
