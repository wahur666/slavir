import Player from "./Player";
import Harvester from "../../entities/Harvester";
import type Systems from "../Systems";
import {UnitName} from "../../entities/UnitsStats";
import {Buildings} from "../../entities/Building";


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
            this.createBuilding(Buildings.BARRACK);
        }
    }

}
