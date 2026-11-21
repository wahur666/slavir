import Player from "./Player.js";
import Harvester from "../../entities/units/Harvester.js";
import type Systems from "../Systems.js";
import {UnitName} from "../../entities/UnitsStats.js";
import {unitStatMap} from "../../entities/units/UnitRegistry.js";
import type Unit from "../../entities/Unit.js";
import type {UnitStat} from "../../entities/UnitsStats.js";
import {Buildings, buildingStat} from "../../entities/Building.js";
import CommandHub from "../command/CommandHub.js";

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
            if (unit.markedForDeletion || !unit.stat.canAttack || unit.target || unit.moving) continue;
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
            default:
                return stat.goodAgainstInfantry;
        }
    }
}
