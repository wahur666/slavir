import {type ChildProcess, spawn} from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type {AddressInfo} from "node:net";
import os from "node:os";
import path from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {afterAll, beforeAll, describe, expect, it} from "vitest";

// Exercise the built game in Chromium over the DevTools protocol, without a browser automation dependency.
const root = path.resolve(__dirname, "../../public");
const profilePrefix = path.join(os.tmpdir(), "slavir-test-");
const browserPath =
    process.env.CHROME_PATH ||
    [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ].find(candidate => fs.existsSync(candidate));

const contentTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".ttf": "font/ttf",
};

interface CdpMessage {
    id?: number;
    method?: string;
    params?: any;
    result?: any;
    error?: unknown;
}

let profile: string;
let server: http.Server;
let browser: ChildProcess | undefined;
let socket: WebSocket | undefined;
let nextId = 0;
const pending = new Map<number, {resolve: (value: any) => void; reject: (error: Error) => void}>();
const errors: unknown[] = [];

function command<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timeout = setTimeout(() => reject(new Error(`CDP command timed out: ${method}`)), 10_000);
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
        socket!.send(JSON.stringify({id, method, params}));
    });
}

async function evaluate<T = any>(expression: string): Promise<T> {
    const result = await command("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    expect(result.exceptionDetails, JSON.stringify(result.exceptionDetails)).toBeUndefined();
    return result.result.value;
}

async function until(expression: string): Promise<void> {
    for (let attempt = 0; attempt < 150; attempt++) {
        if (await evaluate<boolean>(expression)) return;
        await delay(100);
    }
    throw new Error(`Timed out waiting for ${expression}\n${JSON.stringify(errors)}`);
}

const pressEscape = () => command("Input.dispatchKeyEvent", {type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27});

const state = () =>
    evaluate<string>(`JSON.stringify({countdown: game.countdownRemaining, elapsed: game.elapsedTime,
        money: game.systems.players.map(p => p.resource), objective: game.systems.objective.currentCoolDown,
        units: game.systems.players.map(p => p.units.map(u => [u.x, u.y, u.currentHealth, u.attackCoolDown])),
        cooldowns: game.systems.players.map(p => p.createCoolDown)})`);

function startServer(): Promise<http.Server> {
    const created = http.createServer((request, response) => {
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
            response.setHeader("Content-Type", contentTypes[path.extname(file)] || "application/octet-stream");
            response.end(data);
        });
    });
    return new Promise(resolve => created.listen(0, "127.0.0.1", () => resolve(created)));
}

function launchBrowser(executable: string): Promise<string> {
    browser = spawn(
        executable,
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
    const child = browser;
    let stderr = "";
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Browser startup timed out: ${stderr}`)), 15_000);
        child.once("error", error => {
            clearTimeout(timeout);
            reject(error);
        });
        child.once("exit", code => {
            clearTimeout(timeout);
            reject(new Error(`Browser exited (${code}): ${stderr}`));
        });
        child.stderr!.on("data", chunk => {
            stderr += chunk;
            const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) {
                clearTimeout(timeout);
                resolve(match[1]);
            }
        });
    });
}

async function connect(endpoint: string): Promise<void> {
    const port = new URL(endpoint).port;
    // The browser may announce DevTools before its initial page target is listed.
    let page: {type: string; webSocketDebuggerUrl: string} | undefined;
    for (let attempt = 0; !page && attempt < 50; attempt++) {
        if (attempt > 0) await delay(100);
        const targets: {type: string; webSocketDebuggerUrl: string}[] = await (
            await fetch(`http://127.0.0.1:${port}/json`, {signal: AbortSignal.timeout(10_000)})
        ).json();
        page = targets.find(target => target.type === "page");
    }
    expect(page, "Browser did not expose a page target").toBeDefined();
    const ws = new WebSocket(page!.webSocketDebuggerUrl);
    socket = ws;
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });
    ws.onmessage = ({data}) => {
        const message: CdpMessage = JSON.parse(String(data));
        if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
        const request = message.id === undefined ? undefined : pending.get(message.id);
        if (request) {
            pending.delete(message.id!);
            if (message.error) request.reject(new Error(JSON.stringify(message.error)));
            else request.resolve(message.result);
        }
    };
}

describe("gameplay in a headless browser", () => {
    beforeAll(async () => {
        expect(browserPath, "Set CHROME_PATH to a Chrome, Chromium, or Edge executable.").toBeTruthy();
        expect(fs.existsSync(path.join(root, "index.html")), "Run npm run build first.").toBe(true);
        profile = fs.mkdtempSync(profilePrefix);
        server = await startServer();
        await connect(await launchBrowser(browserPath!));
        await command("Runtime.enable");
        await command("Page.navigate", {url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`});
        await until("!!window.game?.systems && game.scene.isActive() && game.countdownRemaining > 0");
    });

    afterAll(async () => {
        socket?.close();
        if (browser && browser.exitCode === null) {
            const child = browser;
            child.kill();
            await Promise.race([new Promise(resolve => child.once("exit", resolve)), delay(3000)]);
        }
        if (server) {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }
        // Only remove the temporary profile created above, after Chromium has exited.
        if (profile?.startsWith(profilePrefix)) {
            fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        }
    });

    it("blocks commands during the countdown and pauses/resumes it with Escape", async () => {
        expect(
            await evaluate(`game.player1.createUnit('male_engineer') === null
                && game.player1.createBuilding('barrack') === null && game.player1.resource === 100`)
        ).toBe(true);
        await pressEscape();
        await until("game.scene.isPaused() && game.scene.isActive('PauseScene')");
        const countdownState = await state();
        await delay(300);
        expect(await state(), "Pause must freeze the countdown and match").toBe(countdownState);
        await pressEscape();
        await until("game.canIssueCommands");
    });

    it("enforces production timing, the ten-unit cap, the harvester limit, and refunds failed purchases", async () => {
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
            while (p.units.length < 10) { p.createCoolDown = 0; p.createUnit('fantasy8'); delays.push(p.createCoolDown); }
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
        // Recruiting starts a cooldown of 2.5 seconds per fielded unit (see README).
        expect(production).toEqual({
            building: true,
            duplicate: true,
            duplicateKeptMoney: true,
            missingSlot: true,
            missingSlotKeptMoney: true,
            blockedSpawn: true,
            blockedSpawnKeptMoney: true,
            first: true,
            second: true,
            firstDelay: 2500,
            secondDelay: 5000,
            rejected: true,
            rejectedKeptMoney: true,
            limited: true,
            limitKeptMoney: true,
            delays: [12500, 15000, 17500, 20000, 22500, 25000],
            capped: true,
            capKeptMoney: true,
        });
    });

    it("freezes the simulation and pending rocket timers while paused", async () => {
        await evaluate(`window.rocketFinished = false;
            game.systems.objective.playRocketAnimation(false).then(() => window.rocketFinished = true); void 0`);
        await pressEscape();
        await until("game.scene.isPaused()");
        const pausedState = await state();
        await delay(3200);
        expect(await state(), "Pause must freeze movement, economy, combat, and objective").toBe(pausedState);
        expect(await evaluate("window.rocketFinished"), "Rocket timer must pause").toBe(false);
        await pressEscape();
        await until("window.rocketFinished");
    });

    it("auto-attacks when idle, keeps visible ordered targets, drops dead targets, and keeps harvesters peaceful", async () => {
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
            // Automatic pursuit was removed (commit 0da102d); an ordered target stays locked while visible.
            const keepsTarget = unit.target === enemy;
            enemy.markedForDeletion = true;
            unit.update(16);
            return {acquired, damaged, harvesterCannotAttack, keepsTarget, clearedDeadTarget: unit.target === null};
        })()`);
        expect(combat).toEqual({acquired: true, damaged: true, harvesterCannotAttack: true, keepsTarget: true, clearedDeadTarget: true});
    });

    it("only attacks from a hex center and never stops between hex centers", async () => {
        const result = await evaluate(`(() => {
            game.game.loop.sleep();
            const p = game.player1, ai = game.player2;
            const unit = p.units.find(u => u.stat.canAttack && !u.markedForDeletion);
            ai.resource = 1000; ai.createCoolDown = 0; ai.createBuilding('barrack');
            const enemy = ai.createUnit('fantasy8') || ai.units.find(u => u.stat.canAttack && !u.markedForDeletion);
            unit.stopUnit(); enemy.stopUnit();
            unit.attackCoolDown = 0;
            const start = unit.gameTile();
            const center = game.systems.hexToPos(start.hex);
            const adjacent = game.systems.map.tiles.find(t => t.distance(start) === 1 && t.pathfinding === 2
                && game.systems.navigation.checkBlockade(start, t));
            const enemyPos = game.systems.hexToPos(adjacent.hex);
            enemy.setPosition(enemyPos.x, enemyPos.y);
            p.visibleEnemyUnits = [enemy];
            const offCenter = () => { unit.setPosition(center.x + 12, center.y); };
            const atCenter = () => unit.x === center.x && unit.y === center.y;
            const reach = () => { unit.setPosition(center.x + 2, center.y); unit.update(16); };

            // Attack order while off-center with the target already in range: walk to the center first
            offCenter();
            const sameTile = unit.gameTile() === start;
            const health = enemy.currentHealth;
            unit.moveToGameTile(null, enemy);
            unit.update(16);
            const noAttackOffCenter = enemy.currentHealth === health && unit.target === enemy;
            const headsToCenter = unit.moving && unit.navPoints.length === 1 && unit.navPoints[0].distance(center) < 1;
            reach();
            const snapped = atCenter() && !unit.moving;
            unit.update(16);
            const attacksAtCenter = enemy.currentHealth < health;

            // Idle auto-acquire never fires off-center
            unit.stopUnit(); unit.attackCoolDown = 0; offCenter();
            const health2 = enemy.currentHealth;
            unit.update(16);
            const noAutoAttackOffCenter = enemy.currentHealth === health2;

            // Stop order off-center keeps walking to the center
            unit.stopUnit(); offCenter();
            unit.stopUnitWhenHexCenterIsReached();
            const stopHeadsToCenter = unit.moving && unit.navPoints.length === 1 && unit.target === null;
            reach();
            const stoppedAtCenter = atCenter() && !unit.moving;

            // Moving with a target that comes into range: finish at the current hex's center, not mid-path
            unit.stopUnit(); offCenter(); unit.attackCoolDown = 0;
            const far = game.systems.map.tiles.find(t => t.distance(start) === 4 && t.pathfinding === 2);
            unit.moveToGameTile(far);
            unit.target = enemy;
            const health3 = enemy.currentHealth;
            unit.update(16);
            const shortened = unit.navPoints.length === 1 && unit.navPoints[0].distance(center) < 1;
            const noAttackWhileMoving = health3 === enemy.currentHealth;

            unit.stopUnit();
            enemy.markedForDeletion = true;
            p.visibleEnemyUnits = [];
            return {sameTile, noAttackOffCenter, headsToCenter, snapped, attacksAtCenter, noAutoAttackOffCenter,
                stopHeadsToCenter, stoppedAtCenter, shortened, noAttackWhileMoving};
        })()`);
        expect(result).toEqual({
            sameTile: true,
            noAttackOffCenter: true,
            headsToCenter: true,
            snapped: true,
            attacksAtCenter: true,
            noAutoAttackOffCenter: true,
            stopHeadsToCenter: true,
            stoppedAtCenter: true,
            shortened: true,
            noAttackWhileMoving: true,
        });
    });

    it("builds an AI army, expands tech, holds objectives, and prefers counters", async () => {
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
                producedCounter, capped: ai.units.length <= 10};
        })()`);
        expect(ai).toEqual({builtForce: true, expanded: true, holdsObjectives: true, countersAir: true, producedCounter: true, capped: true});
    });

    it("returns to the menu and restarts a fresh match without reloading", async () => {
        await pressEscape();
        await until("game.scene.isPaused()");
        await evaluate(`game.scene.get('PauseScene').scene.stop('GameScene');
            game.scene.get('PauseScene').scene.start('MenuScene'); void 0`);
        await until("game.scene.isActive('MenuScene') && !game.scene.isActive('PauseScene')");
        await evaluate("game.scene.get('MenuScene').scene.start('GameScene'); void 0");
        await until("game.scene.isActive() && game.countdownRemaining > 0");
        expect(await evaluate("!game.gameEnded && game.elapsedTime === 0 && game.player1.resource === 100 && game.player1.units.length === 0")).toBe(
            true
        );
        expect(errors, "No uncaught browser exceptions").toEqual([]);
    });
});
