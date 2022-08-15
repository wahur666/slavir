import type Unit from "../../entities/Unit";
import type Building from "../../entities/Building";
import type GameTile from "../GameTile";


export default abstract class Player {

    units: Unit[] = [];
    private buildings: Building[] = [];
    base: GameTile | undefined;
    spawn: GameTile | undefined;
    baseHealth = 1000;
    resource = 100;
    hasBuildings = {
        BARRACK: false,
        FACTORY: false,
        HANGAR: false,
        TECH: false
    };

    constructor(public index: number) {
    }

    addBuilding(building: Building, tile: GameTile) {
        if (building.stat.type === "castle") {
            this.base = tile;
        } else if (building.stat.type === "spawn") {
            this.spawn = tile;
        }
        this.buildings.push(building);
    }

}
