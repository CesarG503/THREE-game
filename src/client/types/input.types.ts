export type InputManagerKey = "forward" | "backward" | "left" | "right" | "jump" | "crouch" | "attack" | "aim";

export interface InputState {
	forward: boolean;
	backward: boolean;
	left: boolean;
	right: boolean;
	jump: boolean;
	crouch: boolean;
	attack: boolean;
	aim: boolean;
}

export interface InputBinding {
	key: InputManagerKey;
	code?: string;
	mouseButton?: number;
}

export interface InputManagerOptions {
	enabled?: boolean;
	pauseEvents?: boolean;
}

export type InputEvent = KeyboardEvent | MouseEvent;
