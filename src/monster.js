import * as THREE from 'three';

export class Monsters {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.enemies = [];
        
        this.spawnTimer = 0;
    }

    spawnEnemy() {
        const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const enemy = new THREE.Mesh(geometry, material);
        
        // Random position around player but not too close
        const angle = Math.random() * Math.PI * 2;
        const radius = 10 + Math.random() * 20;
        enemy.position.set(
            this.player.mesh.position.x + Math.cos(angle) * radius,
            1,
            this.player.mesh.position.z + Math.sin(angle) * radius
        );
        
        enemy.castShadow = true;
        enemy.userData = { hp: 50, maxHp: 50, speed: 3 };
        
        this.scene.add(enemy);
        this.enemies.push(enemy);
    }

    update(delta) {
        // Spawn logic
        this.spawnTimer += delta;
        if (this.spawnTimer > 5 && this.enemies.length < 5) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }

        // AI Logic
        this.enemies.forEach((enemy, index) => {
            if (enemy.userData.hp <= 0) {
                this.scene.remove(enemy);
                this.enemies.splice(index, 1);
                this.player.gainXp(10);
                return;
            }

            // Move towards player
            const direction = new THREE.Vector3().subVectors(this.player.mesh.position, enemy.position).normalize();
            enemy.position.add(direction.multiplyScalar(enemy.userData.speed * delta));
            enemy.lookAt(this.player.mesh.position);
            
            // Attack player if close
            if (enemy.position.distanceTo(this.player.mesh.position) < 2) {
                if (Math.random() < 0.05) { // Random attack chance per frame
                    this.player.takeDamage(5);
                }
            }
        });
    }
}
