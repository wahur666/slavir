import GameTile from "./GameTile";
import Phaser from "phaser";
import {Layout, OffsetCoordinate} from "./hexgrid";
import Tile = Phaser.Tilemaps.Tile;
import Vector2 = Phaser.Math.Vector2;
import Point = Phaser.Geom.Point;

export enum Pathfinding {
    WATER,
    GROUND,
    HIGH_GROUND,
    OBSTACLE
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

    tileDistance(tile1: GameTile, tile2: GameTile):number {
        return tile1.distance(tile2);
    }

    getTileHits(src: GameTile, target: GameTile): {tile: GameTile, distance: number, index: number}[] {
        const hexes = src.hex.lineDraw(target.hex);
        const res: {tile: GameTile, distance: number, index: number}[] = [];

        for (const hex of hexes) {
            const tile = this.coordsToTile(...OffsetCoordinate.rOffsetFromCube(hex).toArray());
            res.push({tile, index: this.tileToIndex(tile), distance: src.distance(tile)});
        }
        return res;
    }

    // TODO Optimize calls
    visibleTiles(tile: GameTile, visionRadius: number, ignoreBlocking = false): {tile: GameTile, visible: boolean, index: number}[] {
        const tilesToCheck = this.tiles.filter(value => this.tileDistance(value, tile) <= visionRadius );
        if (ignoreBlocking) {
            return tilesToCheck.map(value => ({tile: value, visible: true, index: this.tileToIndex(tile)}));
        }
        const visibleTiles: {tile: GameTile, visible: boolean, index: number}[] = tilesToCheck
            .filter(value => this.tileDistance(value, tile) === 1)
            .map(value => ({tile: value, visible: true, index: this.tileToIndex(tile)}));

        for (let i = 2; i <= visionRadius; i++) {
            const tiles = tilesToCheck.filter(value => this.tileDistance(value, tile) === i);

            for (const value of tiles) {
                const hits = this.getTileHits(tile, value).sort((a, b) => {
                    return a.distance - b.distance;
                });

                const groups: { [k: number]: {tile: GameTile, distance: number}[] } = { };
                for (const item of hits) {
                    const list = groups[item.distance];
                    if(list){
                        list.push(item);
                    } else{
                        groups[item.distance] = [item];
                    }
                }

                let blocked = false;
                for (let j = 1; j <= i; j++) {
                    const groupTiles = groups[j] ?? [];
                    for (const tileWithDistance of groupTiles) {
                        if (blocked) {
                            if (!visibleTiles.find(e => e.tile === tileWithDistance.tile)) {
                                visibleTiles.push({tile: tileWithDistance.tile, visible: false, index: this.tileToIndex(tileWithDistance.tile)});
                            }
                        } else {
                            if (!visibleTiles.find(e => e.tile === tileWithDistance.tile)) {
                                visibleTiles.push({tile: tileWithDistance.tile, visible: true, index: this.tileToIndex(tileWithDistance.tile)});
                            }
                        }
                    }
                    if (groupTiles.every(e => e.tile.vision === false)) {
                        blocked = true;
                    }
                }
            }
        }
        return visibleTiles;
    }

    pixelToTile(x: number, y: number): GameTile | undefined {
        const tile = this.coordsToTile(...OffsetCoordinate.rOffsetFromCube(this.layout.pixelToHex(new Point(x, y))).toArray());
        return tile.tile.index !== -1 ? tile : undefined;
    }

    tileToIndex(tile: GameTile): number {
        return tile.y * this.mapSize.x + tile.x;
    }

    coordsToTile(col: number, row: number): GameTile {
        return this.tiles[row * this.mapSize.x + col];
    }

}
