// Capture canvas screenshot via JSDOM canvas package
const { JSDOM } = require('jsdom');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PROJECT = path.resolve(__dirname, '..');

// Static server for /assets/* images
const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    let abs = path.join(PROJECT, urlPath);
    if (abs.indexOf(PROJECT) !== 0) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(abs)) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(abs).toLowerCase();
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
                   '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
                   '.json': 'application/json' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(abs).pipe(res);
});
server.listen(8768, () => {});

const html = fs.readFileSync(path.join(PROJECT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost:8768/',
});

dom.window.requestAnimationFrame = (cb) => setTimeout(() => cb({ time: Date.now() }), 16);
dom.window.cancelAnimationFrame = (id) => clearTimeout(id);

class StubGain {
    constructor() { this.value = 0; }
    setValueAtTime() {} exponentialRampToValueAtTime() {}
}
class StubOsc {
    connect() {} start() {} stop() {}
    frequency = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    type = 'sine';
}
class StubAudio {
    constructor() { this.state = 'running'; }
    get currentTime() { return 0; }
    get destination() { return {}; }
    createOscillator() { return new StubOsc(); }
    createGain() { return new StubGain(); }
}
dom.window.AudioContext = StubAudio;
dom.window.webkitAudioContext = StubAudio;

let lstore = {};
dom.window.localStorage = {
    getItem: (k) => lstore[k] || null,
    setItem: (k, v) => lstore[k] = v,
    removeItem: (k) => { delete lstore[k]; }
};
dom.window.eval('AudioManager.play = () => {}; AudioManager.init = () => {};');

setTimeout(() => {
    try {
        const game = dom.window.eval('game');
        const outFile = path.join(PROJECT, '.cursor/screenshot.png');

        game.start();
        game.loadLevel(4);

        game.player.x = 750;
        game.player.y = 350;
        game.player.vy = 0;
        game.cameraX = 550;
        game.time = 1000;

        // Wait for assets to load (2 sec)
        const assetsPromise = new Promise((resolve) => {
            if (game.assetsLoaded) return resolve();
            const check = setInterval(() => {
                if (game.assetsLoaded) { clearInterval(check); resolve(); }
            }, 100);
        });

        assetsPromise.then(() => {
            // give a moment for images to actually decode
            setTimeout(() => {
                for (let i = 0; i < 80; i++) {
                    game.player.update({ left: false, right: false, jump: false, shoot: false, melee: false }, game.platforms, game);
                    game.enemies.forEach(e => e.update(game.player.x, game.player.y, game));
                    game.time += 16;
                }
                const canvas = dom.window.document.getElementById('gameCanvas');
                const dataUrl = canvas.toDataURL('image/png');
                const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
                fs.writeFileSync(outFile, Buffer.from(b64, 'base64'));
                console.log('SCREENSHOT_OK ' + outFile + ' size=' + Buffer.from(b64, 'base64').length);

                // Level 5 with boss
                const outFile2 = path.join(PROJECT, '.cursor/screenshot_boss.png');
                game.loadLevel(5);
                game.player.x = 1700;
                game.player.y = 200;
                game.player.vy = 0;
                game.cameraX = 1500;
                for (let i = 0; i < 80; i++) {
                    game.player.update({ left: false, right: false, jump: false, shoot: false, melee: false }, game.platforms, game);
                    game.enemies.forEach(e => e.update(game.player.x, game.player.y, game));
                    game.time += 16;
                }
                const dataUrl2 = canvas.toDataURL('image/png');
                const b642 = dataUrl2.replace(/^data:image\/png;base64,/, '');
                fs.writeFileSync(outFile2, Buffer.from(b642, 'base64'));
                console.log('SCREENSHOT_OK ' + outFile2);

                server.close();
                process.exit(0);
            }, 500);
        });

        // fail-safe timer in case assets never load
        setTimeout(() => {
            console.error('TIMEOUT waiting for assetsLoaded');
            server.close();
            process.exit(1);
        }, 10000);
    } catch (e) {
        console.error('SCREENSHOT_ERR: ' + e.message);
        console.error(e.stack);
        server.close();
        process.exit(1);
    }
}, 800);
