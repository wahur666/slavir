import GameTile from "./GameTile";
import Phaser from "phaser";
import Tile = Phaser.Tilemaps.Tile;
import Vector2 = Phaser.Math.Vector2;
import Layout from "./Layout";
import Point = Phaser.Geom.Point;
import Hex from "./Hex";

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
    hexSize = 16;
    hexWidth = Math.sqrt(3) * this.hexSize;
    hexHeight = 2 * this.hexSize;
    tiles: GameTile[] = [];
    layers;
    layout: Layout;

    constructor(layers) {
        this.layers = layers;
        layers.base.forEachTile((value: Tile) => {
            const tile = new GameTile(value, this.hexSize);
            this.tiles.push(tile);
        });
        this.layout = new Layout(Layout.layoutPointy, new Vector2(18.5, 14), new Vector2(16, 21));
    }

    getCenter(tile: GameTile): [number, number] {
        return pointToArray(this.layout.hexToPixel(tile.hex));
    }

    tileDistance(tile1: GameTile, tile2: GameTile):number {
        return tile1.distance(tile2);
    }

    getTileHits(src: GameTile, target: GameTile): {tile: GameTile, distance: number}[] {
        const hexes = src.hex.lineDraw(target.hex);
        const res: {tile: GameTile, distance: number}[] = [];
        for (const tile of this.tiles) {
            if (tile.hex.equals(src.hex)) {
                continue;
            }
            if (hexes.find(e => e.equals(tile.hex))) {
                res.push({tile, distance: src.distance(tile)});
            }
        }
        return res;
    }

    visibleTiles(tile: GameTile, visionRadius: number, ignoreBlocking = false): {tile: GameTile, visible: boolean}[] {
        const tilesToCheck = this.tiles.filter(value => this.tileDistance(value, tile) <= visionRadius );
        if (ignoreBlocking) {
            return tilesToCheck.map(value => ({tile: value, visible: true}))
        }
        const visibleTiles: {tile: GameTile, visible: boolean}[] = tilesToCheck
            .filter(value => this.tileDistance(value, tile) === 1)
            .map(value => ({tile: value, visible: true}));

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
                    for (const tile of groupTiles) {
                        if (blocked) {
                            if (!visibleTiles.find(e => e.tile === tile.tile)) {
                                visibleTiles.push({tile: tile.tile, visible: false});
                            }
                        } else {
                            if (!visibleTiles.find(e => e.tile === tile.tile)) {
                                visibleTiles.push({tile: tile.tile, visible: true});
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
        const hex = this.layout.pixelToHex(new Point(x, y));
        return this.tiles.find(e => e.tile.index !== -1 && e.hex.equals(hex));
    }

    neighbours(tile: GameTile): GameTile[] {
        const neighbourHexes: Hex[] = tile.hex.neighbours();
        const res = this.tiles.filter(e => neighbourHexes.find(q => q.equals(e.hex)));
        console.log("neighbourHexes", neighbourHexes);
        return res;
    }
}
