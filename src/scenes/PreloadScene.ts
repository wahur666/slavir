import * as Phaser from "phaser";
import type {SHARED_CONFIG} from "../main";
import {SceneRegistry} from "./SceneRegistry";
import Hex_v01_grid from "../assets/Hex_v01_grid.png";
import map1 from "../maps/map2.json";
import guard from "../assets/guard.png";
import female_archer from "../assets/female_archer.png";
import male_engineer from "../assets/male_engineer.png";
import castle from "../assets/castle_large.png";
import hangar from "../assets/hangar.png";
import barrack from "../assets/militaryTent.png";
import factory from "../assets/shop.png";
import tech from "../assets/saloon.png";
import spawn from "../assets/tileDirt_tile.png";
import black_dragon from "../assets/blackDragon.png";
import robot5 from "../assets/robot-5.png";
import fantasy8 from "../assets/fantasy-8.png";
import demon_dragon from "../assets/demondragon.png";
import crystals1 from "../assets/crystals1.png";

export enum Images {
    HEX_GRID = "hex-grid",
    GUARD = "guard",
    FEMALE_ARCHER = "female_archer",
    CASTLE = "castle",
    BARRACK = "barrack",
    FACTORY = "factory",
    HANGAR = "hangar",
    TECH = "tech",
    SPAWN = "spawn",
    MALE_ENGINEER = "male_engineer",
    BLACK_DRAGON = "black_dragon",
    ROBOT5 = "robot5",
    FANTASY8 = "fantasy8",
    DEMON_DRAGON = "demon_dragon",
    CRYSTAL = "crystals1",
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
        this.load.image(Images.BARRACK, barrack);
        this.load.image(Images.FACTORY, factory);
        this.load.image(Images.HANGAR, hangar);
        this.load.image(Images.TECH, tech);
        this.load.image(Images.SPAWN, spawn);
        this.load.image(Images.CRYSTAL, crystals1);

        this.load.spritesheet(Images.GUARD, guard, {
            frameWidth: 128,
            frameHeight: 128,
        });

        this.load.spritesheet(Images.BLACK_DRAGON, black_dragon, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(Images.ROBOT5, robot5, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(Images.FANTASY8, fantasy8, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(Images.DEMON_DRAGON, demon_dragon, {
            frameWidth: 128,
            frameHeight: 128,
        });

        this.load.spritesheet(Images.FEMALE_ARCHER, female_archer, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(Images.MALE_ENGINEER, male_engineer, {
            frameWidth: 128,
            frameHeight: 128
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
