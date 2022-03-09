import {Pathfinding} from "./HexMap";
import Phaser from "phaser";
import Tile = Phaser.Tilemaps.Tile;

export default class GameTile {

    height = 42;
    halfHeight = this.height / 2;
    width = 32;
    halfWidth = this.width / 2;

    tile: Tile;
    x: number;
    y: number;
    centerX: number;
    centerY: number;
    pathfinding: Pathfinding;
    points: Phaser.Math.Vector2[];
    regularPoints: Phaser.Math.Vector2[];
    regularPolygon: Phaser.Geom.Polygon;
    regularX: number;
    regularY: number;
    boundingPolygon: Phaser.Geom.Polygon;
    regularCoords: Phaser.Math.Vector2;
    center: Phaser.Math.Vector2;
    coords: Phaser.Math.Vector2;
    hexWidth: number;
    hexHeight: number;

    constructor(tile: Tile, private hexSize: number) {
        this.hexWidth = Math.sqrt(3) * this.hexSize;
        this.hexHeight = 2 * this.hexSize;
        this.tile = tile;
        this.x = tile.x;
        this.y = tile.y;
        this.centerX = tile.right - tile.baseWidth / 2 - 0.5;
        this.centerY = tile.bottom - tile.baseHeight / 2 - 1;
        this.center = new Phaser.Math.Vector2(this.centerX, this.centerY);
        this.pathfinding = tile.properties.Pathfinding;
        this.coords = new Phaser.Math.Vector2(this.x, this.y);
        this.points = [
            new Phaser.Math.Vector2(this.centerX, this.centerY - 15),
            new Phaser.Math.Vector2(this.centerX - this.halfWidth, this.centerY - 6),
            new Phaser.Math.Vector2(this.centerX - this.halfWidth, this.centerY + 6),
            new Phaser.Math.Vector2(this.centerX, this.centerY + 15),
            new Phaser.Math.Vector2(this.centerX + this.halfWidth, this.centerY + 6),
            new Phaser.Math.Vector2(this.centerX + this.halfWidth, this.centerY - 6),
        ];
        this.boundingPolygon = new Phaser.Geom.Polygon(this.points);
        const numofPoints = 6;
        const angle = 2 * Math.PI / numofPoints;
        [this.regularX, this.regularY, this.regularCoords] = this.calculateRegularHexPoints(this.x, this.y);
        this.regularPoints = [];
        for (let i = 0; i < numofPoints; i++)
        {
            this.regularPoints.push(new Phaser.Math.Vector2(
                this.regularX + this.hexSize * Math.sin(i * angle),
                this.regularY + this.hexSize * Math.cos(i * angle)
            ));
        }
        this.regularPolygon = new Phaser.Geom.Polygon(this.regularPoints);
    }

    calculateRegularHexPoints(x: number, y: number): [number, number, Phaser.Math.Vector2] {
        const adjust = (y % 2) === 1 ? this.hexWidth / 2 : 0;
        const regularX = (x * this.hexWidth + adjust);
        const regularY = y * this.hexHeight * 3 / 4;
        return [regularX, regularY, new Phaser.Math.Vector2(regularX, regularY)];
    }


}
