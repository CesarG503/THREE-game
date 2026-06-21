import { DEFAULT_POLYGON_SKIN_URL, getSelectedSkin } from "../platform/skinPreferences";
import { getStoredAuth } from "../platform/auth";
import { normalizeGravityOrientation } from "../utils/GravityOrientation";

const DEFAULT_VISUAL_RULE = {
    type: "none",
    color: "#ffffff",
    aura: "soft"
};

export class PlayerConfigManager {
    game: any;
    profiles: any[];
    currentProfileId: string;
    assignments: any;

    constructor(game: any) {
        this.game = game;
        this.profiles = [
            {
                id: "default",
                name: "Jugador Estándar",
                maxHealth: 100,
                speed: 10,
                jumpForce: 10,
                respawns: -1,
                color: "#ffffff",
                canFly: false,
                maxMultiJumps: 1,
                jumpAnimationType: "none",
                fallAnimationType: "none",
                playerCollision: "push",
                gravityOrientation: "down",
                gravityTransitionDuration: 0.65,
                skinMode: "player",
                skinUrl: DEFAULT_POLYGON_SKIN_URL,
                skinAssetId: null,
                roleVisual: createRoleVisual(),
                statModes: {},
                hudSettings: {
                    showHealth: true,
                    healthStyle: "bar",
                    healthPos: {
                        left: "33.63%",
                        top: "96.99%"
                    },
                    healthShowText: false,
                    healthOrientation: "horizontal",
                    healthWidth: 515,
                    healthHeight: 5,
                    showJump: true,
                    jumpStyle: "bar",
                    jumpPos: {
                        left: "33.69%",
                        top: "95.88%"
                    },
                    jumpShowText: false,
                    jumpOrientation: "horizontal",
                    jumpWidth: 277,
                    jumpHeight: 5,
                    showInventory: true,
                    inventorySlots: 9,
                    inventoryPos: {
                        left: "31.50%",
                        top: "88.17%"
                    },
                    inventorySlotSize: 50,
                    inventoryPadding: 10,
                    inventoryFreeLayout: false,
                    inventorySlotPositions: [],
                    inventorySlotAlignment: "top-center",
                    layerOrder: [
                        "health",
                        "jump",
                        "inventory"
                    ],
                    inventoryContainerWidth: 592,
                    inventoryContainerHeight: 94,
                    hudAnchors: {
                        jump: {
                            parentId: "inventory",
                            pos: {
                                left: "5.912%",
                                top: "73.620%"
                            }
                        },
                        health: {
                            parentId: "inventory",
                            pos: {
                                left: "5.743%",
                                top: "84.259%"
                            }
                        }
                    },
                    hudConstraints: {
                        inventory: {
                            horizontal: "center",
                            vertical: "free",
                            offsetX: 0,
                            offsetY: 0
                        }
                    }
                }
            },
            {
                id: "admin_tester",
                name: "ADMIN tester",
                maxHealth: 1000,
                speed: 20,
                jumpForce: 10,
                respawns: -1,
                color: "#ff0000",
                canFly: true,
                maxMultiJumps: 1,
                jumpAnimationType: "none",
                fallAnimationType: "none",
                playerCollision: "push",
                gravityOrientation: "down",
                gravityTransitionDuration: 0.65,
                skinMode: "player",
                skinUrl: DEFAULT_POLYGON_SKIN_URL,
                skinAssetId: null,
                roleVisual: createRoleVisual(),
                statModes: {},
                hudSettings: {
                    showHealth: true,
                    healthStyle: "bar",
                    healthPos: {
                        left: "33.63%",
                        top: "96.99%"
                    },
                    healthShowText: false,
                    healthOrientation: "horizontal",
                    healthWidth: 515,
                    healthHeight: 5,
                    showJump: true,
                    jumpStyle: "bar",
                    jumpPos: {
                        left: "33.69%",
                        top: "95.88%"
                    },
                    jumpShowText: false,
                    jumpOrientation: "horizontal",
                    jumpWidth: 277,
                    jumpHeight: 5,
                    showInventory: true,
                    inventorySlots: 9,
                    inventoryPos: {
                        left: "31.50%",
                        top: "88.17%"
                    },
                    inventorySlotSize: 50,
                    inventoryPadding: 10,
                    inventoryFreeLayout: false,
                    inventorySlotPositions: [],
                    inventorySlotAlignment: "top-center",
                    layerOrder: [
                        "health",
                        "jump",
                        "inventory"
                    ],
                    inventoryContainerWidth: 592,
                    inventoryContainerHeight: 94,
                    hudAnchors: {
                        jump: {
                            parentId: "inventory",
                            pos: {
                                left: "5.912%",
                                top: "73.620%"
                            }
                        },
                        health: {
                            parentId: "inventory",
                            pos: {
                                left: "5.743%",
                                top: "84.259%"
                            }
                        }
                    },
                    hudConstraints: {
                        inventory: {
                            horizontal: "center",
                            vertical: "free",
                            offsetX: 0,
                            offsetY: 0
                        }
                    }
                }
            }
        ];
        this.currentProfileId = "admin_tester";
        this.assignments = {
            mode: "all",
            defaultProfileId: "admin_tester",
            teamProfiles: {},
            playerProfiles: {}
        };

        if (this.game && this.game.character) {
            this.applyConfiguration();
        }
    }

    getProfiles() {
        return this.profiles;
    }

    getProfile(id: string) {
        return this.profiles.find(p => p.id === id);
    }

    addProfile(name: string) {
        const generateUUID = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); });
        const newProfile = {
            id: generateUUID(),
            name: name || "Nuevo Perfil",
            maxHealth: 100,
            speed: 10,
            jumpForce: 10,
            respawns: -1,
            color: "#" + Math.floor(Math.random() * 16777215).toString(16),
            canFly: false,
            maxMultiJumps: 1,
            jumpAnimationType: "none",
            fallAnimationType: "none",
            playerCollision: "push",
            gravityOrientation: "down",
            gravityTransitionDuration: 0.65,
            skinMode: "player",
            skinUrl: DEFAULT_POLYGON_SKIN_URL,
            skinAssetId: null,
            roleVisual: createRoleVisual(undefined, {
                ...DEFAULT_VISUAL_RULE,
                color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")
            }),
            statModes: {},
            hudSettings: {
                showHealth: true,
                healthStyle: "bar",
                healthPos: {
                    left: "33.63%",
                    top: "96.99%"
                },
                healthShowText: false,
                healthOrientation: "horizontal",
                healthWidth: 515,
                healthHeight: 5,
                showJump: true,
                jumpStyle: "bar",
                jumpPos: {
                    left: "33.69%",
                    top: "95.88%"
                },
                jumpShowText: false,
                jumpOrientation: "horizontal",
                jumpWidth: 277,
                jumpHeight: 5,
                showInventory: true,
                inventorySlots: 9,
                inventoryPos: {
                    left: "31.50%",
                    top: "88.17%"
                },
                inventorySlotSize: 50,
                inventoryPadding: 10,
                inventoryFreeLayout: false,
                inventorySlotPositions: [],
                inventorySlotAlignment: "top-center",
                layerOrder: [
                    "health",
                    "jump",
                    "inventory"
                ],
                inventoryContainerWidth: 592,
                inventoryContainerHeight: 94,
                hudAnchors: {
                    jump: {
                        parentId: "inventory",
                        pos: {
                            left: "5.912%",
                            top: "73.620%"
                        }
                    },
                    health: {
                        parentId: "inventory",
                        pos: {
                            left: "5.743%",
                            top: "84.259%"
                        }
                    }
                },
                hudConstraints: {
                    inventory: {
                        horizontal: "center",
                        vertical: "free",
                        offsetX: 0,
                        offsetY: 0
                    }
                }
            }
        };
        this.profiles.push(newProfile);
        this.broadcastUpdate();
        return newProfile;
    }

    removeProfile(id: string) {
        if (id === "default") return false;
        const idx = this.profiles.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.profiles.splice(idx, 1);
            if (this.assignments.defaultProfileId === id) {
                this.assignments.defaultProfileId = "default";
            }
            this.broadcastUpdate();
            return true;
        }
        return false;
    }

    updateProfile(id: string, data: any) {
        const profile = this.getProfile(id);
        if (profile) {
            Object.assign(profile, data);
            this.applyConfiguration();
            this.broadcastUpdate();
        }
    }

    setTeamProfile(teamId: string, profileId: string) {
        this.assignments.teamProfiles[teamId] = profileId;
        console.log(`Team ${teamId} assigned to profile ${profileId}`);
        this.broadcastUpdate();
    }

    setDefaultProfile(profileId: string) {
        this.assignments.defaultProfileId = profileId;
        console.log(`Default profile assigned to ${profileId}`);
        this.broadcastUpdate();
    }

    setPlayerProfile(playerId: string, profileId: string) {
        if (!this.assignments.playerProfiles) this.assignments.playerProfiles = {};
        this.assignments.playerProfiles[playerId] = profileId;
        console.log(`Player ${playerId} assigned to profile ${profileId}`);
        this.broadcastUpdate();
    }

    getAssignments() {
        return this.assignments;
    }

    getCurrentProfile() {
        let profileToApply = this.getProfile("default");

        if (this.assignments.mode === "all") {
            const p = this.getProfile(this.assignments.defaultProfileId);
            if (p) profileToApply = p;
        } else if (this.assignments.mode === "random") {
            profileToApply = this.profiles[Math.floor(Math.random() * this.profiles.length)];
        }

        if (this.assignments.playerProfiles && this.game && this.game.networkManager && this.game.networkManager.playerId) {
            const myId = this.game.networkManager.playerId;
            const explicitProfileId = this.assignments.playerProfiles[myId];
            if (explicitProfileId) {
                const explicitP = this.getProfile(explicitProfileId);
                if (explicitP) profileToApply = explicitP;
            }
        }

        return profileToApply;
    }

    applyConfiguration() {
        if (!this.game.character) return;

        const profileToApply = this.getCurrentProfile();

        if (profileToApply) {
            this.applyToCharacter(this.game.character, profileToApply);
        }
    }

    applyToCharacter(character: any, profile: any) {
        if (!character) return;

        console.log("Applying Profile:", profile.name);

        if (character.setStats) {
            character.setStats({
                speed: profile.speed,
                jumpForce: profile.jumpForce,
                maxHealth: profile.maxHealth,
                respawns: profile.respawns,
                canFly: profile.canFly,
                maxMultiJumps: profile.maxMultiJumps,
                jumpAnimationType: profile.jumpAnimationType,
                fallAnimationType: profile.fallAnimationType,
                playerCollision: profile.playerCollision,
                gravityOrientation: normalizeGravityOrientation(profile.gravityOrientation),
                gravityTransitionDuration: profile.gravityTransitionDuration
            });
        } else {
            character.speed = profile.speed;
            character.jumpForce = profile.jumpForce;
        }

        if (this.game.hud && profile.hudSettings) {
            this.game.hud.createHUD(profile.hudSettings);

            if (character.currentHealth !== undefined) {
                this.game.hud.updateHealth(character.currentHealth, character.maxHealth);
            }
            if (character.maxMultiJumps !== undefined) {
                const jumpsLeft = character.maxMultiJumps - (character.jumpCount || 0);
                this.game.hud.updateJump(jumpsLeft, character.maxMultiJumps);
            }
        }

        const selectedSkin = getSelectedSkin(getStoredAuth());
        const useRoleSkin = profile.skinMode === "role";
        const skinUrl = useRoleSkin ? (profile.skinUrl || DEFAULT_POLYGON_SKIN_URL) : selectedSkin.url;
        character.activeSkinAssetId = useRoleSkin ? (profile.skinAssetId || null) : (selectedSkin.assetId || null);
        character.activeRoleId = profile.id;
        character.activeRoleName = profile.name;
        if (character.polygonModelSkin && character.polygonModelSkin.setSkinUrl) {
            character.polygonModelSkin.setSkinUrl(skinUrl);
        }

        character.roleVisual = normalizeRoleVisual(profile.roleVisual);
        if (character.polygonModelSkin && character.polygonModelSkin.setRoleVisual) {
            character.polygonModelSkin.setRoleVisual(character.roleVisual.sameRole);
        }
    }

    saveData() {
        return {
            profiles: this.profiles,
            assignments: this.assignments
        };
    }

    loadData(data: any) {
        if (!data) return;
        if (data.profiles) {
            this.profiles = data.profiles.map((profile: any) => ({
                skinMode: "player",
                skinUrl: DEFAULT_POLYGON_SKIN_URL,
                skinAssetId: null,
                roleVisual: createRoleVisual(),
                gravityOrientation: "down",
                gravityTransitionDuration: 0.65,
                ...profile
            }));
        }
        if (data.assignments) this.assignments = data.assignments;
        console.log("Player Config Loaded", this.profiles);
    }

    broadcastUpdate() {
        if (this.game && this.game.networkManager) {
            this.game.networkManager.sendPlayerConfigUpdate(this.saveData());
        }
    }
}

function normalizeRoleVisual(value: any) {
    const visual = value && typeof value === "object" ? value : {};
    if (visual.sameRole || visual.otherRole) {
        return {
            sameRole: normalizeVisualRule(visual.sameRole),
            otherRole: normalizeVisualRule(visual.otherRole)
        };
    }
    const legacy = normalizeVisualRule(visual);
    return {
        sameRole: { ...legacy },
        otherRole: { ...legacy }
    };
}

function normalizeVisualRule(value: any) {
    const visual = value && typeof value === "object" ? value : {};
    return {
        type: ["none", "color", "aura", "color_aura", "outline"].includes(visual.type) ? visual.type : "none",
        color: typeof visual.color === "string" ? visual.color : "#ffffff",
        aura: ["soft", "pulse", "ring"].includes(visual.aura) ? visual.aura : "soft"
    };
}

function createRoleVisual(sameRole?: any, otherRole?: any) {
    return {
        sameRole: normalizeVisualRule(sameRole || DEFAULT_VISUAL_RULE),
        otherRole: normalizeVisualRule(otherRole || DEFAULT_VISUAL_RULE)
    };
}
