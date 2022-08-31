import {Images} from "../scenes/PreloadScene";
import Vector2 = Phaser.Math.Vector2;
import type GameTile from "../model/GameTile";
import type GameScene from "../scenes/GameScene";

export interface BuildingStat {
    type: "castle" | "barrack" | "factory" | "hangar" | "tech" | "spawn",
    cost: number,
    origin?: Vector2;
    scale?: Vector2;
    texture: string
}
export const buildingStat: Map<string, BuildingStat> = new Map([
    ["castle", {
        type: "castle",
        cost: 0,
        scale: new Vector2(0.8),
        origin: new Vector2(0.5, 0.6),
        texture: Images.CASTLE
    }],
    ["barrack", {
        type: "barrack",
        texture: Images.BARRACK,
        scale: new Vector2(0.8),
        cost: 30
    }],
    ["factory", {
        type: "factory",
        texture: Images.FACTORY,
        scale: new Vector2(0.8),
        cost: 60
    }],
    ["hangar", {
        type: "hangar",
        texture: Images.HANGAR,
        scale: new Vector2(0.8),
        cost: 50
    }],
    ["tech", {
        type: "tech",
        cost: 100,
        scale: new Vector2(0.8),
        texture: Images.TECH
    }],
    ["spawn", {
        type: "spawn",
        cost: 0,
        scale: new Vector2(1.1),
        origin: new Vector2(0.5, 0.42),
        texture: Images.SPAWN
    }]
]);

export default class Building extends Phaser.GameObjects.Sprite {

    /** Important for the enemy base, if It's revealed or not */
    revealed = false;
    readonly stat: BuildingStat;
    scene: GameScene;

    constructor(scene: GameScene, x: number, y: number, stat: BuildingStat) {
        super(scene, x, y, stat.texture);
        this.stat = stat;
        if (this.stat.type === "spawn" || this.stat.type === "castle") {
            this.revealed = true;
        }
        if (this.stat.origin) {
            this.setOrigin(this.stat.origin.x, this.stat.origin.y);
        }
        if (this.stat.scale) {
            this.setScale(this.stat.scale.x, this.stat.scale.y);
        }
        scene.add.existing(this);

    }

    gameTile(): GameTile {
        return this.scene.pointToTile(this.x, this.y)!;
    }

}