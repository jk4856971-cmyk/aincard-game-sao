export class Save {
    constructor() {
        this.storageKey = 'aincrad_save_v1';
    }

    save(player) {
        const data = {
            level: player.level,
            hp: player.hp,
            maxHp: player.maxHp,
            xp: player.xp,
            nextLevelXp: player.nextLevelXp,
            gold: player.gold
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        console.log("Game Saved");
    }

    load(player) {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
            const parsed = JSON.parse(data);
            player.level = parsed.level;
            player.hp = parsed.hp;
            player.maxHp = parsed.maxHp;
            player.xp = parsed.xp;
            player.nextLevelXp = parsed.nextLevelXp;
            player.gold = parsed.gold;
            console.log("Game Loaded");
        }
    }
}
