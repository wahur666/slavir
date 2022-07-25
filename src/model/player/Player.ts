import type Unit from "../../entities/Unit";
import type GameTile from "../GameTile";


export default abstract class Player {

    units: Unit[] = [];
    buildings: {
        CASTLE?: GameTile,
        BARRACK?: GameTile,
        FACTORY?: GameTile,
        HANGAR?: GameTile,
        TECH?: GameTile,
        SPAWN?: GameTile
    } = {};

    constructor(public index: number) {
    }

}
