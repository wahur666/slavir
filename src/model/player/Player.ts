import type Unit from "../../entities/Unit";
import type Building from "../../entities/Building";
import type GameTile from "../GameTile";
import type Resource from "../../entities/Resource";


export default abstract class Player {

    units: Unit[] = [];
    private buildings: Building[] = [];
    resources: Resource[] = [];
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

    numberOfHarvesters = 0;
    currentHarvestTime = 0;
    harvestTime = 5000;

    baseCreateCoolDown = 5000;
    createCoolDown = 0;

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

    update(delta: number) {
        this.currentHarvestTime +=  delta * 5 / (5 - this.numberOfHarvesters * 2);
        if (this.currentHarvestTime > this.harvestTime) {
            this.resource += 10;
            this.currentHarvestTime -= this.harvestTime;
            console.log(this.resource);
        }
        if (this.createCoolDown > 0) {
            this.createCoolDown = Math.max(0, this.createCoolDown - delta);
            console.log("Create cooldown", this.createCoolDown | 0);
        }
    }

    resetCreateCoolDown() {
        this.createCoolDown = this.baseCreateCoolDown * this.units.length;
    }
}
