import Player from "./Player";
import Harvester from "../../entities/Harvester";
import type Systems from "../Systems";


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

        }
    }

}
