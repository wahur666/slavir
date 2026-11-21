import type Building from "../../entities/Building.js";
import {Buildings, buildingStat} from "../../entities/Building.js";
import {maxSquadHealth} from "../../entities/Squad.js";
import type Unit from "../../entities/Unit.js";
import Harvester from "../../entities/units/Harvester.js";
import {unitStatMap} from "../../entities/units/UnitRegistry.js";
import type {BuildingType, EnemyUnitInfo, MatchInfo, Observation, OwnUnitInfo, PowerType, UnitType} from "../../net/Observation.js";
import CommandHub from "../command/CommandHub.js";
import type GameTile from "../GameTile.js";
import {Pathfinding} from "../HexMap.js";
import {PowerName, powerOrder, powerStats} from "../power/PowerRules.js";
import {TICK_MS} from "../replay/Replay.js";
import type Systems from "../Systems.js";
import type Player from "./Player.js";

/**
 * Builds what a networked player is told about the match. Fair by construction: enemy information comes only from
 * the player's own fog of war ({@link Player.visibleEnemyUnits}, {@link Player.visibleTiles}) and the enemy
 * buildings it has seen; the rest is the player's own state and what is on screen for both players.
 */

const ref = CommandHub.tileRef;

/** Static match facts, sent once when the match starts */
export function buildMatchInfo(systems: Systems, player: Player, observationIntervalMs: number): MatchInfo {
    const enemy = player.enemyPlayer;
    return {
        playerIndex: player.index,
        enemyIndex: enemy.index,
        tickMs: TICK_MS,
        observationIntervalMs,
        tiles: systems.map.tiles
            .filter(tile => tile.tile.index !== -1)
            .map(tile => ({col: tile.x, row: tile.y, q: tile.hex.q, r: tile.hex.r, ground: tile.pathfinding === Pathfinding.GROUND})),
        pads: [systems.pad1GameTiles, systems.pad2GameTiles, systems.pad3GameTiles].map(pad => pad.map(ref)),
        nuke: ref(systems.nukeGameTile),
        base: ref(player.base!),
        spawn: ref(player.spawn!),
        enemyBase: ref(enemy.base!),
        units: [...unitStatMap.values()].map(stat => ({
            name: stat.texture as UnitType,
            cost: stat.cost,
            building: stat.building as BuildingType,
            type: stat.type,
            canAttack: stat.canAttack,
            canAttackAir: stat.canAttackAir,
            goodAgainstInfantry: stat.goodAgainstInfantry,
            goodAgainstFactory: stat.goodAgainstFactory,
            goodAgainstAir: stat.goodAgainstAir,
            visionRadius: stat.visionRadius,
            attackRange: stat.attackRange,
            flying: stat.flying,
            limit: stat.limit,
            maxHealth: maxSquadHealth(stat),
            harvester: stat.className === Harvester,
        })),
        buildings: [...buildingStat.values()]
            .filter(stat => stat.type !== Buildings.CASTLE && stat.type !== Buildings.SPAWN)
            .map(stat => ({type: stat.type as BuildingType, cost: stat.cost})),
        powers: powerOrder.map(power => ({name: power as PowerType, cost: powerStats[power].cost, coolDown: powerStats[power].coolDown})),
        maxUnitCount: player.maxUnits,
    };
}

/**
 * The player's view of the match right now
 * @param seenEnemyBuildings enemy buildings the player has seen at least once
 */
export function buildObservation(systems: Systems, player: Player, tick: number, seenEnemyBuildings: ReadonlySet<Building>): Observation {
    const enemy = player.enemyPlayer;
    const visibleEnemies = player.visibleEnemyUnits.filter(unit => !unit.markedForDeletion);
    const objective = systems.objective;
    // Pad control is stored as player 1 minus player 2
    const side = player === systems.player1 ? 1 : -1;
    const turretReady = player.powers.isReady(PowerName.Turret);
    return {
        tick,
        timeMs: systems.gameScene.elapsedTime,
        canIssueCommands: systems.gameScene.canIssueCommands,
        self: {
            resource: player.resource,
            baseHealth: player.currentBaseHealth,
            maxBaseHealth: player.maxBaseHealth,
            createCoolDown: player.createCoolDown,
            armySize: player.army.length,
            maxUnitCount: player.maxUnits,
            buildings: player.buildings.map(building => building.stat.type as BuildingType),
            canCreate: [...unitStatMap.keys()].filter(name => player.canCreateUnit(name)) as UnitType[],
            unitCosts: Object.fromEntries([...unitStatMap.keys()].map(name => [name, player.unitCost(name)])),
            freeHarvesters: player.freeHarvesters,
            resources: player.resources.map(resource => ({tile: ref(resource.gameTile), occupied: resource.occupied})),
            powers: powerOrder.map(power => ({
                name: power as PowerType,
                ready: player.powers.isReady(power),
                coolDown: player.powers.coolDowns[power],
            })),
            turretTiles: turretReady ? [...player.visibleTiles].filter(tile => player.powers.canTarget(PowerName.Turret, tile)).map(ref) : [],
        },
        units: player.units.filter(unit => !unit.markedForDeletion).map(unit => ownUnit(unit, visibleEnemies)),
        visibleTiles: [...player.visibleTiles].map(ref),
        enemy: {
            baseHealth: enemy.currentBaseHealth,
            maxBaseHealth: enemy.maxBaseHealth,
            units: visibleEnemies.map(enemyUnit),
            buildings: enemy.buildings
                .filter(building => seenEnemyBuildings.has(building))
                .map(building => ({type: building.stat.type as BuildingType, tile: ref(building.gameTile())})),
        },
        objective: {
            pads: objective.pads.map(value => value * side),
            charge: objective.currentCoolDown,
            maxCharge: objective.maxCoolDown,
            peace: objective.peaceCoolDown,
        },
    };
}

/** Marks the enemy buildings standing on a tile the player sees; call every tick */
export function updateSeenBuildings(player: Player, seen: Set<Building>): void {
    for (const building of player.enemyPlayer.buildings) {
        if (!seen.has(building) && player.visibleTiles.has(building.gameTile())) seen.add(building);
    }
}

function ownUnit(unit: Unit, visibleEnemies: Unit[]): OwnUnitInfo {
    return {
        id: unit.id,
        name: unit.stat.texture as UnitType,
        tile: ref(unit.gameTile()),
        health: unit.currentHealth,
        maxHealth: maxSquadHealth(unit.stat),
        moving: unit.moving,
        parked: unit.parked,
        immobile: unit.immobile,
        targetId: unit.target?.id ?? null,
        destination: unit.destination ? ref(unit.destination as GameTile) : null,
        givenUpOn: visibleEnemies.filter(enemy => unit.hasGivenUpOn(enemy)).map(enemy => enemy.id),
    };
}

function enemyUnit(unit: Unit): EnemyUnitInfo {
    return {
        id: unit.id,
        name: unit.stat.texture as UnitType,
        type: unit.stat.type,
        tile: ref(unit.gameTile()),
        health: unit.currentHealth,
        maxHealth: maxSquadHealth(unit.stat),
        moving: unit.moving,
        parked: unit.parked,
        harvester: unit instanceof Harvester,
    };
}
