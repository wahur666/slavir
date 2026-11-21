import Player from "./Player.js";
import Harvester from "../../entities/units/Harvester.js";
import type Systems from "../Systems.js";
import {UnitName} from "../../entities/UnitsStats.js";
import {unitStatMap} from "../../entities/units/UnitRegistry.js";
import type Unit from "../../entities/Unit.js";
import type {UnitStat} from "../../entities/UnitsStats.js";
import {Buildings, buildingStat} from "../../entities/Building.js";
import CommandHub from "../command/CommandHub.js";
import {PowerName, ionCannonDamage, powerStats} from "../power/PowerRules.js";
import type GameTile from "../GameTile.js";
import {maxSquadHealth} from "../../entities/Squad.js";

export default class AiPlayer extends Player {
    private decisionCoolDown = 0;

    constructor(index: number, systems: Systems) {
        super(index, systems);
    }

    update(delta: number) {
        super.update(delta);
        this.decisionCoolDown = Math.max(0, this.decisionCoolDown - delta);
        if (this.decisionCoolDown === 0) {
            this.play();
            this.decisionCoolDown = 1000;
        }
    }

    createUnit(e: UnitName): Unit | null {
        const unit = super.createUnit(e);
        if (unit) {
            unit.tint = 0xf6c5c5;
        }
        return unit;
    }

    play() {
        if (!this.gameScene.canIssueCommands) return;
        const liveUnits = this.units.filter(unit => !unit.markedForDeletion);
        const fighters = liveUnits.filter(unit => unit.stat.canAttack);
        const harvesters = liveUnits.filter(unit => unit instanceof Harvester);
        // Powers first: the ion cannon is only affordable when money piled up (e.g. at the unit cap)
        this.useIonCannon();
        this.useTurret();
        if (harvesters.length === 0 && this.resources.length > 0) this.produce(UnitName.Harvester);
        if (!this.hasBuildings.BARRACK) this.build(Buildings.BARRACK);

        // Expand after establishing a force, leaving money for another rifle squad.
        const nextBuilding = !this.hasBuildings.FACTORY ? Buildings.FACTORY : !this.hasBuildings.HANGAR ? Buildings.HANGAR : null;
        if (
            nextBuilding &&
            fighters.length >= (nextBuilding === Buildings.FACTORY ? 2 : 3) &&
            this.resource >= buildingStat.get(nextBuilding)!.cost + unitStatMap.get(UnitName.B1_Fantasy8)!.cost
        ) {
            this.build(nextBuilding);
        }
        if (harvesters.length === 1 && fighters.length >= 2 && this.resources.some(resource => !resource.occupied)) {
            this.produce(UnitName.Harvester);
        }
        const available = [...unitStatMap.values()].filter(stat => stat.canAttack && this.canCreateUnit(stat.texture));
        available.sort((a, b) => this.counterScore(b) - this.counterScore(a) || a.cost - b.cost);
        if (available.length > 0) this.produce(available[0].texture);

        const pads = [this.systems.pad1GameTiles, this.systems.pad2GameTiles, this.systems.pad3GameTiles];
        for (const unit of this.units) {
            if (unit.markedForDeletion || unit.immobile || !unit.stat.canAttack || unit.target || unit.moving) continue;
            // Enemies the unit found no room to attack from are skipped, it holds a pad instead
            const threat = this.visibleEnemyUnits
                .filter(enemy => unit.canAttack(enemy) && !unit.hasGivenUpOn(enemy))
                .sort((a, b) => unit.gameTile().distance(a.gameTile()) - unit.gameTile().distance(b.gameTile()))[0];
            if (threat && unit.gameTile().distance(threat.gameTile()) <= unit.stat.visionRadius) {
                this.systems.commands.issue({kind: "attack", playerIndex: this.index, unitIds: [unit.id], targetId: threat.id});
                continue;
            }
            // Hold a pad; send reinforcements to the least occupied pad.
            if (pads.some(pad => pad.includes(unit.gameTile()))) continue;
            const occupancy = (pad: (typeof pads)[number]) =>
                this.units.filter(
                    ally => !ally.markedForDeletion && (pad.includes(ally.gameTile()) || (ally.destination && pad.includes(ally.destination)))
                ).length;
            const destinations = [...pads].sort((a, b) => occupancy(a) - occupancy(b));
            for (const pad of destinations) {
                const tile = [...pad]
                    .sort((a, b) => unit.gameTile().distance(a) - unit.gameTile().distance(b))
                    .find(
                        tile =>
                            !this.units.some(
                                ally => ally !== unit && !ally.markedForDeletion && (ally.gameTile() === tile || ally.destination === tile)
                            )
                    );
                if (tile) {
                    this.systems.commands.issue({kind: "move", playerIndex: this.index, unitIds: [unit.id], tile: CommandHub.tileRef(tile)});
                    if (unit.moving) break;
                }
            }
        }
    }

    /** Worth of the enemy units an ion cannon on the tile would destroy, in cost (damaged units count partly) */
    private ionCannonValue(tile: GameTile): number {
        let value = 0;
        for (const enemy of this.visibleEnemyUnits) {
            if (enemy.markedForDeletion) continue;
            const damage = ionCannonDamage(enemy.stat.type, enemy instanceof Harvester, enemy.gameTile().distance(tile));
            value += (Math.min(damage, enemy.currentHealth) / maxSquadHealth(enemy.stat)) * enemy.stat.cost;
        }
        return value;
    }

    /** Fires at the enemies that hold still where it destroys the most, if that is worth most of its cost */
    private useIonCannon() {
        if (!this.powers.isReady(PowerName.IonCannon)) return;
        let best: {tile: GameTile; value: number} | null = null;
        // A moving unit would likely walk out of the blast in time
        for (const enemy of this.visibleEnemyUnits) {
            if (enemy.markedForDeletion || !enemy.parked) continue;
            const tile = enemy.gameTile();
            const value = this.ionCannonValue(tile);
            if (!best || value > best.value) best = {tile, value};
        }
        if (best && best.value >= powerStats[PowerName.IonCannon].cost * 0.75) {
            this.systems.commands.issue({kind: "power", playerIndex: this.index, power: PowerName.IonCannon, tile: CommandHub.tileRef(best.tile)});
        }
    }

    /** Drops a turret next to an enemy fighter that came close to the base or to the AI's units */
    private useTurret() {
        if (!this.powers.isReady(PowerName.Turret) || !this.base) return;
        const base = this.base;
        const allies = this.units.filter(unit => !unit.markedForDeletion);
        const threat = this.visibleEnemyUnits
            .filter(enemy => !enemy.markedForDeletion && enemy.stat.canAttack && !enemy.immobile)
            .filter(enemy => {
                const tile = enemy.gameTile();
                return tile.distance(base) <= 5 || allies.some(ally => ally.gameTile().distance(tile) <= 3);
            })
            .sort((a, b) => a.gameTile().distance(base) - b.gameTile().distance(base))[0];
        if (!threat) return;
        const threatTile = threat.gameTile();
        // In range of the threat with a clear line of fire, as close to home as possible
        const tile = [...this.visibleTiles]
            .filter(
                tile =>
                    tile.distance(threatTile) >= 1 &&
                    tile.distance(threatTile) <= 2 &&
                    this.systems.navigation.checkBlockade(tile, threatTile) &&
                    this.powers.canTarget(PowerName.Turret, tile)
            )
            .sort((a, b) => a.distance(base) - b.distance(base) || a.distance(threatTile) - b.distance(threatTile) || a.x - b.x || a.y - b.y)[0];
        if (tile) {
            this.systems.commands.issue({kind: "power", playerIndex: this.index, power: PowerName.Turret, tile: CommandHub.tileRef(tile)});
        }
    }

    private produce(unit: UnitName): boolean {
        return this.systems.commands.issue({kind: "createUnit", playerIndex: this.index, unit});
    }

    private build(building: Buildings): boolean {
        return this.systems.commands.issue({kind: "build", playerIndex: this.index, building});
    }

    private counterScore(stat: UnitStat): number {
        const enemies = this.visibleEnemyUnits.filter(enemy => !enemy.markedForDeletion && enemy.stat.canAttack);
        if (enemies.length === 0) return stat.texture === UnitName.B1_Fantasy8 ? 1 : 0;
        const countered = enemies.filter(enemy => this.isGoodAgainst(stat, enemy.stat)).length;
        return countered / enemies.length;
    }

    private isGoodAgainst(stat: UnitStat, enemy: UnitStat): boolean {
        switch (enemy.type) {
            case "aircraft":
                return stat.canAttackAir && stat.goodAgainstAir;
            case "vehicle":
                return stat.goodAgainstFactory;
            case "structure":
                return stat.goodAgainstFactory;
            default:
                return stat.goodAgainstInfantry;
        }
    }
}
