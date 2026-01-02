export class Item {
    constructor(id, name, iconPath) {
        this.id = id;
        this.name = name;
        this.iconPath = iconPath;
        this.count = 1;
        this.maxStack = 64;
    }

    /**
     * Accion al usar el item en la mano (Click izquierdo)
     * @param {Object} context - Contexto del juego (scene, world, position, etc)
     * @returns {boolean} - True si se consumio el item
     */
    use(context) {
        console.log("Usando item base:", this.name);
        return false;
    }

    /**
     * Retorna la malla o geometria para renderizar cuando se tira al suelo
     * @returns {THREE.Object3D|null}
     */
    getDisplayMesh() {
        return null;
    }
}
