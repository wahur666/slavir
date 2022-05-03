import * as Phaser from "phaser";
import {SHARED_CONFIG} from "../main";
import {SceneRegistry} from "./SceneRegistry";
import Hex_v01_grid from "../assets/Hex_v01_grid.png";
import map1 from "../assets/map2.json";
import guard from "../assets/guard.png";
import female_archer from "../assets/female_archer.png";
import castle from "../assets/castle_large.png";

export enum Images {
    HEX_GRID = "hex-grid",
    GUARD = "guard",
    FEMALE_ARCHER = "female_archer",
    CASTLE = "castle"
}

export enum Tilemaps {
    MAP1 = "map1"
}

export default class PreloadScene extends Phaser.Scene {

    constructor(config: typeof SHARED_CONFIG) {
        super(SceneRegistry.PRELOAD);
    }

    preload() {
        this.load.image(Images.HEX_GRID, Hex_v01_grid);
        this.load.image(Images.CASTLE, castle);
        this.load.spritesheet(Images.GUARD, guard, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(Images.FEMALE_ARCHER, female_archer, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.tilemapTiledJSON(Tilemaps.MAP1, map1);

        this.load.once("complete", () => {
            this.startGame();
        });
    }

    startGame() {
        this.scene.start(SceneRegistry.GAME);
    }

}
