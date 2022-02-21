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

    constructor(config: typeof SHARED_CONFIG) {
        super(SceneRegistry.GAME);
    }

    create() {
        const map = this.createMap();
        const layers = this.createLayers(map);
        this.input.on("pointerdown", (event: Pointer) => {
            console.log(event.x, event.y, this.calcAxialCoord(event.x, event.y));
        });
        this.drawHexagons();
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

    height = 42;
    halfHeight = this.height / 2;
    width = 32;
    halfWidth = this.width / 2;

    drawHexagons() {

        const hex = this.add.graphics();

        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                hex.beginPath();
                hex.lineStyle(1, 0x00ff00, 1.0);
                hex.moveTo(this.halfWidth + i * this.width, 5 + this.height * j);
                hex.lineTo(i * this.width, 14 + this.height * j);
                hex.lineTo(i * this.width, 26 + this.height * j);
                hex.lineTo(this.halfWidth + i * this.width, 34 + this.height * j);
                hex.lineTo((i + 1) * this.width, 26 + this.height * j);
                hex.lineTo((i + 1) * this.width, 14 + this.height * j);
                hex.closePath();
                hex.lineBetween(i * this.width, 14 + this.height * j, (i + 1) * this.width, 26 + this.height * j);
                hex.lineBetween(i * this.width, 26 + this.height * j, (i + 1) * this.width, 14 + this.height * j);
                hex.setScale(3);
                hex.strokePath();
                hex.fillCircle(this.halfWidth + i * this.width, this.halfHeight - 1 + this.height * j, 2);
                hex.strokePath();
            }
        }

        // for (let i = 0; i < 5; i++) {
        //     for (let j = 0; j < 5; j++) {
        //         hex.beginPath();
        //         hex.lineStyle(1, 0xff0000, 1.0);
        //         hex.moveTo(16 + i * 32,5 + 42 * j);
        //         hex.lineTo(i * 32, 14 + 42 * j);
        //         hex.lineTo(i * 32, 25 + 42 * j);
        //         hex.lineTo(16 + i * 32, 34 + 42 * j)
        //         hex.lineTo(32 + i * 32, 25 + 42 * j)
        //         hex.lineTo(32 + i * 32, 14 + 42 * j)
        //         hex.closePath();
        //         hex.setScale(3);
        //         hex.strokePath();
        //     }
        // }
    }
}


