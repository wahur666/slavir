const assert = require("node:assert/strict");
const {spawn} = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {setTimeout: delay} = require("node:timers/promises");

// Exercise the built game in Chromium, without adding a browser automation dependency.
const root = path.resolve(__dirname, "../public");
const browserPath =
    process.env.CHROME_PATH ||
    [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ].find(candidate => fs.existsSync(candidate));
assert.ok(browserPath, "Set CHROME_PATH to a Chrome, Chromium, or Edge executable.");
assert.ok(fs.existsSync(path.join(root, "index.html")), "Run npm run build first.");

async function main() {
    console.log("Starting browser gameplay checks");
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "slavir-test-"));
    const server = http.createServer((request, response) => {
        const file = path.resolve(root, "." + (request.url === "/" ? "/index.html" : request.url));
        if (!file.startsWith(root + path.sep)) {
            response.writeHead(403).end();
            return;
        }
        fs.readFile(file, (error, data) => {
            if (error) {
                response.writeHead(404).end();
                return;
            }
            const types = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ttf": "font/ttf"};
            response.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
            response.end(data);
        });
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    let browser;
    let socket;
    try {
        console.log("Spawning browser from", browserPath);
        browser = spawn(
            browserPath,
            [
                "--headless=new",
                "--remote-debugging-port=0",
                "--no-first-run",
                "--no-default-browser-check",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--window-size=1400,900",
                `--user-data-dir=${profile}`,
                "about:blank",
            ],
            {windowsHide: true}
        );
        let stderr = "";
        const endpoint = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(`Browser startup timed out: ${stderr}`)), 15000);
            browser.once("error", error => {
                clearTimeout(timeout);
                reject(error);
            });
            browser.once("exit", code => {
                clearTimeout(timeout);
                reject(new Error(`Browser exited (${code}): ${stderr}`));
            });
            browser.stderr.on("data", chunk => {
                stderr += chunk;
                const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
                if (match) {
                    clearTimeout(timeout);
                    resolve(match[1]);
                }
            });
        });
        const port = new URL(endpoint).port;
        console.log("Browser connected; loading the game");
        const pages = await (await fetch(`http://127.0.0.1:${port}/json`, {signal: AbortSignal.timeout(10000)})).json();
        socket = new WebSocket(pages.find(page => page.type === "page").webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            socket.onopen = resolve;
            socket.onerror = reject;
        });
        let nextId = 0;
        const pending = new Map();
        const errors = [];
        socket.onmessage = ({data}) => {
            const message = JSON.parse(data);
            if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
            const request = pending.get(message.id);
            if (request) {
                pending.delete(message.id);
                if (message.error) request.reject(new Error(JSON.stringify(message.error)));
                else request.resolve(message.result);
            }
        };
        const command = (method, params = {}) =>
            new Promise((resolve, reject) => {
                const id = ++nextId;
                const timeout = setTimeout(() => reject(new Error(`CDP command timed out: ${method}`)), 10000);
                pending.set(id, {
                    resolve: value => {
                        clearTimeout(timeout);
                        resolve(value);
                    },
                    reject: error => {
                        clearTimeout(timeout);
                        reject(error);
                    },
                });
                socket.send(JSON.stringify({id, method, params}));
            });
        const evaluate = async expression => {
            const result = await command("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
            assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
            return result.result.value;
        };
        const until = async expression => {
            for (let attempt = 0; attempt < 150; attempt++) {
                if (await evaluate(expression)) return;
                await delay(100);
            }
            assert.fail(`Timed out waiting for ${expression}\n${JSON.stringify(errors)}`);
        };
        const pressEscape = () =>
            command("Input.dispatchKeyEvent", {
                type: "keyUp",
                key: "Escape",
                code: "Escape",
                windowsVirtualKeyCode: 27,
            });
        const state = () =>
            evaluate(`JSON.stringify({countdown: game.countdownRemaining, elapsed: game.elapsedTime,
            money: game.systems.players.map(p => p.resource), objective: game.systems.objective.currentCoolDown,
            units: game.systems.players.map(p => p.units.map(u => [u.x, u.y, u.currentHealth, u.attackCoolDown])),
            cooldowns: game.systems.players.map(p => p.createCoolDown)})`);
        await command("Runtime.enable");
        await command("Page.navigate", {url: `http://127.0.0.1:${server.address().port}`});
        await until("!!window.game?.systems && game.scene.isActive() && game.countdownRemaining > 0");
        assert.equal(
            await evaluate(`game.player1.createUnit('male_engineer') === null
            && game.player1.createBuilding('barrack') === null && game.player1.resource === 100`),
            true
        );
        await pressEscape();
        await until("game.scene.isPaused() && game.scene.isActive('PauseScene')");
        const countdownState = await state();
        await delay(300);
        assert.equal(await state(), countdownState, "Pause must freeze the countdown and match");
        await pressEscape();
        await until("game.canIssueCommands");
        console.log("PASS countdown blocks commands and pauses/resumes with Escape");

        const production = await evaluate(`(() => {
            const p = game.player1;
            p.resource = 1000;
            const building = p.createBuilding('barrack');
            const money = p.resource;
            const duplicate = p.createBuilding('barrack');
            const duplicateKeptMoney = p.resource === money;
            const slots = game.systems.layers.base1.objects;
            game.systems.layers.base1.objects = [];
            const missingSlot = p.createBuilding('factory');
            const missingSlotKeptMoney = p.resource === money && !p.hasBuildings.FACTORY;
            game.systems.layers.base1.objects = slots;
            const tiles = game.systems.map.tiles;
            game.systems.map.tiles = [];
            const blockedSpawn = p.createUnit('fantasy8');
            const blockedSpawnKeptMoney = p.resource === money;
            game.systems.map.tiles = tiles;
            const first = p.createUnit('fantasy8');
            const firstDelay = p.createCoolDown;
            p.update(firstDelay);
            const second = p.createUnit('fantasy8');
            const secondDelay = p.createCoolDown;
            const beforeRejected = p.resource;
            const rejected = p.createUnit('fantasy8');
            const rejectedKeptMoney = p.resource === beforeRejected;
            p.createCoolDown = 0;
            p.createUnit('male_engineer');
            p.createCoolDown = 0;
            p.createUnit('male_engineer');
            p.createCoolDown = 0;
            const beforeLimit = p.resource;
            const limited = p.createUnit('male_engineer');
            const limitKeptMoney = p.resource === beforeLimit;
            const delays = [];
            while (p.units.length < 6) { p.createCoolDown = 0; p.createUnit('fantasy8'); delays.push(p.createCoolDown); }
            p.createCoolDown = 0;
            const beforeCap = p.resource;
            const capped = p.createUnit('fantasy8');
            return {building: !!building, duplicate: duplicate === null, duplicateKeptMoney,
                missingSlot: missingSlot === null, missingSlotKeptMoney,
                blockedSpawn: blockedSpawn === null, blockedSpawnKeptMoney,
                first: !!first, second: !!second, firstDelay, secondDelay, rejected: rejected === null,
                rejectedKeptMoney, limited: limited === null, limitKeptMoney, delays,
                capped: capped === null, capKeptMoney: p.resource === beforeCap};
        })()`);
        assert.deepEqual(production, {
            building: true,
            duplicate: true,
            duplicateKeptMoney: true,
            missingSlot: true,
            missingSlotKeptMoney: true,
            blockedSpawn: true,
            blockedSpawnKeptMoney: true,
            first: true,
            second: true,
            firstDelay: 5000,
            secondDelay: 10000,
            rejected: true,
            rejectedKeptMoney: true,
            limited: true,
            limitKeptMoney: true,
            delays: [25000, 30000],
            capped: true,
            capKeptMoney: true,
        });
        console.log("PASS production timing, six-unit cap, harvester limit, and failed purchase refunds");

        await evaluate(`window.rocketFinished = false;
            game.systems.objective.playRocketAnimation(false).then(() => window.rocketFinished = true); void 0`);
        await pressEscape();
        await until("game.scene.isPaused()");
        const pausedState = await state();
        await delay(3200);
        assert.equal(await state(), pausedState, "Pause must freeze movement, economy, combat, and objective");
        assert.equal(await evaluate("window.rocketFinished"), false, "Rocket timer must pause");
        await pressEscape();
        await until("window.rocketFinished");
        console.log("PASS pause freezes the simulation and pending rocket timers");

        // Use real entities with a sleeping render loop for deterministic combat and AI decisions.
        const combat = await evaluate(`(() => {
            game.game.loop.sleep();
            const p = game.player1, ai = game.player2;
            const unit = p.units.find(u => u.stat.canAttack);
            ai.resource = 1000; ai.createCoolDown = 0; ai.createBuilding('barrack');
            const enemy = ai.createUnit('fantasy8');
            const start = unit.gameTile();
            const adjacent = game.systems.map.tiles.find(t => t.distance(start) === 1 && t.pathfinding === 2
                && game.systems.navigation.checkBlockade(start, t));
            const pos = game.systems.hexToPos(adjacent.hex);
            enemy.setPosition(pos.x, pos.y); enemy.stopUnit(); unit.stopUnit();
            p.visibleEnemyUnits = [enemy];
            const health = enemy.currentHealth;
            unit.update(16);
            const acquired = unit.target === enemy;
            const damaged = enemy.currentHealth < health;
            const harvester = p.units.find(u => !u.stat.canAttack);
            harvester.moveToGameTile(null, enemy);
            const harvesterCannotAttack = !harvester.target;
            unit.moveToGameTile(ai.base, enemy);
            const farther = game.systems.map.tiles.find(t => t.distance(start) === 3 && t.pathfinding === 2);
            const farPos = game.systems.hexToPos(farther.hex);
            enemy.setPosition(farPos.x, farPos.y);
            unit.update(500);
            const following = unit.target === enemy && unit.moving;
            enemy.markedForDeletion = true;
            unit.update(16);
            return {acquired, damaged, harvesterCannotAttack, following, clearedDeadTarget: unit.target === null};
        })()`);
        assert.deepEqual(combat, {acquired: true, damaged: true, harvesterCannotAttack: true, following: true, clearedDeadTarget: true});
        console.log("PASS idle auto-attack, moving target pursuit, dead targets, and peaceful harvesters");

        const ai = await evaluate(`(() => {
            const ai = game.player2, p = game.player1;
            ai.resource = 1000;
            ai.visibleEnemyUnits = [];
            for (let i = 0; i < 8; i++) { ai.createCoolDown = 0; ai.play(); }
            const builtForce = ai.units.filter(u => u.stat.canAttack && !u.markedForDeletion).length >= 3;
            const expanded = ai.hasBuildings.FACTORY && ai.hasBuildings.HANGAR;
            const holdsObjectives = ai.units.some(u => u.destination || u.moving);
            const air = p.units[0];
            const oldStat = air.stat;
            air.stat = {...oldStat, type: 'aircraft'};
            ai.visibleEnemyUnits = [air];
            const stats = p.units.find(u => u.stat.texture === 'fantasy8').stat;
            const rifleScore = ai.counterScore(stats);
            const archerScore = ai.counterScore({...stats, canAttackAir: true, goodAgainstAir: true});
            const removed = ai.units.pop(); removed.stopUnit();
            ai.createCoolDown = 0;
            ai.play();
            const producedCounter = ai.units[ai.units.length - 1].stat.texture === 'female_archer';
            air.stat = oldStat;
            game.game.loop.wake();
            return {builtForce, expanded, holdsObjectives, countersAir: archerScore > rifleScore,
                producedCounter, capped: ai.units.length <= 6};
        })()`);
        assert.deepEqual(ai, {builtForce: true, expanded: true, holdsObjectives: true, countersAir: true, producedCounter: true, capped: true});
        console.log("PASS AI army production, tech expansion, objectives, and counter preferences");

        await pressEscape();
        await until("game.scene.isPaused()");
        await evaluate(`game.scene.get('PauseScene').scene.stop('GameScene');
            game.scene.get('PauseScene').scene.start('MenuScene'); void 0`);
        await until("game.scene.isActive('MenuScene') && !game.scene.isActive('PauseScene')");
        await evaluate("game.scene.get('MenuScene').scene.start('GameScene'); void 0");
        await until("game.scene.isActive() && game.countdownRemaining > 0");
        assert.equal(
            await evaluate("!game.gameEnded && game.elapsedTime === 0 && game.player1.resource === 100 && game.player1.units.length === 0"),
            true
        );
        assert.deepEqual(errors, [], "No uncaught browser exceptions");
        console.log("PASS return to menu and fresh match restart without reloading");
    } finally {
        if (socket) socket.close();
        if (browser && browser.exitCode === null) {
            browser.kill();
            await Promise.race([new Promise(resolve => browser.once("exit", resolve)), delay(3000)]);
        }
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        // Only remove the temporary profile created above, after Chromium has exited.
        if (profile.startsWith(path.join(os.tmpdir(), "slavir-test-"))) {
            fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
