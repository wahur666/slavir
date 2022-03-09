import GameTile from "./GameTile";
import Tile = Phaser.Tilemaps.Tile;
import Phaser from "phaser";
import GetLineToPolygon = Phaser.Geom.Intersects.GetLineToPolygon;

export enum Pathfinding {
    WATER,
    GROUND,
    HIGH_GROUND,
    OBSTACLE
}

export default class HexMap {
    hexSize = 50;
    hexWidth = Math.sqrt(3) * this.hexSize;
    hexHeight = 2 * this.hexSize;
    tiles: GameTile[] = [];
    layers;

    constructor(layers) {
        this.layers = layers;
        layers.base.forEachTile((value: Tile) => {
            const tile = new GameTile(value, this.hexSize);
            this.tiles.push(tile);
        });
    }

    getTileHits(src: GameTile, target: GameTile) {
        const angle = Number(target.regularX === src.regularX);
        const line = new Phaser.Geom.Line(src.regularX + angle, src.regularY + angle, target.regularX-angle, target.regularY-angle);
        return this.tiles.map(tile => {
            const out: Phaser.Math.Vector4 = new Phaser.Math.Vector4();
            GetLineToPolygon(line, tile.regularPolygon, out);
            return {tile, out, distance: this.tileDistance(tile, src)};
        }).filter(e => e.tile.tile.index !== -1 && e.out.length() && e.tile !== src && e.distance <= this.tileDistance(target, src));
    }

    tileDistance(tile1: GameTile, tile2: GameTile) {
        return this.hexDistance(tile1.coords, tile2.coords);
    }

    /* https://answers.unity.com/questions/960064/hexagon-grid-distance.html */
    hexDistance(start: Phaser.Math.Vector2, dest: Phaser.Math.Vector2): number {
        const dx = dest.x - start.x;
        const dy = dest.y - start.y;
        const y = Math.abs(dy);
        const x = Math.max(0, Math.abs(dx) - (y + Number(dx < 0) ^ (start.y % 2)) / 2);
        return Math.ceil(x + y);
    }

    visibleTiles(tile: GameTile, visionRadius: number): {tile: GameTile, visible: boolean}[] {
        const tilesToCheck = this.tiles.filter(value => tile !== value
            && this.tileDistance(value, tile) <= visionRadius );
        const visibleTiles: {tile: GameTile, visible: boolean}[] = tilesToCheck
            .filter(value => this.tileDistance(value, tile) === 1)
            .map(value => {
                return { tile: value, visible: true };
            });

        for (let i = 2; i <= visionRadius; i++) {
            const tiles = tilesToCheck.filter(value => this.tileDistance(value, tile) === i);

            tiles.forEach(value => {
                const hits = this.getTileHits(tile, value).sort((a, b) => {
                    return a.distance - b.distance;
                });

                const groups: { [k: number]: {tile: GameTile, out: Phaser.Math.Vector4, distance: number}[] } = { };
                hits.forEach(function(item){
                    const list = groups[item.distance];
                    if(list){
                        list.push(item);
                    } else{
                        groups[item.distance] = [item];
                    }
                });

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
                    if (groupTiles.every(e => e.tile.pathfinding === Pathfinding.OBSTACLE )) {
                        blocked = true;
                    }
                }
            });
        }
        return visibleTiles;
    }
}
