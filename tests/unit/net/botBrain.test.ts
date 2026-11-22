import {describe, expect, it} from "vitest";
import BotBrain from "../../../server/botBrain.js";
import type {EnemyUnitInfo, MatchInfo, Observation, OwnUnitInfo, UnitCatalogEntry} from "../../../src/net/Observation.js";

const entry = (overrides: Partial<UnitCatalogEntry> & Pick<UnitCatalogEntry, "name">): UnitCatalogEntry => ({
    cost: 10,
    building: "barrack",
    type: "infantry",
    canAttack: true,
    canAttackAir: false,
    goodAgainstInfantry: false,
    goodAgainstFactory: false,
    goodAgainstAir: false,
    visionRadius: 3,
    attackRange: 1,
    flying: false,
    limit: -1,
    maxHealth: 1000,
    harvester: false,
    ...overrides,
});

/** 12×12 map, pointy hexes with odd rows shifted: cube q = col - floor(row / 2), r = row */
function matchInfo(): MatchInfo {
    const tiles: MatchInfo["tiles"] = [];
    for (let row = 0; row < 12; row++) {
        for (let col = 0; col < 12; col++) tiles.push({col, row, q: col - Math.floor(row / 2), r: row, ground: true});
    }
    return {
        playerIndex: 2,
        enemyIndex: 1,
        tickMs: 1000 / 60,
        observationIntervalMs: 1000,
        tiles,
        pads: [[{col: 6, row: 2}], [{col: 6, row: 6}], [{col: 6, row: 10}]],
        nuke: {col: 6, row: 5},
        base: {col: 11, row: 6},
        baseTiles: [{col: 11, row: 6}],
        spawn: {col: 11, row: 7},
        enemyBase: {col: 0, row: 6},
        enemyBaseTiles: [{col: 0, row: 6}],
        units: [
            entry({name: "male_engineer", cost: 60, building: "castle", canAttack: false, harvester: true}),
            entry({name: "fantasy8", cost: 10, goodAgainstInfantry: true}),
            entry({name: "robot5", cost: 30, building: "factory", type: "vehicle", goodAgainstFactory: true}),
            entry({name: "demon_dragon", cost: 30, building: "hangar", type: "aircraft", flying: true, canAttackAir: true, goodAgainstAir: true}),
        ],
        buildings: [
            {type: "barrack", cost: 30},
            {type: "factory", cost: 60},
            {type: "hangar", cost: 50},
        ],
        powers: [
            {name: "turret", cost: 40, coolDown: 30_000},
            {name: "ionCannon", cost: 130, coolDown: 30_000},
        ],
        maxUnitCount: 10,
    };
}

function observation(overrides: {self?: Partial<Observation["self"]>; units?: OwnUnitInfo[]; enemies?: EnemyUnitInfo[]} = {}): Observation {
    return {
        tick: 600,
        timeMs: 10_000,
        canIssueCommands: true,
        self: {
            resource: 0,
            baseHealth: 30_000,
            maxBaseHealth: 30_000,
            createCoolDown: 0,
            armySize: 0,
            maxUnitCount: 10,
            buildings: ["castle", "spawn"],
            canCreate: [],
            unitCosts: {},
            freeHarvesters: 0,
            resources: [{tile: {col: 10, row: 3}, occupied: false}],
            powers: [
                {name: "turret", ready: false, coolDown: 0},
                {name: "ionCannon", ready: false, coolDown: 0},
            ],
            turretTiles: [],
            ...overrides.self,
        },
        units: overrides.units ?? [],
        visibleTiles: [],
        enemy: {baseHealth: 30_000, maxBaseHealth: 30_000, units: overrides.enemies ?? [], buildings: []},
        objective: {pads: [0, 0, 0], charge: 0, maxCharge: 60_000, peace: 0},
    };
}

const own = (id: number, col: number, row: number, overrides: Partial<OwnUnitInfo> = {}): OwnUnitInfo => ({
    id,
    name: "fantasy8",
    tile: {col, row},
    health: 1000,
    maxHealth: 1000,
    moving: false,
    parked: true,
    immobile: false,
    targetId: null,
    attackingBase: false,
    destination: null,
    givenUpOn: [],
    ...overrides,
});

const enemy = (id: number, col: number, row: number, overrides: Partial<EnemyUnitInfo> = {}): EnemyUnitInfo => ({
    id,
    name: "fantasy8",
    type: "infantry",
    tile: {col, row},
    health: 1000,
    maxHealth: 1000,
    moving: false,
    parked: true,
    harvester: false,
    ...overrides,
});

describe("BotBrain", () => {
    it("does nothing before the match accepts commands", () => {
        const brain = new BotBrain(matchInfo());
        expect(brain.decide({...observation({self: {resource: 500, canCreate: ["male_engineer"]}}), canIssueCommands: false})).toEqual([]);
    });

    it("opens with a harvester, then the barracks", () => {
        const brain = new BotBrain(matchInfo());
        const commands = brain.decide(observation({self: {resource: 100, canCreate: ["male_engineer"]}}));
        expect(commands).toEqual([
            {kind: "createUnit", playerIndex: 2, unit: "male_engineer"},
            {kind: "build", playerIndex: 2, building: "barrack"},
        ]);
    });

    it("recruits at most one unit per decision and stays within its money", () => {
        const brain = new BotBrain(matchInfo());
        const commands = brain.decide(
            observation({
                self: {resource: 40, buildings: ["castle", "spawn", "barrack"], canCreate: ["male_engineer", "fantasy8"]},
            })
        );
        // The harvester costs 60: not affordable, so the rifles are recruited instead
        expect(commands.filter(command => command.kind === "createUnit")).toEqual([{kind: "createUnit", playerIndex: 2, unit: "fantasy8"}]);
    });

    it("picks the counter to the visible enemies", () => {
        const brain = new BotBrain(matchInfo());
        const commands = brain.decide(
            observation({
                self: {resource: 200, buildings: ["castle", "spawn", "barrack", "factory"], canCreate: ["fantasy8", "robot5"]},
                units: [own(1, 10, 3, {name: "male_engineer"})],
                enemies: [enemy(50, 1, 1, {name: "robot5", type: "vehicle"})],
            })
        );
        expect(commands).toContainEqual({kind: "createUnit", playerIndex: 2, unit: "robot5"});
    });

    it("attacks the nearest visible threat within vision", () => {
        const brain = new BotBrain(matchInfo());
        const commands = brain.decide(observation({units: [own(1, 6, 6)], enemies: [enemy(70, 4, 6), enemy(71, 6, 5)]}));
        expect(commands).toContainEqual({kind: "attack", playerIndex: 2, unitIds: [1], targetId: 71});
    });

    it("skips enemies it gave up on and air units it cannot hit", () => {
        const brain = new BotBrain(matchInfo());
        const commands = brain.decide(
            observation({
                units: [own(1, 6, 6, {givenUpOn: [70]})],
                enemies: [enemy(70, 6, 5), enemy(71, 7, 6, {name: "demon_dragon", type: "aircraft"})],
            })
        );
        expect(commands.some(command => command.kind === "attack")).toBe(false);
    });

    it("only ever targets enemies from the observation", () => {
        const brain = new BotBrain(matchInfo());
        const commands = brain.decide(observation({units: [own(1, 9, 9), own(2, 3, 3)]}));
        expect(commands.some(command => command.kind === "attack")).toBe(false);
    });

    it("sends idle fighters to different pads", () => {
        const brain = new BotBrain(matchInfo());
        const commands = brain.decide(observation({units: [own(1, 10, 6), own(2, 10, 7), own(3, 9, 8, {moving: true})]}));
        const moves = commands.filter(command => command.kind === "move");
        expect(moves).toHaveLength(2);
        const tiles = moves.map(command => (command.kind === "move" ? `${command.tile.col},${command.tile.row}` : ""));
        expect(new Set(tiles).size).toBe(2);
    });

    it("holds a pad it already stands on", () => {
        const brain = new BotBrain(matchInfo());
        expect(brain.decide(observation({units: [own(1, 6, 6)]}))).toEqual([]);
    });

    it("fires the ion cannon on parked enemies worth most of its cost", () => {
        const brain = new BotBrain(matchInfo());
        const enemies = [
            enemy(80, 3, 6, {name: "robot5", type: "vehicle"}),
            enemy(81, 4, 6, {name: "robot5", type: "vehicle"}),
            enemy(82, 3, 5, {name: "robot5", type: "vehicle"}),
            enemy(83, 3, 7, {name: "robot5", type: "vehicle"}),
        ];
        const commands = brain.decide(
            observation({
                self: {
                    resource: 200,
                    powers: [
                        {name: "turret", ready: false, coolDown: 10_000},
                        {name: "ionCannon", ready: true, coolDown: 0},
                    ],
                },
                enemies,
            })
        );
        expect(commands[0]).toEqual({kind: "power", playerIndex: 2, power: "ionCannon", tile: {col: 3, row: 6}});
    });

    it("rebuilds a destroyed harvester for free, without waiting for an army", () => {
        const brain = new BotBrain(matchInfo());
        const units = [own(1, 10, 4, {name: "male_engineer"})];
        const self = {resource: 0, canCreate: ["male_engineer" as const]};
        // Full price and no army yet: the second harvester waits
        expect(brain.decide(observation({self: {...self, unitCosts: {male_engineer: 60}}, units}))).not.toContainEqual(
            expect.objectContaining({kind: "createUnit"})
        );
        // A free rebuild is waiting: recruit it, even with no money
        expect(brain.decide(observation({self: {...self, unitCosts: {male_engineer: 0}, freeHarvesters: 1}, units}))).toContainEqual({
            kind: "createUnit",
            playerIndex: 2,
            unit: "male_engineer",
        });
    });

    it("does not fire the ion cannon where it would destroy as much of its own army", () => {
        const brain = new BotBrain(matchInfo());
        const enemies = [
            enemy(80, 3, 6, {name: "robot5", type: "vehicle"}),
            enemy(81, 4, 6, {name: "robot5", type: "vehicle"}),
            enemy(82, 3, 5, {name: "robot5", type: "vehicle"}),
            enemy(83, 3, 7, {name: "robot5", type: "vehicle"}),
        ];
        const self = {
            resource: 200,
            powers: [
                {name: "turret" as const, ready: false, coolDown: 10_000},
                {name: "ionCannon" as const, ready: true, coolDown: 0},
            ],
        };
        const ion = expect.objectContaining({power: "ionCannon"});
        // Alone, the targets are worth the shot
        expect(brain.decide(observation({self, enemies}))).toContainEqual(ion);
        // The same army of its own in the blast (on the same hexes, only the distances matter) would be hit just as hard
        const units = enemies.map((target, i) => own(i + 1, target.tile.col, target.tile.row, {name: "robot5"}));
        expect(brain.decide(observation({self, enemies, units}))).not.toContainEqual(ion);
    });
});
