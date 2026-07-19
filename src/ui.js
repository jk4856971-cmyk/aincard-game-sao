export class UI {
    constructor(player, combat, world) {
        this.player = player;
        this.combat = combat;
        this.world = world;
        
        this.initElements();
        this.initModals();
        this.initLogin();
    }

    initElements() {
        this.hpBar = document.getElementById('health-bar');
        this.xpBar = document.getElementById('xp-bar');
        this.levelText = document.getElementById('level');
        this.hpText = document.getElementById('hp');
        this.maxHpText = document.getElementById('max-hp');
        
        this.hudButtons = document.getElementById('hud-buttons');
        this.loginScreen = document.getElementById('login-screen');
    }

    initLogin() {
        const guestBtn = document.getElementById('guest-btn');
        guestBtn.addEventListener('click', () => {
            this.loginScreen.style.display = 'none';
            this.hudButtons.style.display = 'flex';
            // Request pointer lock
            document.body.requestPointerLock();
        });
    }

    initModals() {
        const buttons = {
            'btn-inventory': 'inventory-modal',
            'btn-skills': 'skill-tree-modal',
            'btn-map': 'map-modal',
            'btn-team': 'team-modal',
            'btn-hub': 'hub-modal'
        };

        Object.keys(buttons).forEach(btnId => {
            document.getElementById(btnId).addEventListener('click', () => {
                document.getElementById('modal-overlay').classList.remove('hidden');
                document.getElementById(buttons[btnId]).classList.remove('hidden');
            });
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('modal-overlay').classList.add('hidden');
                document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
            });
        });
        
        // Close on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('modal-overlay').classList.add('hidden');
                document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
            }
        });
    }

    update() {
        // Update HUD
        const hpPercent = (this.player.hp / this.player.maxHp) * 100;
        const xpPercent = (this.player.xp / this.player.nextLevelXp) * 100;
        
        this.hpBar.style.width = `${hpPercent}%`;
        this.xpBar.style.width = `${xpPercent}%`;
        
        this.levelText.textContent = this.player.level;
        this.hpText.textContent = Math.floor(this.player.hp);
        this.maxHpText.textContent = this.player.maxHp;
    }
          }
