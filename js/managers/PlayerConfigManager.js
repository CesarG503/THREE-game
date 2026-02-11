export class PlayerConfigManager {
    constructor(game) {
        this.game = game;
        this.profiles = [
            {
                id: 'default',
                name: 'Jugador Estándar',
                maxHealth: 100,
                speed: 10,
                jumpForce: 20,
                respawns: -1, // -1 = Infinite
                color: '#ffffff',
                statModes: {} // key -> 'standard' | 'free'
            }
        ];
        this.currentProfileId = 'default';
        this.assignments = {
            mode: 'all', // 'all', 'random', 'team'
            defaultProfileId: 'default',
            teamProfiles: {} // teamId -> profileId
        };
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
            jumpForce: 20,
            respawns: -1,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            statModes: {}
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

    // Apply configuration to current game state
    applyConfiguration() {
        if (!this.game.character) return;

        // For single player / editor, we just apply the "default" or selected logic
        // In a real multiplayer match, this would handle distribution.

        let profileToApply = this.getProfile('default');

        if (this.assignments.mode === 'all') {
            const p = this.getProfile(this.assignments.defaultProfileId);
            if (p) profileToApply = p;
        } else if (this.assignments.mode === 'random') {
            profileToApply = this.profiles[Math.floor(Math.random() * this.profiles.length)];
        }

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
                respawns: profile.respawns
            });
        } else {
            // Fallback direct assignment if method doesn't exist yet
            character.speed = profile.speed;
            character.jumpForce = profile.jumpForce;
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
