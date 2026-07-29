import * as THREE from "three";

export class MapMaterialCache {
  private static materialCache = new Map<string, THREE.Material>();

  /**
   * Retrieves a cached material or creates it using the factory function.
   */
  public static getMaterial(key: string, createFn: () => THREE.Material): THREE.Material {
    const cached = this.materialCache.get(key);
    if (cached) {
      return cached;
    }

    const material = createFn();
    this.materialCache.set(key, material);
    return material;
  }

  /**
   * Clears all cached materials and disposes them.
   */
  public static clearCache() {
    this.materialCache.forEach((material) => {
      material.dispose();
    });
    this.materialCache.clear();
  }
}
