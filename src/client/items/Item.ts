import type { Object3D } from "three";
import type { ItemContext, ItemLike } from "../types";

export class Item implements ItemLike {
  id: string;
  name: string;
  iconPath: string;
  count: number;
  maxStack: number;

  constructor(id: string, name: string, iconPath: string) {
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
  use(context: ItemContext) {
    console.log("Usando item base:", this.name);
    return false;
  }

  /**
   * Retorna la malla o geometria para renderizar cuando se tira al suelo
   * @returns {any}
   */
  getDisplayMesh(): Object3D | null {
    return null;
  }
}
