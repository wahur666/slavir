import type GameTile from "../model/GameTile";
import type GameScene from "../scenes/GameScene";


export default class Resource extends Phaser.GameObjects.Sprite {

    gameTile: GameTile;
    /** when a new "harvester" is created, the priority, which resource patch is automatically selected  */
    priority: number;
    /** The resource is available for 100 seconds of active harvesting */
    availableResource =  100_000;
    free: (resource: Resource) => void;
    occupied = false;

    constructor(scene: GameScene, x: number, y: number, texture: string, gameTile: GameTile, priority: number, free: (resource: Resource) => void) {
        super(scene, x, y, texture);
        this.scene.add.existing(this);
        this.setScale(1.3);
        this.priority = priority;
        this.gameTile = gameTile;
        this.free = free;
    }

    update(delta: number) {
        if (this.occupied) {
            this.availableResource -= delta;
            // console.log(this.availableResource);
        }
        if (this.availableResource <= 0) {
            this.free(this);
        }
    }

}
