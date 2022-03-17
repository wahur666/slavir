import Phaser from "phaser";
import {SHARED_CONFIG} from "../main";
import {SceneRegistry} from "./SceneRegistry";
import {Images, Tilemaps} from "./PreloadScene";
import Pointer = Phaser.Input.Pointer;
import HexMap from "../model/HexMap";
import GameTile from "../model/GameTile";
import Graphics = Phaser.GameObjects.Graphics;
import {Hex} from "../model/hexgrid";
import Vector2 = Phaser.Math.Vector2;

enum LAYERS {
    BASE = "base"
}

const VisibilityColors = [0x545454, 0xFFFFFF];

enum TILESETS {
    Hex_v01_grid = "Hex_v01_grid"
}

export default class GameScene extends Phaser.Scene {

    currentTile: GameTile;
    scaleFactor = 3;
    visionRadius = 3;
    hexMap: HexMap;
    graphics: Graphics;
    texts: Phaser.GameObjects.Text[] = [];
    hexes: Set<Hex>;

    constructor(private config: typeof SHARED_CONFIG) {
        super(SceneRegistry.GAME);
    }

    create() {
        const map = this.createMap();
        const layers = this.createLayers(map);
        this.hexMap = new HexMap(layers);
        this.graphics = this.add.graphics();
        this.input.on("pointerdown", (ev: Pointer) => {
            const target = this.pointToTile(ev.x / this.scaleFactor | 0, ev.y / this.scaleFactor | 0);
            if (target) {
                this.setCurrentTile(target);
                this.drawVisibleTiles();
                this.drawTileDistance();
                // const hits = this.hexMap.getTileHits(this.currentTile, target);
                // this.graphics.clear();
                // this.graphics.lineStyle(1, 0, 1);
                // this.graphics.lineBetween(target.centerX, target.centerY, this.currentTile.centerX, this.currentTile.centerY).setScale(this.scaleFactor);
                // this.graphics.stroke();
                // hits.forEach(e => {
                //     this.debugHexPathFinding(e.tile);
                // });
            }
        });

        this.createMapRepresentation(new Vector2(layers.base.tilemap.width, layers.base.tilemap.height));

        for (const tile of this.hexMap.tiles) {
            tile.tile.tint = 0x545454;
        }

        this.setCurrentTile(this.hexMap.coordsToTile(4, 3));

        // this.drawHexes();
        this.drawVisibleTiles();
        this.drawTileDistance();
    }

    setCurrentTile(tile: GameTile): void {
        this.currentTile = tile;
        const colors = { blue: 0x0000FF, green: 0x00FF00, red: 0xFF0000};
        this.graphics.clear();
        this.graphics.lineStyle(1, colors.green, 1);
        const [centerX, centerY] = this.hexMap.getCenter(tile);
        this.graphics.strokeCircle(centerX, centerY, 5).setScale(this.scaleFactor);
    }

    drawVisibleTiles() {
        const visibleTiles = this.hexMap.visibleTiles(this.currentTile, this.visionRadius);
        for (const tile of this.hexMap.tiles) {
            if(tile === this.currentTile) {
                this.drawVisibility(this.currentTile, true);
                continue;
            }
            const nearTile = visibleTiles.find(e => e.tile === tile);
            if (nearTile) {
                this.drawVisibility(nearTile.tile, nearTile.visible);
            } else {
                this.drawVisibility(tile, false);
            }
        }
    }

    drawVisibility(tile: GameTile, visible: boolean) {
        if (tile.tile.index !== -1) {
            tile.tile.tint = VisibilityColors[Number(visible)];
        }
    }

    debugHexPathFinding(tile: GameTile) {
        if (this.config.debug && tile.tile.index !== -1) {
            // console.log(tile.x, tile.y);
            const colors = [0x0000FF, 0x00FF00, 0x00FFFF, 0xFF0000];
            this.graphics.lineStyle(1, colors[tile.pathfinding], 1);
            const [centerX, centerY] = this.hexMap.getCenter(tile);
            this.graphics.strokeCircle(centerX, centerY, 13);
        }
    }

    drawTileDistance() {
        if (this.texts.length === 0) {
            for (const tile of this.hexMap.tiles) {
                const [centerX, centerY] = this.hexMap.getCenter(tile);
                const text = tile.tile.index === -1 ? "" : this.hexMap.tileDistance(tile, this.currentTile) + "";
                this.texts.push(this.add.text(centerX * this.scaleFactor, centerY * this.scaleFactor, text, {
                    fontSize: "24px",
                    fontFamily: "Arial",
                    color: "red"
                }));
            }
        } else {
            for (let i = 0; i < this.texts.length; i++) {
                const tile = this.hexMap.tiles[i];
                const text = tile.tile.index === -1 ? "" : this.hexMap.tileDistance(tile, this.currentTile) + "";
                this.texts[i].setText(text);
            }
        }
    }

    pointToTile(x: number, y: number): GameTile | undefined {
        return this.hexMap.pixelToTile(x, y);
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

    createMapRepresentation(mapSize: Vector2) {
        this.hexes = new Set<Hex>();
        const left = 0;
        const right = mapSize.x - 1;
        const top = 0;
        const bottom = mapSize.y - 1;
        this.createPointyRectangle(top, bottom, left, right);
    }

    private drawHexes() {
        const graphics = this.add.graphics();
        for (const hex of this.hexes) {
            this.drawHex(graphics, hex);
        }
    }

    private createPointyRectangle(top: number, bottom: number, left: number, right: number) {
        for (let r = top; r <= bottom; r++) {
            const rOffset = Math.floor(r / 2);
            for (let q = left - rOffset; q <= right - rOffset; q++) {
                this.hexes.add(new Hex(q, r));
            }
        }
    }

    drawHex(graphics: Graphics, hex: Hex): void {
        const points = this.hexMap.layout.polygonCorners(hex);
        graphics.lineStyle(1, 0xFF0000, 1);
        graphics.strokePoints(points, true, true).setScale(this.scaleFactor);
    }
}


