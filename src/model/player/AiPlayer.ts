import Player from "./Player";
import Harvester from "../../entities/Harvester";
import type Systems from "../Systems";
import {UnitName} from "../../entities/UnitsStats";


export default class AiPlayer extends Player {

    constructor(index: number, systems: Systems) {
        super(index, systems);
    }

    update(delta: number) {
        super.update(delta);

        this.play();
    }

    play() {
        if (this.units.filter(e => e instanceof Harvester).length === 0){
            this.createUnit(UnitName.Harvester);
        }
        if (!this.hasBuildings.BARRACK) {
            this.buildBarrack();
        } else {
            if (this.units.filter(e => !(e instanceof Harvester)).length === 0) {
                const unit = this.createUnit(UnitName.B1_Fantasy8);
                if (unit) {
                    unit.moveToGameTile(this.systems.pad2GameTiles[3]);
                }
            }
        }
    }

}
