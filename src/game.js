import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Monsters } from './monsters.js';
import { Combat } from './combat.js';
import { UI } from './ui.js';
import { Save } from './save.js';

// ==========================================
// DEBUG OVERLAY LOGGER
// ==========================================
const debugLog = document.getElementById('debug-log');

function addDebug(msg, type = 'success') {
    if (!debugLog) return;
    const line = document.createElement('div');
    line.className = type === 'error' ? 'dbg-error' : type === 'warn' ? 'dbg-warn' : '';
    const icon = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✅';
    line.textContent = `${icon} ${msg}`;
    debugLog.appendChild(line);
    
    // Keep max 20 lines
    while (debugLog.children.length > 20) {
        debugLog.removeChild(debugLog.firstChild);
    }
}

function logError(err) {
    let fileName = 'Unknown';
    let lineNumber = 'Unknown';
    let fullError = err ? (err.message || err.toString()) : 'Unknown Error';

    if (err && err.stack) {
        const match = err.stack.match(/(?:at\s+.*?\s+\()?(https?:\/\/[^\s\)]+):(\d+):(\d+)\)?/);
        if (match) {
            fileName = match[1].split('/').pop(); // Get just the file name
            lineNumber = match[2];
        }
    }

    addDebug(`FILE: ${fileName}`, 'error');
    addDebug(`LINE: ${lineNumber}`, 'error');
    addDebug(`ERROR: ${fullError}`, 'error');
}

// Catch global errors
window.addEventListener('error', (e) => logError(e.error || new Error(e.message)));
window.addEventListener('unhandledrejection', (e) => logError(e.reason || new Error('Promise Rejected')));

// ==========================================
// GAME CLASS
// ==========================================
class Game {
    constructor() {
        try {
            addDebug("Three.js Loaded");
            
            this.scene = new THREE.Scene();
            addDebug("Scene Created");
            
            this.scene.background = new THREE.Color(0x87CEEB);
            this.scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            addDebug("Camera Created");
            
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            addDebug("Renderer Created");
            
            this.clock = new THREE.Clock();
            this.loopLogged = false;

            // Load Core Modules
            this.world = new World(this.scene);
            addDebug("World / Floor System Loaded");
            
            this.player = new Player(this.scene, this.camera);
            addDebug("Player (Kirito-Class) Loaded");
            
            this.monsters = new Monsters(this.scene, this.player);
            addDebug("Monsters / Field Loaded");
            
            this.combat = new Combat(this.player, this.monsters);
            addDebug("Combat / Skills (1-4) Loaded");
            
            this.ui = new UI(this.player, this.combat, this.world);
            addDebug("UI / Inventory / Map Loaded");
            
            this.save = new Save();
            addDebug("Save System Loaded");

            // Check for specific HTML features from your index.html
            this.checkHTMLFeatures();

            this.init();
        } catch (e) {
            logError(e);
        }
    }

    checkHTMLFeatures() {
        // Check if critical UI elements from your actual index.html exist
        const features = [
            { id: 'google-signin-container', name: 'Google Sign-In / Guest' },
            { id: 'shopkeeper-modal', name: 'Shopkeeper' }, // Adjust ID if different
            { id: 'quest-modal', name: 'Quest Giver' },     // Adjust ID if different
            { id: 'team-modal', name: 'Team & Voice' },
            { id: 'hub-modal', name: 'Town Hub' }
        ];

        features.forEach(f => {
            // Using partial ID matches or generic checks since exact IDs might vary
            const el = document.querySelector(`[id*="${f.id.split('-')[0]}"]`) || document.getElementById(f.id);
            if (el) {
                addDebug(`${f.name} UI Found`);
            } else {
                addDebug(`${f.name} UI Missing`, 'warn');
            }
        });
    }

    init() {
        try {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            
            const container = document.getElementById('game-container');
            if (container) {
                container.appendChild(this.renderer.domElement);
                addDebug("3D Canvas Attached to DOM");
            } else {
                document.body.appendChild(this.renderer.domElement);
                addDebug("3D Canvas Attached to Body (Fallback)", 'warn');
            }

            window.addEventListener('resize', () => this.onWindowResize(), false);
            this.animate();
        } catch (e) {
            logError(e);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        try {
            if (!this.loopLogged) {
                addDebug("Game Loop Running (60 FPS)");
                this.loopLogged = true;
            }
            
            const delta = this.clock.getDelta();

            this.player.update(delta);
            this.monsters.update(delta);
            this.combat.update(delta);
            this.ui.update();

            this.renderer.render(this.scene, this.camera);
        } catch (e) {
            logError(e);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Game());
} else {
    new Game();
}
