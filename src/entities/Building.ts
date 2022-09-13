import {Images} from "../scenes/PreloadScene";
import Vector2 = Phaser.Math.Vector2;
import type GameTile from "../model/GameTile";
import type GameScene from "../scenes/GameScene";
import type Systems from "../model/Systems";

export enum Buildings {
    CASTLE = "castle",
    BARRACK = "barrack",
    FACTORY = "factory",
    HANGAR = "hangar",
    TECH = "tech",
    SPAWN = "spawn",
}

export interface BuildingStat {
    type:  Buildings
    cost: number,
    origin?: Vector2;
    scale?: Vector2;
    texture: string
}
export const buildingStat: Map<Buildings, BuildingStat> = new Map([
    [Buildings.CASTLE, {
        type: Buildings.CASTLE,
        cost: 0,
        scale: new Vector2(0.8),
        origin: new Vector2(0.5, 0.6),
        texture: Images.CASTLE
    }],
    [Buildings.BARRACK, {
        type: Buildings.BARRACK,
        texture: Images.BARRACK,
        scale: new Vector2(0.8),
        cost: 30
    }],
    [Buildings.FACTORY, {
        type: Buildings.FACTORY,
        texture: Images.FACTORY,
        scale: new Vector2(0.8),
        cost: 60
    }],
    [Buildings.HANGAR, {
        type: Buildings.HANGAR,
        texture: Images.HANGAR,
        scale: new Vector2(0.8),
        cost: 50
    }],
    [Buildings.TECH, {
        type: Buildings.TECH,
        cost: 100,
        scale: new Vector2(0.8),
        texture: Images.TECH
    }],
    [Buildings.SPAWN, {
        type: Buildings.SPAWN,
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
    private readonly systems: Systems;

    constructor(systems: Systems, x: number, y: number, stat: BuildingStat) {
        super(systems.gameScene, x, y, stat.texture);
        this.stat = stat;
        this.systems = systems;
        if (this.stat.type === "spawn" || this.stat.type === "castle") {
            this.revealed = true;
        }
        if (this.stat.origin) {
            this.setOrigin(this.stat.origin.x, this.stat.origin.y);
        }
        if (this.stat.scale) {
            this.setScale(this.stat.scale.x, this.stat.scale.y);
        }
        this.systems.gameScene.add.existing(this);
        this.setVisible(this.revealed);
    }

    setRevealed(revealed: boolean) {
        this.revealed = revealed;
        this.setVisible(this.revealed);
    }

    gameTile(): GameTile {
        return this.systems.pointToTile(this.x, this.y)!;
    }

}
