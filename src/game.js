import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Monsters } from './monsters.js';
import { Combat } from './combat.js';
import { UI } from './ui.js';
import { Save } from './save.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.clock = new THREE.Clock();

        // Initialize Modules
        this.world = new World(this.scene);
        this.player = new Player(this.scene, this.camera);
        this.monsters = new Monsters(this.scene, this.player);
        this.combat = new Combat(this.player, this.monsters);
        this.ui = new UI(this.player, this.combat, this.world);
        this.save = new Save();

        this.init();
    }

    init() {
        // Setup Renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Event Listeners
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Start Loop
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();

        // Update Modules
        this.player.update(delta);
        this.monsters.update(delta);
        this.combat.update(delta);
        this.ui.update();

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});
