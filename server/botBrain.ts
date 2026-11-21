import type {TileRef} from "../src/model/command/Command.js";
import {
    type BuildingType,
    type EnemyUnitInfo,
    hexDistance,
    type MatchInfo,
    type Observation,
    type OwnUnitInfo,
    type PowerType,
    sameTile,
    type TileInfo,
    tileKey,
    type UnitCatalogEntry,
    type UnitType,
    type WireCommand,
} from "../src/net/Observation.js";
import {ionCannonDamage, UNITS_PER_HEX} from "../src/model/power/PowerRules.js";

const HARVESTER: UnitType = "male_engineer";
const RIFLES: UnitType = "fantasy8";
const BARRACK: BuildingType = "barrack";
const FACTORY: BuildingType = "factory";
const HANGAR: BuildingType = "hangar";
const ION_CANNON: PowerType = "ionCannon";
const TURRET: PowerType = "turret";

/**
 * The decisions of the built-in AiPlayer, made on an {@link Observation} instead of the live simulation, so they
 * can run in another process. It only knows what the observation tells it: its own state, visible enemies and
 * the public match state.
 *
 * Differences to AiPlayer, which acts on the simulation directly:
 * - Commands are decided in one go, so the brain keeps its own budget and tile reservations for the batch
 *   instead of seeing each command's effect right away; it recruits at most one unit per decision.
 * - The turret's line of fire is not checked; the observation does not carry line of sight between tiles.
 */
export default class BotBrain {
    private readonly tiles = new Map<string, TileInfo>();
    private readonly catalog = new Map<UnitType, UnitCatalogEntry>();

    constructor(readonly info: MatchInfo) {
        for (const tile of info.tiles) this.tiles.set(tileKey(tile), tile);
        for (const entry of info.units) this.catalog.set(entry.name, entry);
    }

    distance(a: TileRef, b: TileRef): number {
        const ta = this.tiles.get(tileKey(a));
        const tb = this.tiles.get(tileKey(b));
        return ta && tb ? hexDistance(ta, tb) : Number.POSITIVE_INFINITY;
    }

    decide(obs: Observation): WireCommand[] {
        if (!obs.canIssueCommands) return [];
        const playerIndex = this.info.playerIndex;
        const commands: WireCommand[] = [];
        let budget = obs.self.resource;
        const buildings = new Set(obs.self.buildings);

        const fighters = obs.units.filter(unit => this.stat(unit.name)?.canAttack);
        const harvesters = obs.units.filter(unit => this.stat(unit.name)?.harvester);

        // Powers first: the ion cannon is only affordable when money piled up (e.g. at the unit cap)
        const ion = this.ionCannon(obs, budget);
        if (ion) {
            commands.push({kind: "power", playerIndex, power: ION_CANNON, tile: ion});
            budget -= this.powerCost(ION_CANNON);
        }
        const turret = this.turret(obs, budget);
        if (turret) {
            commands.push({kind: "power", playerIndex, power: TURRET, tile: turret});
            budget -= this.powerCost(TURRET);
        }

        let recruited = false;
        const produce = (unit: UnitType) => {
            const stat = this.stat(unit);
            // A destroyed harvester is rebuilt for free
            const cost = obs.self.unitCosts[unit] ?? stat?.cost ?? 0;
            if (recruited || !stat || !obs.self.canCreate.includes(unit) || budget < cost) return;
            commands.push({kind: "createUnit", playerIndex, unit});
            budget -= cost;
            recruited = true;
        };
        const build = (building: BuildingType) => {
            const cost = this.buildingCost(building);
            if (buildings.has(building) || budget < cost) return;
            commands.push({kind: "build", playerIndex, building});
            budget -= cost;
            buildings.add(building);
        };

        if (harvesters.length === 0 && obs.self.resources.length > 0) produce(HARVESTER);
        if (!buildings.has(BARRACK)) build(BARRACK);

        // Expand after establishing a force, leaving money for another rifle squad
        const nextBuilding = !buildings.has(FACTORY) ? FACTORY : !buildings.has(HANGAR) ? HANGAR : null;
        if (
            nextBuilding &&
            fighters.length >= (nextBuilding === FACTORY ? 2 : 3) &&
            budget >= this.buildingCost(nextBuilding) + (this.stat(RIFLES)?.cost ?? 0)
        ) {
            build(nextBuilding);
        }
        // The second harvester waits for an army, unless it is a free replacement of a destroyed one
        if (
            harvesters.length === 1 &&
            (fighters.length >= 2 || obs.self.freeHarvesters > 0) &&
            obs.self.resources.some(resource => !resource.occupied)
        ) {
            produce(HARVESTER);
        }
        const available = this.info.units.filter(stat => stat.canAttack && obs.self.canCreate.includes(stat.name));
        available.sort((a, b) => this.counterScore(b, obs) - this.counterScore(a, obs) || a.cost - b.cost);
        if (available.length > 0) produce(available[0].name);

        commands.push(...this.orderUnits(obs));
        return commands;
    }

    /** Attack visible threats within vision, otherwise hold a pad or reinforce the least occupied one */
    private orderUnits(obs: Observation): WireCommand[] {
        const playerIndex = this.info.playerIndex;
        const commands: WireCommand[] = [];
        const pads = this.info.pads;
        const onPad = (pad: TileRef[], tile: TileRef | null) => !!tile && pad.some(padTile => sameTile(padTile, tile));
        /** Tiles units were sent to in this batch, not yet visible as destinations */
        const sentTo = new Map<number, TileRef>();
        const destinationOf = (unit: OwnUnitInfo) => sentTo.get(unit.id) ?? unit.destination;

        for (const unit of obs.units) {
            const stat = this.stat(unit.name);
            if (!stat?.canAttack || unit.immobile || unit.targetId !== null || unit.moving) continue;
            // Enemies the unit found no room to attack from are skipped, it holds a pad instead
            const threat = obs.enemy.units
                .filter(enemy => this.canAttack(stat, enemy) && !unit.givenUpOn.includes(enemy.id))
                .sort((a, b) => this.distance(unit.tile, a.tile) - this.distance(unit.tile, b.tile))[0];
            if (threat && this.distance(unit.tile, threat.tile) <= stat.visionRadius) {
                commands.push({kind: "attack", playerIndex, unitIds: [unit.id], targetId: threat.id});
                continue;
            }
            if (pads.some(pad => onPad(pad, unit.tile))) continue;
            const occupancy = (pad: TileRef[]) => obs.units.filter(ally => onPad(pad, ally.tile) || onPad(pad, destinationOf(ally))).length;
            const destinations = [...pads].sort((a, b) => occupancy(a) - occupancy(b));
            for (const pad of destinations) {
                const tile = [...pad]
                    .sort((a, b) => this.distance(unit.tile, a) - this.distance(unit.tile, b))
                    .find(tile => !obs.units.some(ally => ally !== unit && (sameTile(ally.tile, tile) || sameTile(destinationOf(ally), tile))));
                if (tile) {
                    commands.push({kind: "move", playerIndex, unitIds: [unit.id], tile});
                    sentTo.set(unit.id, tile);
                    break;
                }
            }
        }
        return commands;
    }

    /**
     * Worth of the enemy units an ion cannon on the tile would destroy, minus the bot's own units caught in the blast
     * (it hits everyone), in cost (damaged units count partly), plus the base damage
     */
    private ionCannonValue(tile: TileRef, obs: Observation): number {
        // Positions are only known by hex: measured from hex center to hex center
        const worth = (
            unit: {name: UnitType; tile: TileRef; health: number; maxHealth: number},
            type: UnitCatalogEntry["type"],
            harvester: boolean
        ) => {
            const hexes = this.distance(unit.tile, tile);
            const damage = ionCannonDamage(type, harvester, hexes * UNITS_PER_HEX, hexes);
            return (Math.min(damage, unit.health) / unit.maxHealth) * (this.stat(unit.name)?.cost ?? 0);
        };
        const gain = obs.enemy.units.reduce((sum, enemy) => sum + worth(enemy, enemy.type, enemy.harvester), 0);
        const loss = obs.units.reduce((sum, own) => {
            const stat = this.stat(own.name);
            return sum + worth(own, own.immobile ? "structure" : (stat?.type ?? "vehicle"), stat?.harvester ?? false);
        }, 0);
        // Base damage, valued at a credit per 40 health: a direct hit (4000) is worth about one shot
        const baseDamage = (base: TileRef) => ionCannonDamage("structure", false, 0, this.distance(base, tile)) / 40;
        return gain - loss + baseDamage(this.info.enemyBase) - baseDamage(this.info.base);
    }

    /** Fires at the enemies that hold still where it destroys the most, if that is worth most of its cost */
    private ionCannon(obs: Observation, budget: number): TileRef | null {
        if (!this.powerReady(obs, ION_CANNON, budget)) return null;
        let best: {tile: TileRef; value: number} | null = null;
        // A moving unit would likely walk out of the blast in time
        for (const enemy of obs.enemy.units) {
            if (!enemy.parked) continue;
            const value = this.ionCannonValue(enemy.tile, obs);
            if (!best || value > best.value) best = {tile: enemy.tile, value};
        }
        return best && best.value >= this.powerCost(ION_CANNON) * 0.75 ? best.tile : null;
    }

    /** Drops a turret next to an enemy fighter that came close to the base or to the bot's units */
    private turret(obs: Observation, budget: number): TileRef | null {
        if (!this.powerReady(obs, TURRET, budget)) return null;
        const base = this.info.base;
        const threat = obs.enemy.units
            .filter(enemy => this.stat(enemy.name)?.canAttack && enemy.type !== "structure")
            .filter(enemy => this.distance(enemy.tile, base) <= 5 || obs.units.some(ally => this.distance(ally.tile, enemy.tile) <= 3))
            .sort((a, b) => this.distance(a.tile, base) - this.distance(b.tile, base))[0];
        if (!threat) return null;
        // In range of the threat, as close to home as possible
        const tile = obs.self.turretTiles
            .filter(tile => {
                const distance = this.distance(tile, threat.tile);
                return distance >= 1 && distance <= 2;
            })
            .sort(
                (a, b) =>
                    this.distance(a, base) - this.distance(b, base) ||
                    this.distance(a, threat.tile) - this.distance(b, threat.tile) ||
                    a.col - b.col ||
                    a.row - b.row
            )[0];
        return tile ?? null;
    }

    private counterScore(stat: UnitCatalogEntry, obs: Observation): number {
        const enemies = obs.enemy.units.filter(enemy => this.stat(enemy.name)?.canAttack);
        if (enemies.length === 0) return stat.name === RIFLES ? 1 : 0;
        const countered = enemies.filter(enemy => this.isGoodAgainst(stat, enemy.type)).length;
        return countered / enemies.length;
    }

    private isGoodAgainst(stat: UnitCatalogEntry, enemyType: EnemyUnitInfo["type"]): boolean {
        switch (enemyType) {
            case "aircraft":
                return stat.canAttackAir && stat.goodAgainstAir;
            case "vehicle":
            case "structure":
                return stat.goodAgainstFactory;
            default:
                return stat.goodAgainstInfantry;
        }
    }

    private canAttack(stat: UnitCatalogEntry, enemy: EnemyUnitInfo): boolean {
        return stat.canAttack && (enemy.type !== "aircraft" || stat.canAttackAir);
    }

    private powerReady(obs: Observation, power: PowerType, budget: number): boolean {
        const state = obs.self.powers.find(entry => entry.name === power);
        return !!state?.ready && budget >= this.powerCost(power);
    }

    private stat(name: UnitType): UnitCatalogEntry | undefined {
        return this.catalog.get(name);
    }

    private powerCost(power: PowerType): number {
        return this.info.powers.find(entry => entry.name === power)?.cost ?? Number.POSITIVE_INFINITY;
    }

    private buildingCost(building: BuildingType): number {
        return this.info.buildings.find(entry => entry.type === building)?.cost ?? Number.POSITIVE_INFINITY;
    }
}
