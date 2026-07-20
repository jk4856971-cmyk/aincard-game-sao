import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

export class Combat {
    constructor(player, monsters) {
        this.player = player;
        this.monsters = monsters;
        this.skills = [
            { name: "Power Strike", cooldown: 0, maxCooldown: 2 },
            { name: "Blade Dash", cooldown: 0, maxCooldown: 5 },
            { name: "Battle Heal", cooldown: 0, maxCooldown: 10 },
            { name: "Blade Storm", cooldown: 0, maxCooldown: 15 }
        ];
        
        this.setupSkillInputs();
    }

    setupSkillInputs() {
        document.addEventListener('keydown', (e) => {
            if (e.key >= '1' && e.key <= '4') {
                this.useSkill(parseInt(e.key) - 1);
            }
            if (e.key === ' ') {
                this.basicAttack();
            }
        });
        
        // Mobile attack button
        const mobileBtn = document.getElementById('mobile-attack-btn');
        if (mobileBtn) {
            mobileBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.basicAttack();
            });
        }
    }

    basicAttack() {
        // Simple range check
        const range = 5;
        this.monsters.enemies.forEach(enemy => {
            const dist = this.player.mesh.position.distanceTo(enemy.mesh.position);
            if (dist < range) {
                enemy.takeDamage(10); // Basic damage
                console.log("Hit enemy for 10 dmg");
            }
        });
    }

    useSkill(index) {
        if (index < 0 || index >= this.skills.length) return;
        
        const skill = this.skills[index];
        if (skill.cooldown > 0) {
            console.log(`${skill.name} is on cooldown`);
            return;
        }

        console.log(`Used ${skill.name}`);
        skill.cooldown = skill.maxCooldown;

        // Skill Effects
        if (skill.name === "Battle Heal") {
            this.player.heal(30);
        } else {
            // Damage skills
            const range = 8;
            let hit = false;
            this.monsters.enemies.forEach(enemy => {
                const dist = this.player.mesh.position.distanceTo(enemy.mesh.position);
                if (dist < range) {
                    enemy.takeDamage(25);
                    hit = true;
                }
            });
        }
    }

    update(delta) {
        this.skills.forEach(skill => {
            if (skill.cooldown > 0) {
                skill.cooldown = Math.max(0, skill.cooldown - delta);
            }
        });
    }
            }
