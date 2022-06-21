import type {Pathfinding} from "./HexMap";
import Phaser from "phaser";
import Tile = Phaser.Tilemaps.Tile;
import {Hex, OffsetCoordinate} from "./hexgrid";

export default class GameTile {

    // Hex
    hex: Hex;
    // Tilemap
    tile: Tile;
    // Tilemap position X
    x: number;
    // Tilemap position Y
    y: number;
    // Tile Attribute Pathfinding
    pathfinding: Pathfinding;
    // Tile Attribute Vision
    vision: boolean;
    // Shorthand for tilemap position
    coords: Phaser.Math.Vector2;

    distance: (tile: GameTile) => number;

    constructor(tile: Tile) {
        this.tile = tile;
        this.x = tile.x;
        this.y = tile.y;
        this.pathfinding = tile.properties.Pathfinding;
        this.vision = tile.properties.Vision;
        this.coords = new Phaser.Math.Vector2(this.x, this.y);
        this.hex = OffsetCoordinate.rOffsetToCube(new OffsetCoordinate(this.x, this.y));
        this.distance = (tile: GameTile) => this.hex.distance(tile.hex);
    }



}
