import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.currentFloor = 1;
        this.isInTown = true;
        
        this.initLighting();
        this.createEnvironment();
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);
    }

    createEnvironment() {
        // Ground
        const geometry = new THREE.PlaneGeometry(200, 200);
        const material = new THREE.MeshStandardMaterial({ color: 0x3a5f0b });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Simple Town Marker
        const townGeo = new THREE.BoxGeometry(10, 10, 10);
        const townMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        this.townMarker = new THREE.Mesh(townGeo, townMat);
        this.townMarker.position.set(0, 5, 0);
        this.scene.add(this.townMarker);
    }

    toggleZone(inTown) {
        this.isInTown = inTown;
        // Visual feedback or environment change could go here
        console.log(`Moved to ${inTown ? 'Town' : 'Field'} on Floor ${this.currentFloor}`);
    }
}
