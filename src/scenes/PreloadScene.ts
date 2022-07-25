import * as Phaser from "phaser";
import type {SHARED_CONFIG} from "../main";
import {SceneRegistry} from "./SceneRegistry";
import Hex_v01_grid from "../assets/Hex_v01_grid.png";
import map1 from "../assets/map2.json";
import castle from "../assets/castle_large.png";
import hangar from "../assets/hangar.png";
import barrack from "../assets/militaryTent.png";
import factory from "../assets/shop.png";
import tech from "../assets/saloon.png";
import spawn from "../assets/tileDirt_tile.png";
import assets from "../assets/assets.json";
import Resource from "../helpers/Resource";

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
    MALE_ENGINEER = "male_engineer"
}

export enum Tilemaps {
    MAP1 = "map1"
}

export default class PreloadScene extends Phaser.Scene {

    assets: { name: string, data: string }[];

    constructor(config: typeof SHARED_CONFIG) {
        super(SceneRegistry.PRELOAD);
        this.assets = assets.map(x => ({name: x.name, data: "data:image/png;base64, " + x.data}));
    }

    prepareResourcesToLoad() {
        return [
            ...Object.values(Images),
            ...assets.map(e => e.name)
        ].reduce((acc, item) => {
            acc.set(item, new Resource(item));
            return acc;
        }, new Map<string, Resource>());
    }

    preload() {
        const resources = this.prepareResourcesToLoad();
        const resourcesLoaded = Promise.all([...resources.values()].map(e => e.promise));
        this.textures.on("addtexture", (ev: string) => {
            if (resources.has(ev)) {
                console.log(`Resource ${ev} loaded!`);
                resources.get(ev)!.resolve();
            }
        });

        this.load.image(Images.HEX_GRID, Hex_v01_grid);
        this.load.image(Images.CASTLE, castle);
        this.load.image(Images.BARRACK, barrack);
        this.load.image(Images.FACTORY, factory);
        this.load.image(Images.HANGAR, hangar);
        this.load.image(Images.TECH, tech);
        this.load.image(Images.SPAWN, spawn);
        this.load.tilemapTiledJSON(Tilemaps.MAP1, map1);

        for (const asset of this.assets) {
            const img = new Image();
            img.src = asset.data;
            this.textures.addSpriteSheet(asset.name, img, {
                frameWidth: 128,
                frameHeight: 128
            });
        }

        this.load.once("complete", () => {
            resourcesLoaded.then(() => {
                this.startGame();
            });
        });
    }

    startGame() {
        this.scene.start(SceneRegistry.GAME);
    }

}