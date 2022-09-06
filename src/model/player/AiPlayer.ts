import Player from "./Player";
import Harvester from "../../entities/Harvester";
import type Systems from "../Systems";
import {UnitName, unitStatMap} from "../../entities/UnitsStats";
import type Unit from "../../entities/Unit";


export default class AiPlayer extends Player {

    constructor(index: number, systems: Systems) {
        super(index, systems);
    }

    update(delta: number) {
        super.update(delta);
        this.play();
    }

    createUnit(e: UnitName): Unit | null {
        const unit = super.createUnit(e);
        if (unit) {
            unit.tint = 0xf6c5c5;
        }
        return unit;
    }

    play() {
        if (this.units.filter(e => e instanceof Harvester).length === 0){
            this.createUnit(UnitName.Harvester);
        }
        if (!this.hasBuildings.BARRACK) {
            this.buildBarrack();
        } else {
            if (this.units.filter(e => !(e instanceof Harvester)).length === 0) {
                if (this.resource >= unitStatMap.get(UnitName.B1_Fantasy8)!.cost) {
                    const unit = this.createUnit(UnitName.B1_Fantasy8);
                    if (unit) {
                        unit.moveToGameTile(this.systems.pad2GameTiles[3]);
                    }
                }
            }
        }
    }

}
