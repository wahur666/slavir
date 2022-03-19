import GameTile from "./GameTile";
import Phaser from "phaser";
import {Hex, Layout, OffsetCoordinate} from "./hexgrid";
import Tile = Phaser.Tilemaps.Tile;
import Vector2 = Phaser.Math.Vector2;
import Point = Phaser.Geom.Point;

export enum Pathfinding {
    WATER = 1,
    GROUND= 2,
    HIGH_GROUND = 4,
    OBSTACLE = 8
}

function pointToArray(p: Point): [number, number] {
    return [p.x, p.y];
}

export default class HexMap {
    tiles: GameTile[] = [];
    layers;
    layout: Layout;
    // Half width and height offset
    tileOrigin: Vector2;
    /** Tile Size with isometric hexagons, needs to be adjusted for size difference
     * tileWidth = sqrt(3) * size => size = tileWidth / sqrt(3)
     * tileHeight = 2 * size => size = tileHeight / 2, but because 1/3 of the tile is not used, needs to be cut off, so 2 + 1
     */
    tileSize: Phaser.Math.Vector2;
    // Number of columns and rows
    mapSize: Vector2;

    constructor(layers) {
        const sqrt3 = Math.sqrt(3);
        this.layers = layers;
        layers.base.forEachTile((value: Tile) => {
            const tile = new GameTile(value);
            this.tiles.push(tile);
        });
        const tilemap = layers.base.tilemap;
        this.mapSize = new Vector2(tilemap.width, tilemap.height);
        this.tileOrigin = new Vector2(tilemap.tileWidth / 2 | 0, tilemap.tileHeight / 2 | 0);
        this.tileSize = new Vector2(tilemap.tileWidth / sqrt3, tilemap.tileHeight / 3);
        this.layout = new Layout(Layout.layoutPointy, this.tileSize, this.tileOrigin);
    }

    getCenter(tile: GameTile): [number, number] {
        return pointToArray(this.layout.hexToPixel(tile.hex));
    }

    tileDistance(tile1: GameTile, tile2: GameTile): number {
        return tile1.distance(tile2);
    }

    getTileHits(src: GameTile, target: GameTile): { tile: GameTile, distance: number }[] {
        const hexes = src.hex.lineDraw(target.hex);
        const res: { tile: GameTile, distance: number }[] = [];

        for (const hex of hexes) {
            const tile = this.coordsToTile(...OffsetCoordinate.rOffsetFromCube(hex).toArray());
            if (tile) {
                res.push({tile, distance: src.distance(tile)});
            }
        }
        return res;
    }

    visibleTiles(tile: GameTile, visionRadius: number, ignoreBlocking = false): Set<GameTile> {
        const tilesToCheck = this.tiles.filter(value => this.tileDistance(value, tile) <= visionRadius);
        if (ignoreBlocking) {
            return new Set(tilesToCheck);
        }
        const visibleTiles: Set<GameTile> = new Set<GameTile>(tilesToCheck.filter(value => this.tileDistance(value, tile) <= 1));

        for (let i = 2; i <= visionRadius; i++) {
            const tiles = tilesToCheck.filter(value => this.tileDistance(value, tile) === i);

            for (const value of tiles) {
                const hits = this.getTileHits(tile, value);
                const groups: { [k: number]: { tile: GameTile, distance: number }[] } = {};
                for (const item of hits) {
                    const list = groups[item.distance];
                    if (list) {
                        list.push(item);
                    } else {
                        groups[item.distance] = [item];
                    }
                }

                for (let j = 1; j <= i; j++) {
                    const groupTiles = groups[j] ?? [];
                    for (const tileWithDistance of groupTiles) {
                        visibleTiles.add(tileWithDistance.tile);
                    }
                    if (groupTiles.every(e => e.tile.vision === false)) {
                        break;
                    }
                }
            }
        }
        return visibleTiles;
    }

    hexToTile(hex: Hex): GameTile | undefined {
        const tile = this.tiles.find(e => e.hex.equals(hex));
        return tile && tile.tile.index !== -1 ? tile : undefined;
    }

    pixelToTile(x: number, y: number): GameTile | undefined {
        return this.hexToTile(this.layout.pixelToHex(new Point(x, y)));
    }

    tileToIndex(tile: GameTile): number {
        return tile.y * this.mapSize.x + tile.x;
    }

    coordsToTile(col: number, row: number): GameTile | undefined{
        const index = row * this.mapSize.x + col;
        return index < this.tiles.length ? this.tiles[index] : undefined;
    }

    generateNavigationPolygons(mask: number): Phaser.Geom.Polygon[] {
        return this.tiles.filter(e => !(e.pathfinding & mask))
            .map(value => new Phaser.Geom.Polygon(this.layout.polygonCorners2(value.hex, 1.33)));
    }


    getFurthersPoints(scale: number): Vector2 {
        const polys = this.tiles.map(e => this.layout.polygonCorners(e.hex).map(e => new Vector2(e.x, e.y))).flat();
        const maxX = Math.max(...polys.map(e => e.x));
        const maxY = Math.max(...polys.map(e => e.y));
        return new Vector2(maxX, maxY).scale(scale);
    }
}
