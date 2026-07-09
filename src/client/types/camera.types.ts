import * as THREE from "three";

export type CameraMode = 'first-person' | 'third-person-free' | 'third-person-collision' | 'free-fly';

export interface CameraState {
    isFirstPerson: boolean;
    isPaused: boolean;
    isUIOpen: boolean;
}

export interface CameraConfig {
    thirdPersonDistance: number;
    thirdPersonHeight: number;
    alwaysRotateThirdPerson: boolean;
    minDistance: number;
    maxDistance: number;
    rotationSpeed: number;
    smoothing: number;
    fpInvertAxisX: boolean;
    fpInvertAxisY: boolean;
    tpInvertAxisX: boolean;
    tpInvertAxisY: boolean;
}

export interface CameraModeEventDetail {
    isFirstPerson: boolean;
    cameraMode?: CameraMode;
}

export interface CameraPauseEventDetail {
    isPaused: boolean;
    isFirstPerson: boolean;
    fpInvertAxisX: boolean;
    fpInvertAxisY: boolean;
    tpInvertAxisX: boolean;
    tpInvertAxisY: boolean;
}
