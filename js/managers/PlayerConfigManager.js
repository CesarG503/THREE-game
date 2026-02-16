export class PlayerConfigManager {
    constructor(game) {
        this.game = game;
        this.profiles = [
            {
                id: 'default',
                name: 'Jugador Estándar',
                maxHealth: 100,
                speed: 10,
                jumpForce: 10,
                respawns: -1, // -1 = Infinite
                color: '#ffffff',
                canFly: false,
                maxMultiJumps: 1,
                jumpAnimationType: 'none',
                fallAnimationType: 'none',
                statModes: {}, // key -> 'standard' | 'free'
                hudSettings: {
                    showHealth: true,
                    healthStyle: 'bar',
                    healthPos: {
                        left: '36.72%',
                        top: '96.89%'
                    },
                    healthShowText: false,
                    healthOrientation: 'horizontal',
                    healthWidth: 515,
                    healthHeight: 5,
                    showJump: true,
                    jumpStyle: 'bar',
                    jumpPos: {
                        left: '36.78%',
                        top: '95.75%'
                    },
                    jumpShowText: false,
                    jumpOrientation: 'horizontal',
                    jumpWidth: 283,
                    jumpHeight: 6,
                    showInventory: true,
                    inventorySlots: 9,
                    inventoryPos: {
                        left: '35.98%',
                        top: '89.51%'
                    },
                    inventorySlotSize: 50,
                    inventoryPadding: 10,
                    inventoryFreeLayout: false,
                    inventorySlotPositions: [],
                    inventorySlotAlignment: 'top-center',
                    layerOrder: [
                        'health',
                        'jump',
                        'inventory'
                    ],
                    inventoryContainerWidth: 553,
                    inventoryContainerHeight: 93
                }
            },
            {
                id: 'admin_tester',
                name: 'ADMIN tester',
                maxHealth: 1000,
                speed: 20,
                jumpForce: 10,
                respawns: -1,
                color: '#ff0000',
                canFly: true,
                maxMultiJumps: 0,
                jumpAnimationType: 'none',
                fallAnimationType: 'none',
                statModes: {},
                hudSettings: {
                    showHealth: true,
                    healthStyle: 'bar',
                    healthPos: {
                        left: '36.72%',
                        top: '96.89%'
                    },
                    healthShowText: false,
                    healthOrientation: 'horizontal',
                    healthWidth: 515,
                    healthHeight: 5,
                    showJump: true,
                    jumpStyle: 'bar',
                    jumpPos: {
                        left: '36.78%',
                        top: '95.75%'
                    },
                    jumpShowText: false,
                    jumpOrientation: 'horizontal',
                    jumpWidth: 283,
                    jumpHeight: 6,
                    showInventory: true,
                    inventorySlots: 9,
                    inventoryPos: {
                        left: '35.98%',
                        top: '89.51%'
                    },
                    inventorySlotSize: 50,
                    inventoryPadding: 10,
                    inventoryFreeLayout: false,
                    inventorySlotPositions: [],
                    inventorySlotAlignment: 'top-center',
                    layerOrder: [
                        'health',
                        'jump',
                        'inventory'
                    ],
                    inventoryContainerWidth: 553,
                    inventoryContainerHeight: 93
                }
            }
        ];
        this.currentProfileId = 'admin_tester'; // Default to admin for editor
        this.assignments = {
            mode: 'all', // 'all', 'random', 'team'
            defaultProfileId: 'admin_tester',
            teamProfiles: {} // teamId -> profileId
        };

        // Auto-apply on potential reload or late load
        if (this.game && this.game.character) {
            this.applyConfiguration();
        }
    }

    getProfiles() {
        return this.profiles;
    }

    getProfile(id) {
        return this.profiles.find(p => p.id === id);
    }

    addProfile(name) {
        const newProfile = {
            id: crypto.randomUUID(),
            name: name || "Nuevo Perfil",
            maxHealth: 100,
            speed: 10,
            jumpForce: 10,
            respawns: -1,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            canFly: false,
            maxMultiJumps: 1,
            jumpAnimationType: 'none',
            fallAnimationType: 'none',
            statModes: {},
            hudSettings: {
                showHealth: true,
                healthStyle: 'bar',
                healthPos: {
                    left: '36.72%',
                    top: '96.89%'
                },
                healthShowText: false,
                healthOrientation: 'horizontal',
                healthWidth: 515,
                healthHeight: 5,
                showJump: true,
                jumpStyle: 'bar',
                jumpPos: {
                    left: '36.78%',
                    top: '95.75%'
                },
                jumpShowText: false,
                jumpOrientation: 'horizontal',
                jumpWidth: 283,
                jumpHeight: 6,
                showInventory: true,
                inventorySlots: 9,
                inventoryPos: {
                    left: '35.98%',
                    top: '89.51%'
                },
                inventorySlotSize: 50,
                inventoryPadding: 10,
                inventoryFreeLayout: false,
                inventorySlotPositions: [],
                inventorySlotAlignment: 'top-center',
                layerOrder: [
                    'health',
                    'jump',
                    'inventory'
                ],
                inventoryContainerWidth: 553,
                inventoryContainerHeight: 93
            }
        };
        this.profiles.push(newProfile);
        return newProfile;
    }

    removeProfile(id) {
        if (id === 'default') return false; // Cannot delete default
        const idx = this.profiles.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.profiles.splice(idx, 1);
            // Re-assign default if verified
            if (this.assignments.defaultProfileId === id) {
                this.assignments.defaultProfileId = 'default';
            }
            return true;
        }
        return false;
    }

    updateProfile(id, data) {
        const profile = this.getProfile(id);
        if (profile) {
            Object.assign(profile, data);
            this.applyConfiguration(); // Auto-apply changes if live?
        }
    }

    setTeamProfile(teamId, profileId) {
        this.assignments.teamProfiles[teamId] = profileId;
        console.log(`Team ${teamId} assigned to profile ${profileId}`);
    }

    setDefaultProfile(profileId) {
        this.assignments.defaultProfileId = profileId;
        console.log(`Default profile assigned to ${profileId}`);
    }

    getAssignments() {
        return this.assignments;
    }

    getCurrentProfile() {
        // Simple logic for single player / editor
        let profileToApply = this.getProfile('default');

        if (this.assignments.mode === 'all') {
            const p = this.getProfile(this.assignments.defaultProfileId);
            if (p) profileToApply = p;
        } else if (this.assignments.mode === 'random') {
            profileToApply = this.profiles[Math.floor(Math.random() * this.profiles.length)];
        }

        return profileToApply;
    }

    // Apply configuration to current game state
    applyConfiguration() {
        if (!this.game.character) return;

        const profileToApply = this.getCurrentProfile();

        if (profileToApply) {
            this.applyToCharacter(this.game.character, profileToApply);
        }
    }

    applyToCharacter(character, profile) {
        if (!character) return;

        console.log("Applying Profile:", profile.name);

        // Apply Stats
        if (character.setStats) {
            character.setStats({
                speed: profile.speed,
                jumpForce: profile.jumpForce,
                maxHealth: profile.maxHealth,
                respawns: profile.respawns,
                canFly: profile.canFly,
                maxMultiJumps: profile.maxMultiJumps,
                jumpAnimationType: profile.jumpAnimationType,
                fallAnimationType: profile.fallAnimationType
            });
        } else {
            // Fallback
            character.speed = profile.speed;
            character.jumpForce = profile.jumpForce;
        }

        // Apply HUD Settings if available
        if (this.game.hud && profile.hudSettings) {
            this.game.hud.createHUD(profile.hudSettings);

            // Force an update to show current values immediately
            if (character.currentHealth !== undefined) {
                this.game.hud.updateHealth(character.currentHealth, character.maxHealth);
            }
            if (character.maxMultiJumps !== undefined) {
                // Calculate available jumps
                const jumpsLeft = character.maxMultiJumps - (character.jumpCount || 0);
                this.game.hud.updateJump(jumpsLeft, character.maxMultiJumps);
            }
        }
    }

    saveData() {
        return {
            profiles: this.profiles,
            assignments: this.assignments
        };
    }

    loadData(data) {
        if (!data) return;
        if (data.profiles) this.profiles = data.profiles;
        if (data.assignments) this.assignments = data.assignments;
        console.log("Player Config Loaded", this.profiles);
    }
}
