import Phaser from "phaser";
import {SHARED_CONFIG} from "../main";
import {SceneRegistry} from "./SceneRegistry";
import {Images, Tilemaps} from "./PreloadScene";
import Pointer = Phaser.Input.Pointer;
import Tile = Phaser.Tilemaps.Tile;
import Vector2 = Phaser.Math.Vector2;
import GetLineToPolygon = Phaser.Geom.Intersects.GetLineToPolygon;

enum LAYERS {
    BASE = "base"
}

enum TILESETS {
    Hex_v01_grid = "Hex_v01_grid"
}

enum Pathfinding {
    WATER,
    GROUND,
    HIGH_GROUND,
    OBSTACLE
}

interface GameTile {
    tile: Tile,
    x: number,
    y: number,
    centerX: number,
    centerY: number,
    pathfinding: Pathfinding,
    center: Phaser.Math.Vector2,
    points: Phaser.Math.Vector2[],
    boundingPolygon: Phaser.Geom.Polygon;
}

export default class GameScene extends Phaser.Scene {

    height = 42;
    halfHeight = this.height / 2;
    width = 32;
    halfWidth = this.width / 2;

    currentTile: GameTile

    scaleFactor = 3;
    tiles: GameTile[];

    constructor(private config: typeof SHARED_CONFIG) {
        super(SceneRegistry.GAME);
    }

    create() {
        const map = this.createMap();
        const layers = this.createLayers(map);
        this.input.on("pointerdown", (event: Pointer) => {
            const tile = this.pointToTile(event.x, event.y);
            if (tile) {
                console.log(event.x, event.y, tile.x, tile.y);
            }
        });
        this.input.on("pointerdown", (ev: Pointer) => {
            const target = this.pointToTile(ev.x, ev.y);
            if (target) {
                const line = new Phaser.Geom.Line(target.centerX * this.scaleFactor, target.centerY * this.scaleFactor,
                    this.currentTile.centerX * this.scaleFactor, this.currentTile.centerY * this.scaleFactor);
                const hits = this.tiles.map( t => {
                    let out: Phaser.Math.Vector4 = new Phaser.Math.Vector4();
                    GetLineToPolygon(line, t.boundingPolygon, out);
                    return {t, out};
                });
                console.log(hits.filter(e => e.out.length()));
            }
            if (target) {
                const graphiics = this.add.graphics();
                graphiics.lineStyle(1, 0, 1);
                graphiics.lineBetween(target.centerX, target.centerY, this.currentTile.centerX, this.currentTile.centerY).setScale(this.scaleFactor);
                graphiics.stroke();
            }
        });
        this.tiles = [];
        layers.base.forEachTile(value => {
            const createTile = (tile: Tile) => {
                const val: GameTile = {
                    tile,
                    x: tile.x,
                    y: tile.y,
                    centerX: value.right - value.baseWidth / 2 - 0.5,
                    centerY: value.bottom - value.baseHeight / 2 - 1,
                    pathfinding: tile.properties.Pathfinding,
                    center: new Phaser.Math.Vector2(0, 0),
                    points: [],
                    boundingPolygon: new Phaser.Geom.Polygon()
                };
                val.center = new Phaser.Math.Vector2(val.centerX, val.centerY);
                val.points = [
                    new Phaser.Math.Vector2(val.centerX, val.centerY - 15),
                    new Phaser.Math.Vector2(val.centerX - this.halfWidth, val.centerY - 6),
                    new Phaser.Math.Vector2(val.centerX - this.halfWidth, val.centerY + 6),
                    new Phaser.Math.Vector2(val.centerX, val.centerY + 15),
                    new Phaser.Math.Vector2(val.centerX + this.halfWidth, val.centerY + 6),
                    new Phaser.Math.Vector2(val.centerX + this.halfWidth, val.centerY - 6),
                ].map(e => e.scale(this.scaleFactor));
                val.boundingPolygon = new Phaser.Geom.Polygon(val.points);
                return val;
            };
            const tile = createTile(value);
            this.tiles.push(tile);
            this.drawHexPolygon(tile);
            // this.debugHexPathFinding(tile);
        });
        this.debugFieldOfView();
    }

    drawHexPolygon(tile: GameTile) {
        const graphics = this.add.graphics();
        const points = tile.points;
        graphics.lineStyle(1, 0xFF0000,1);
        graphics.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) {
            graphics.lineTo(point.x, point.y);
        }
        graphics.closePath();
        graphics.stroke();
    }

    debugHexPathFinding(tile: GameTile) {
        if (this.config.debug && tile.tile.index !== -1) {
            console.log(tile.x, tile.y);
            const graphics = this.add.graphics();
            const colors = [0x0000FF, 0x00FF00, 0x00FFFF, 0xFF0000];
            graphics.lineStyle(1, colors[tile.pathfinding], 1);
            graphics.strokeCircle(tile.centerX, tile.centerY, 13).setScale(this.scaleFactor);
        }
    }

    debugFieldOfView() {
        const graphics = this.add.graphics();
        const colors = { blue: 0x0000FF, green: 0x00FF00, red: 0xFF0000};

        for (const tile of this.tiles) {
            if (tile.x === 4 && tile.y === 3) {
                this.currentTile = tile;
                graphics.lineStyle(1, colors.green, 1);
                graphics.strokeCircle(tile.centerX, tile.centerY, 5).setScale(this.scaleFactor);
            } else {
                this.add.text(tile.centerX * this.scaleFactor, tile.centerY * this.scaleFactor, "" + this.hexDistance(new Phaser.Math.Vector2(tile.x, tile.y), new Phaser.Math.Vector2(4, 3)), {
                    fontSize: "24px",
                    fontFamily: "Arial",
                    color: "red"
                });
            }
        }
    }

    pointToTile(x: number, y: number): GameTile | null {
        let tile: GameTile | null = null;
        let minDistance;

        const pointer = new Vector2(x, y).scale(1 / this.scaleFactor);
        this.tiles.forEach(((value, index) => {
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
        const obsticle = map.getObjectLayer("Obsticle");
        const resources = map.getObjectLayer("Resources");

        return {base, pad1, pad2, pad3, nuke, base1, base2, water, terrain, obsticle, resources};
    }

    update(time: number, delta: number) {

    }

    /* https://answers.unity.com/questions/960064/hexagon-grid-distance.html */
    hexDistance(start: Phaser.Math.Vector2, dest: Phaser.Math.Vector2): number {
        const dx = dest.x - start.x;
        const dy = dest.y - start.y;
        const y = Math.abs(dy);
        const x = Math.max(0, Math.abs(dx) - (y + Number(dx < 0) ^ (start.y % 2)) / 2);
        return Math.ceil(x + y);
    }

}


