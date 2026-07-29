import * as THREE from "three";

export class MapAssetManager {
  private static textureLoader = new THREE.TextureLoader();
  private static textureCache = new Map<string, THREE.Texture>();
  private static loadingPromises = new Map<string, Promise<THREE.Texture>>();

  /**
   * Loads a texture from the given URL, reusing cached instances.
   */
  public static loadTexture(url: string): Promise<THREE.Texture> {
    if (!url) {
      return Promise.reject(new Error("URL is empty"));
    }

    const cached = this.textureCache.get(url);
    if (cached) {
      return Promise.resolve(cached);
    }

    const pending = this.loadingPromises.get(url);
    if (pending) {
      return pending;
    }

    const promise = new Promise<THREE.Texture>((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          this.textureCache.set(url, texture);
          this.loadingPromises.delete(url);
          resolve(texture);
        },
        undefined,
        (err) => {
          this.loadingPromises.delete(url);
          reject(err);
        }
      );
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  /**
   * Clears cached textures and disposes them to free GPU memory.
   */
  public static clearCache() {
    this.textureCache.forEach((texture) => {
      texture.dispose();
    });
    this.textureCache.clear();
    this.loadingPromises.clear();
  }
}
