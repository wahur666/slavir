import Phaser from "phaser";
import {SHARED_CONFIG} from "../main";
import {SceneRegistry} from "./SceneRegistry";
import {Images, Tilemaps} from "./PreloadScene";
import Graphics = Phaser.GameObjects.Graphics;
import Pointer = Phaser.Input.Pointer;

enum LAYERS {
    BASE = "base"
}

enum TILESETS {
    Hex_v01_grid = "Hex_v01_grid"
}

export default class GameScene extends Phaser.Scene {

    height = 42;
    halfHeight = this.height / 2;
    width = 32;
    halfWidth = this.width / 2;

    constructor(config: typeof SHARED_CONFIG) {
        super(SceneRegistry.GAME);
    }

    create() {
        const map = this.createMap();
        const layers = this.createLayers(map);
        this.input.on("pointerdown", (event: Pointer) => {
            console.log(event.x, event.y, this.calcAxialCoord(event.x, event.y));
        });
    }

    calcAxialCoord(x: number, y: number) {
        const size = 16 * 3;
        const q = (Math.sqrt(3) / 3 * x - 1. / 3 * y) / size;
        const r = (2. / 3 * y) / size;
        return [Math.round(q), Math.round(r)];
    }

    createMap(): Phaser.Tilemaps.Tilemap {
        const map = this.make.tilemap({
            key: Tilemaps.MAP1
        });
        map.addTilesetImage(TILESETS.Hex_v01_grid, Images.HEX_GRID);
        return map;
    }

    createLayers(map: Phaser.Tilemaps.Tilemap) {
        const baseTileset = map.getTileset(TILESETS.Hex_v01_grid);
        const base = map.createLayer(LAYERS.BASE, baseTileset, 0, 0)
            .setScale(3);

        return {base};
    }

    update(time: number, delta: number) {
    }

}


