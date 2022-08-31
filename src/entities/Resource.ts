import type GameTile from "../model/GameTile";
import type GameScene from "../scenes/GameScene";


export default class Resource extends Phaser.GameObjects.Sprite {

    gameTile: GameTile;
    /** when a new "harvester" is created, the priority, which resource patch is automatically selected  */
    priority: number;
    /** The resource is available for 60 seconds of active harvesting */
    availableResource = 60 * 1000;
    free: (resource: Resource) => void;
    private _occupied = false;
    lastHarvestUpdate = 0;

    constructor(scene: GameScene, x: number, y: number, texture: string, gameTile: GameTile, priority: number, free: (resource: Resource) => void) {
        super(scene, x, y, texture);
        this.scene.add.existing(this);
        this.setScale(1.3);
        this.priority = priority;
        this.gameTile = gameTile;
        this.free = free;
    }

    get occupied() {
        return this._occupied;
    }

    startHarvesting() {
        this._occupied = true;
        this.lastHarvestUpdate = Date.now();
    }

    stopHarvesting() {
        this._occupied = false;
        this.lastHarvestUpdate = 0;
    }

    update() {
        if (this._occupied) {
            const now = Date.now();
            this.availableResource -= now - this.lastHarvestUpdate;
            this.lastHarvestUpdate = now;
            // console.log(this.availableResource);
        }
        if (this.availableResource <= 0) {
            this.free(this);
        }
    }

}
