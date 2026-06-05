import * as THREE from "three";

export interface UIPositionObject {
    top?: string;
    left?: string;
    bottom?: string;
    right?: string;
    transform?: string;
}

export interface HUDAnchor {
    parentId?: string | null;
    pos?: UIPositionObject;
}

export interface HUDViewportConstraint {
    horizontal?: 'free' | 'left' | 'center' | 'right';
    vertical?: 'free' | 'top' | 'center' | 'bottom';
    offsetX?: number;
    offsetY?: number;
}

export type UIPresetPosition = 
    | 'top-left' | 'top-center' | 'top-right' 
    | 'middle-left' | 'center' | 'middle-right' 
    | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type UIPosition = UIPresetPosition | UIPositionObject;

export interface HUDConfig {
    showHealth?: boolean;
    healthStyle?: 'bar' | 'hearts' | 'simple';
    healthPos?: UIPosition;
    healthOrientation?: 'horizontal' | 'vertical';
    healthWidth?: number;
    healthHeight?: number;
    healthShowText?: boolean;
    
    showJump?: boolean;
    jumpStyle?: 'bar' | 'circle';
    jumpPos?: UIPosition;
    jumpOrientation?: 'horizontal' | 'vertical';
    jumpWidth?: number;
    jumpHeight?: number;
    jumpShowText?: boolean;
    
    showInventory?: boolean;
    inventoryPos?: UIPosition;
    inventorySlots?: number;
    inventorySlotSize?: number;
    inventoryPadding?: number;
    inventoryContainerWidth?: number;
    inventoryContainerHeight?: number;
    inventoryFreeLayout?: boolean;
    inventorySlotAlignment?: string;
    inventorySlotPositions?: Record<number, { left: string; top: string }>;

    layerOrder?: string[];
    hudAnchors?: Record<string, HUDAnchor>;
    hudConstraints?: Record<string, HUDViewportConstraint>;
}

export interface FloatingTextItem {
    el: HTMLElement;
    pos3D: THREE.Vector3;
    life: number;
    maxLife: number;
}
