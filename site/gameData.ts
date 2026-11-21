import {resolve} from "node:path";
import {createServer} from "vite";
import type {BuildingStat, Buildings} from "../src/entities/Building.js";
import type {UnitStat} from "../src/entities/UnitsStats.js";

/** A sprite or image the game loads in PreloadScene, by texture key */
export interface TextureInfo {
    /** URL relative to the src/ folder, e.g. "assets/guard.png" */
    url: string;
    frameWidth?: number;
    frameHeight?: number;
}

export interface GameData {
    /** Every recruitable unit in card order, then the turret */
    units: UnitStat[];
    buildings: Map<Buildings, BuildingStat>;
    textures: Map<string, TextureInfo>;
    turret: {deployTime: number; lifespan: number};
    /** Per-member damage of `attacker` against `target`, the game's own rule */
    damagePerMember: (attacker: UnitStat, target: Pick<UnitStat, "type">) => number;
    /** The squad's magazine and timings, the game's own rule */
    squadVolleyStat: (stat: UnitStat) => {shots: number; initialChargeUp: number; shotInterval: number; reload: number};
}

/**
 * Loads the live unit, building and texture data straight from the game's source modules, with Vite's SSR loader and
 * a Phaser stub (see phaserStub.ts). Nothing is copied by hand, so the wiki always matches the game.
 */
export async function loadGameData(repoRoot: string): Promise<GameData> {
    const server = await createServer({
        configFile: false,
        root: resolve(repoRoot, "src"),
        logLevel: "error",
        appType: "custom",
        server: {middlewareMode: true, hmr: false, watch: null, ws: false},
        optimizeDeps: {noDiscovery: true, include: []},
        resolve: {alias: {phaser: resolve(repoRoot, "site/phaserStub.ts")}},
    });
    try {
        const load = (path: string) => server.ssrLoadModule(path);
        const registry = await load("/entities/units/UnitRegistry.ts");
        const turretModule = await load("/entities/units/Turret.ts");
        const building = await load("/entities/Building.ts");
        const squad = await load("/entities/Squad.ts");
        const preload = await load("/scenes/PreloadScene.ts");
        const Turret = turretModule.default;

        // Run PreloadScene.preload() against a recorder to learn every texture's file and frame size
        const textures = new Map<string, TextureInfo>();
        const record = (key: string, url: string, frame?: {frameWidth: number; frameHeight: number}) => {
            textures.set(key, {url: url.replace(/^\//, ""), frameWidth: frame?.frameWidth, frameHeight: frame?.frameHeight});
        };
        const stub = (await load("/../site/phaserStub.ts")).default;
        const scene = new Proxy(
            {load: new Proxy({image: record, spritesheet: record}, {get: (t, k) => (k in t ? t[k as keyof typeof t] : stub)})},
            {get: (t, k) => (k in t ? t[k as keyof typeof t] : stub)}
        );
        preload.default.prototype.preload.call(scene);

        return {
            units: [...registry.unitClasses.map((unitClass: {stat: UnitStat}) => unitClass.stat), Turret.stat],
            buildings: building.buildingStat,
            textures,
            turret: {deployTime: Turret.DEPLOY_TIME / 1000, lifespan: Turret.LIFESPAN / 1000},
            damagePerMember: squad.damagePerMember,
            squadVolleyStat: squad.squadVolleyStat,
        };
    } finally {
        await server.close();
    }
}
