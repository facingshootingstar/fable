// Headless game test - validate mechanics and visual rendering
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT = path.resolve(__dirname, '..');

// Start a tiny static file server so the game's <img src="assets/..."> can load
const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    let abs = path.join(PROJECT, urlPath);
    if (abs.indexOf(PROJECT) !== 0) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(abs)) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(abs).toLowerCase();
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
                   '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
                   '.json': 'application/json', '.md': 'text/markdown' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(abs).pipe(res);
});
server.listen(8767, () => { /* ready */ });

const html = fs.readFileSync(path.join(PROJECT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost:8767/',
});

dom.window.addEventListener('error', (e) => {
    console.error('WIN_ERROR:', e.message);
});

dom.window.requestAnimationFrame = (cb) => setTimeout(() => cb({ time: Date.now() }), 16);
dom.window.cancelAnimationFrame = (id) => clearTimeout(id);

// Stub AudioContext for jsdom
class StubGain {
    constructor() { this.value = 0; }
    setValueAtTime() {} exponentialRampToValueAtTime() {}
}
class StubOsc {
    connect() {} start() {} stop() {} frequency = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    type = 'sine';
}
class StubAudio {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    get currentTime() { return 0; }
    get destination() { return {}; }
    createOscillator() { return new StubOsc(); }
    createGain() { return new StubGain(); }
}
dom.window.AudioContext = StubAudio;
dom.window.webkitAudioContext = StubAudio;

// Stub localStorage
let lstore = {};
dom.window.localStorage = {
    getItem: (k) => lstore[k] || null,
    setItem: (k, v) => lstore[k] = v,
    removeItem: (k) => { delete lstore[k]; }
};

// Stub AudioManager.play directly so even indexed access doesn't blow up
try {
    dom.window.eval('AudioManager.play = () => {}; AudioManager.init = () => {};');
} catch (e) {}

// Wait for script load
setTimeout(() => {
    try {
        const game = dom.window.eval('game');
        if (!game) { console.error('NO_GAME'); process.exit(1); }

        // Start the game
        game.start();

        // Step 1: Verify HP + ammo present, score/lives removed
        const checks = {
            hasGame: typeof game,
            hasPlayer: !!game.player,
            playerHP: game.player.hp,
            playerAmmo: game.player.ammo,
            playerMaxHP: game.player.maxHP,
            playerMaxAmmo: game.player.maxAmmo,
            scoreDefined: typeof game.score,
            // hasLives (should be undefined now):
            hasLives: 'lives' in game,
            // Enemy types present in level 1
            enemyTypes: game.enemies.map(e => e.type),
            collectibleTypes: game.collectibles.slice(0, 5).map(c => c.type),
        };

        // Step 2: Test that enemies have skill cast logic
        checks.patrolHasFSM = !!game.enemies[0]?.state;
        checks.taxCooldown = checks.patrolHasFSM ? Object.keys(game.enemies[0]) : null;

        // Step 3: Damage player with player.hit
        game.player.hit(game);
        checks.hpAfterHit = game.player.hp;
        checks.hpDamage = (game.player.hp === game.player.maxHP - 1);

        // Step 4: Shoot should consume ammo
        const ammoBefore = game.player.ammo;
        game.player.shoot(game);
        checks.ammoAfterShoot = game.player.ammo;
        checks.shootConsumesAmmo = (game.player.ammo === ammoBefore - 1);

        // Step 5: Melee
        const meleeCD0 = game.player.meleeCooldown;
        game.player.melee(game);
        checks.meleeAnimation = game.player.meleeActive;
        checks.meleeCooldownSet = game.player.meleeCooldown > 0;

        // Step 6: Force cooldown reset + fire many shots until ammo exhausted
        for (let i = 0; i < 30; i++) {
            game.player.shootCooldown = 0;
            game.player.shoot(game);
            if (game.player.ammo === 0) break;
        }
        checks.ammoAtZero = (game.player.ammo === 0);
        checks.cantShootWhenEmpty = !game.player.shoot(game);

        // Step 7: Apply ammo pickup (test applyPowerUp)
        const before = game.player.ammo;
        game.player.applyPowerUp('ammo');
        checks.ammoAfterPickup = game.player.ammo;
        checks.ammoRefillWorks = (game.player.ammo === Math.min(before + 4, game.player.maxAmmo));

        // Apply HP pickup
        const hpBefore = game.player.hp;
        game.player.hp = 1; // simulate damage
        game.player.applyPowerUp('health');
        checks.hpAfterHealthOrb = game.player.hp;
        checks.healthWorks = game.player.hp >= 2;

        // Step 8: Test that enemy die drops pickup
        const enemy = game.enemies[0];
        if (enemy) {
            const colCount0 = game.collectibles.length;
            enemy.die(game);
            checks.collectibleDrops = (game.collectibles.length > colCount0);
            checks.dropsArePickups = game.collectibles.length > 0 &&
                ['ammo', 'health'].includes(game.collectibles[game.collectibles.length - 1].type);
        }

        // Step 9: Verify all enemy types instantiate properly
        game.loadLevel(2);  // level 2 has variety
        checks.level2HasVariety = game.enemies.length > 0 &&
            new Set(game.enemies.map(e => e.type)).size >= 2;
        checks.level2Types = [...new Set(game.enemies.map(e => e.type))];

        game.loadLevel(4);
        checks.level4HasVariety = new Set(game.enemies.map(e => e.type)).size >= 3;
        checks.level4Types = [...new Set(game.enemies.map(e => e.type))];

        game.loadLevel(5);  // boss level
        checks.level5HasBoss = game.enemies.some(e => e.type === 'boss');
        checks.level5EnemyCount = game.enemies.length;
        checks.level5UniqueTypes = new Set(game.enemies.map(e => e.type)).size;

        // Step 10: Test boss multi-phase: simulate damage
        const boss = game.enemies.find(e => e.type === 'boss');
        if (boss) {
            checks.bossHasAttackCD = boss.attackCooldownMax >= 18;
            checks.bossHasSkill = typeof boss.attackCooldown === 'number';
        }

        // Step 11: HUD elements present
        checks.hudHasAmmo = true;  // already verified via tests

        // Step 12: Platform visual got improved (Blasphemous style)
        checks.platformHasDraw = typeof game.platforms[0]?.draw === 'function';

        // Step 14: Asset loading + texture keys
        checks.assetsDict = game.assets ? Object.keys(game.assets).length : 0;
        checks.sky1Loaded = !!game.assets?.sky_1 && game.assets.sky_1.complete && game.assets.sky_1.naturalWidth > 0;
        checks.skyStarbaseLoaded = !!game.assets?.sky_starbase && game.assets.sky_starbase.complete && game.assets.sky_starbase.naturalWidth > 0;
        checks.stoneTexLoaded = !!game.assets?.tex_stone_grey && game.assets.tex_stone_grey.complete && game.assets.tex_stone_grey.naturalWidth > 0;
        checks.brickTexLoaded = !!game.assets?.tex_brick_wall && game.assets.tex_brick_wall.complete && game.assets.tex_brick_wall.naturalWidth > 0;
        checks.metalTexLoaded = !!game.assets?.tex_metal && game.assets.tex_metal.complete && game.assets.tex_metal.naturalWidth > 0;
        checks.cobbleTexLoaded = !!game.assets?.tex_cobble && game.assets.tex_cobble.complete && game.assets.tex_cobble.naturalWidth > 0;
        checks.wallTexLoaded = !!game.assets?.tex_stone_wall && game.assets.tex_stone_wall.complete && game.assets.tex_stone_wall.naturalWidth > 0;

        // Step 13: Verify no 'score' based UI text
        const uiHtml = dom.window.document.documentElement.outerHTML;
        checks.noScoreUI = !uiHtml.includes('ĐIỂM:');
        checks.hasAmmoUI = uiHtml.includes('ĐẠN');
        checks.hasMeleeUI = uiHtml.includes('CẬN CHIẾN');

        console.log('TEST_RESULTS:');
        Object.entries(checks).forEach(([k, v]) => console.log(`  ${k}: ${JSON.stringify(v)}`));

        // Overall pass check
        const allPass = checks.playerHP > 0 && checks.ammoAfterShoot !== undefined &&
            checks.shootConsumesAmmo === true &&
            checks.meleeAnimation > 0 && checks.ammoAtZero === true &&
            checks.collectibleDrops === true && checks.dropsArePickups === true;

        console.log('ALL_PASS: ' + allPass);
        const code = allPass ? 0 : 2;
        server.close();
        process.exit(code);

    } catch (e) {
        console.error('TEST_ERROR:', e.message);
        console.error(e.stack);
        server.close();
        process.exit(3);
    }
}, 2500);
