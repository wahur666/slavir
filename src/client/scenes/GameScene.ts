import Phaser from "phaser";
import {SHARED_CONFIG} from "../main";
import {SceneRegistry} from "./SceneRegistry";
import {Images, Tilemaps} from "./PreloadScene";
import Pointer = Phaser.Input.Pointer;
import Vector2 = Phaser.Math.Vector2;
import HexMap from "../model/HexMap";
import GameTile from "../model/GameTile";
import Graphics = Phaser.GameObjects.Graphics;

enum LAYERS {
    BASE = "base"
}

enum TILESETS {
    Hex_v01_grid = "Hex_v01_grid"
}

export default class GameScene extends Phaser.Scene {

    currentTile: GameTile;
    scaleFactor = 3;
    visionRadius = 3;
    hexMap: HexMap;
    graphics: Graphics;

    constructor(private config: typeof SHARED_CONFIG) {
        super(SceneRegistry.GAME);
    }

    create() {
        const map = this.createMap();
        const layers = this.createLayers(map);
        this.hexMap = new HexMap(layers);
        this.graphics = this.add.graphics();
        this.input.on("pointerdown", (ev: Pointer) => {
            const target = this.pointToTile(ev.x, ev.y);
            if (target) {
                const hits = this.hexMap.getTileHits(this.currentTile, target);
                this.graphics.clear();
                this.graphics.lineStyle(1, 0, 1);
                this.graphics.lineBetween(target.centerX, target.centerY, this.currentTile.centerX, this.currentTile.centerY).setScale(this.scaleFactor);
                this.graphics.stroke();
                hits.forEach(e => {
                    this.debugHexPathFinding(e.tile);
                });
            }
        });

        for (const tile of this.hexMap.tiles) {
            if (tile.x === 4 && tile.y === 3) {
                this.currentTile = tile;
            }
        }
        this.debugFieldOfView();
        this.drawVisibleTiles();
        // this.logDistances();
    }



    logDistances() {
        this.hexMap.tiles.forEach(value => {
            console.log(value.coords, this.hexMap.tileDistance(value, this.currentTile));
        });
    }

    drawVisibleTiles() {
        const visibleTiles = this.hexMap.visibleTiles(this.currentTile, this.visionRadius);

        visibleTiles.forEach(value => {
            this.debugHexVisibility(value.tile, value.visible);
        });
    }

    debugHexVisibility(tile: GameTile, visible: boolean) {
        if (tile.tile.index !== -1) {
            const graphics = this.add.graphics();
            const colors = {
                red: 0xFF0000,
                green: 0x00FF00
            };
            graphics.fillStyle(visible ? colors.green : colors.red, 1);
            graphics.fillCircle(tile.centerX, tile.centerY, 5).setScale(this.scaleFactor);
        }
    }

    debugHexPathFinding(tile: GameTile) {
        if (this.config.debug && tile.tile.index !== -1) {
            // console.log(tile.x, tile.y);
            const colors = [0x0000FF, 0x00FF00, 0x00FFFF, 0xFF0000];
            this.graphics.lineStyle(1, colors[tile.pathfinding], 1);
            this.graphics.strokeCircle(tile.centerX, tile.centerY, 13).setScale(this.scaleFactor);
        }
    }

    debugFieldOfView() {
        const graphics = this.add.graphics();
        const colors = { blue: 0x0000FF, green: 0x00FF00, red: 0xFF0000};

        for (const tile of this.hexMap.tiles) {
            if (tile.x === 4 && tile.y === 3) {
                this.currentTile = tile;
                graphics.lineStyle(1, colors.green, 1);
                graphics.strokeCircle(tile.centerX, tile.centerY, 5).setScale(this.scaleFactor);
            } else {
                // this.add.text(tile.centerX * this.scaleFactor, tile.centerY * this.scaleFactor, "" + this.hexDistance(new Phaser.Math.Vector2(tile.x, tile.y), new Phaser.Math.Vector2(4, 3)), {
                //     fontSize: "24px",
                //     fontFamily: "Arial",
                //     color: "red"
                // });
            }
        }
    }

    pointToTile(x: number, y: number): GameTile | null {
        let tile: GameTile | null = null;
        let minDistance;

        const pointer = new Vector2(x, y).scale(1 / this.scaleFactor);
        this.hexMap.tiles.forEach(((value, index) => {
            const distance = pointer.distanceSq(value.center);
            if (index === 0) {
                tile = value;
                minDistance = distance;
            } else {
                if (minDistance > distance) {
                    minDistance = distance;
                    tile = value;
                }
            }
        }));


        return tile;
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
            .setScale(this.scaleFactor);
        const pad1 = map.getObjectLayer("Pad1");
        const pad2 = map.getObjectLayer("Pad2");
        const pad3 = map.getObjectLayer("Pad3");
        const nuke = map.getObjectLayer("Nuke");
        const base1 = map.getObjectLayer("Base1");
        const base2 = map.getObjectLayer("Base2");
        const water = map.getObjectLayer("Water");
        const terrain = map.getObjectLayer("Terrain");
        const obstacle = map.getObjectLayer("Obsticle");
        const resources = map.getObjectLayer("Resources");

        return {base, pad1, pad2, pad3, nuke, base1, base2, water, terrain, obsticle: obstacle, resources};
    }

    update(time: number, delta: number) {

    }

}


