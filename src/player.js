import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Stats
        this.level = 1;
        this.hp = 100;
        this.maxHp = 100;
        this.xp = 0;
        this.nextLevelXp = 50;
        this.gold = 0;
        
        // Movement
        this.speed = 10;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;

        // Mesh
        const geometry = new THREE.CapsuleGeometry(1, 2, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = 1;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Camera Setup
        this.camera.position.set(0, 5, 10);
        
        // Controls
        this.controls = new PointerLockControls(this.camera, document.body);
        
        this.setupInputs();
    }

    setupInputs() {
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = true; break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        
        // Click to lock pointer
        document.addEventListener('click', () => {
            if (!this.controls.isLocked) {
                this.controls.lock();
            }
        });
    }

    update(delta) {
        if (this.controls.isLocked) {
            this.velocity.x -= this.velocity.x * 10.0 * delta;
            this.velocity.z -= this.velocity.z * 10.0 * delta;

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();

            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * 400.0 * delta;
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * 400.0 * delta;

            this.controls.moveRight(-this.velocity.x * delta);
            this.controls.moveForward(-this.velocity.z * delta);
            
            // Sync mesh with camera position (simple third-person follow)
            this.mesh.position.copy(this.camera.position);
            this.mesh.position.y = 1; // Keep on ground
        }
    }
    
    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        return this.hp <= 0;
    }
    
    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }
    
    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.levelUp();
        }
    }
    
    levelUp() {
        this.level++;
        this.xp -= this.nextLevelXp;
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.5);
        this.maxHp += 20;
        this.hp = this.maxHp;
        console.log("Level Up! Now level " + this.level);
    }
        }
