import Player from "./Player";
import Harvester from "../../entities/Harvester";
import type Systems from "../Systems";
import {UnitName, unitStatMap} from "../../entities/UnitsStats";
import type Unit from "../../entities/Unit";
import type {UnitStat} from "../../entities/UnitsStats";
import {Buildings, buildingStat} from "../../entities/Building";


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
        if (harvesters.length === 0 && this.resources.length > 0) this.createUnit(UnitName.Harvester);
        if (!this.hasBuildings.BARRACK) this.buildBarrack();

        // Expand after establishing a force, leaving money for another rifle squad.
        const nextBuilding = !this.hasBuildings.FACTORY ? Buildings.FACTORY
            : !this.hasBuildings.HANGAR ? Buildings.HANGAR : null;
        if (nextBuilding && fighters.length >= (nextBuilding === Buildings.FACTORY ? 2 : 3)
            && this.resource >= buildingStat.get(nextBuilding)!.cost + unitStatMap.get(UnitName.B1_Fantasy8)!.cost) {
            this.createBuilding(nextBuilding);
        }
        if (harvesters.length === 1 && fighters.length >= 2 && this.resources.some(resource => !resource.occupied)) {
            this.createUnit(UnitName.Harvester);
        }
        const available = [...unitStatMap.values()].filter(stat => stat.canAttack && this.canCreateUnit(stat.texture));
        available.sort((a, b) => this.counterScore(b) - this.counterScore(a) || a.cost - b.cost);
        if (available.length > 0) this.createUnit(available[0].texture);

        const pads = [this.systems.pad1GameTiles, this.systems.pad2GameTiles, this.systems.pad3GameTiles];
        for (const unit of this.units) {
            if (unit.markedForDeletion || !unit.stat.canAttack || unit.target || unit.moving) continue;
            const threat = this.visibleEnemyUnits.filter(enemy => unit.canAttack(enemy))
                .sort((a, b) => unit.gameTile().distance(a.gameTile()) - unit.gameTile().distance(b.gameTile()))[0];
            if (threat && unit.gameTile().distance(threat.gameTile()) <= unit.stat.visionRadius) {
                unit.moveToGameTile(threat.gameTile(), threat);
                continue;
            }
            // Hold a pad; send reinforcements to the least occupied pad.
            if (pads.some(pad => pad.includes(unit.gameTile()))) continue;
            const occupancy = (pad: typeof pads[number]) => this.units.filter(ally => !ally.markedForDeletion
                && (pad.includes(ally.gameTile()) || (ally.destination && pad.includes(ally.destination)))).length;
            const destinations = [...pads].sort((a, b) => occupancy(a) - occupancy(b));
            for (const pad of destinations) {
                const tile = [...pad].sort((a, b) => unit.gameTile().distance(a) - unit.gameTile().distance(b))
                    .find(tile => !this.units.some(ally => ally !== unit && !ally.markedForDeletion
                        && (ally.gameTile() === tile || ally.destination === tile)));
                if (tile) {
                    unit.moveToGameTile(tile);
                    if (unit.moving) break;
                }
            }
        }
    }

    private counterScore(stat: UnitStat): number {
        const enemies = this.visibleEnemyUnits.filter(enemy => !enemy.markedForDeletion && enemy.stat.canAttack);
        if (enemies.length === 0) return stat.texture === UnitName.B1_Fantasy8 ? 1 : 0;
        const strengths = enemies.reduce((score, enemy) => score + (
            enemy.stat.type === "aircraft" ? (stat.canAttackAir && stat.goodAgainstAir ? 1 : 0)
                : enemy.stat.type === "vehicle" ? (stat.goodAgainstFactory ? 1 : 0)
                    : (stat.goodAgainstInfantry ? 1 : 0)), 0);
        return strengths / enemies.length;
    }

}
