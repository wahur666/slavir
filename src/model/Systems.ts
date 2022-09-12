import HexMap from "./HexMap";
import {Navigation} from "./navigation";
import Objective from "../entities/Objective";
import Resource from "../entities/Resource";
import Phaser from "phaser";
import {getPropertyValue, LAYERS, TILESETS} from "../helpers/tilemap.helper";
import {Hex} from "./hexgrid";
import type Player from "./player/Player";
import {Images, Tilemaps} from "../scenes/PreloadScene";
import type GameScene from "../scenes/GameScene";
import HumanPlayer from "./player/HumanPlayer";
import AiPlayer from "./player/AiPlayer";
import type GameTile from "./GameTile";
import TilemapLayer = Phaser.Tilemaps.TilemapLayer;
import Vector2 = Phaser.Math.Vector2;


export default class Systems {

    map: HexMap;
    navigation: Navigation;
    objective: Objective;
    resources: Resource[];
    scaleFactor: number;
    width: number;
    height: number;
    baseOffset: Phaser.Math.Vector2;
    scaledBaseOffset: Phaser.Math.Vector2;
    hexes: Set<Hex>;
    readonly player1: Player;
    readonly player2: Player;
    readonly players: Player[];
    gameScene: GameScene;
    layers: {
        obstacle: Phaser.Tilemaps.ObjectLayer;
        nuke: Phaser.Tilemaps.ObjectLayer;
        base1: Phaser.Tilemaps.ObjectLayer;
        base2: Phaser.Tilemaps.ObjectLayer;
        pad3: Phaser.Tilemaps.ObjectLayer;
        resources: Phaser.Tilemaps.ObjectLayer;
        pad1: Phaser.Tilemaps.ObjectLayer;
        pad2: Phaser.Tilemaps.ObjectLayer;
        water: Phaser.Tilemaps.ObjectLayer;
        terrain: Phaser.Tilemaps.ObjectLayer;
        base: Phaser.Tilemaps.TilemapLayer
    };
    tileMap: Phaser.Tilemaps.Tilemap;
    nukeGameTile: GameTile;
    pad1GameTiles: GameTile[];
    pad2GameTiles: GameTile[];
    pad3GameTiles: GameTile[];

    constructor(gameScene: GameScene, mapDimensions: {
        scaleFactor: number,
        width: number,
        height: number
    }) {
        this.gameScene = gameScene;
        this.scaleFactor = mapDimensions.scaleFactor;
        this.width = mapDimensions.width;
        this.height = mapDimensions.height;
        this.player1 = new HumanPlayer(1, this);
        this.player2 = new AiPlayer(2, this);
        this.players = [this.player1, this.player2];
        this.tileMap = this.createMap(gameScene);
        this.layers = this.createLayers(this.tileMap);
        this.map = new HexMap(this.layers);
        [this.baseOffset, this.scaledBaseOffset] = this.calculateBaseOffset(this.layers.base);
        this.calculatePadGameTiles();
        this.navigation = new Navigation(this.map, this.baseOffset, this.scaleFactor);
        this.hexes = this.createMapRepresentation(this.layers.base.tilemap.width, this.layers.base.tilemap.height);
        this.objective = this.createObjective();
        this.resources = this.createResources(gameScene);
    }

    private createMap(gameScene: GameScene): Phaser.Tilemaps.Tilemap {
        const map = gameScene.make.tilemap({
            key: Tilemaps.MAP1
        });
        map.addTilesetImage(TILESETS.Hex_v01_grid, Images.HEX_GRID);
        return map;
    }

    private createLayers(map: Phaser.Tilemaps.Tilemap) {
        const baseTileset = map.getTileset(TILESETS.Hex_v01_grid);
        const base = map.createLayer(LAYERS.BASE, baseTileset, 0, 0)
            .setScale(this.scaleFactor);
        const base1 = map.getObjectLayer("Bases/Base1");
        const base2 = map.getObjectLayer("Bases/Base2");
        const pad1 = map.getObjectLayer("Pads/Pad1");
        const pad2 = map.getObjectLayer("Pads/Pad2");
        const pad3 = map.getObjectLayer("Pads/Pad3");
        const nuke = map.getObjectLayer("Nuke");
        const water = map.getObjectLayer("Water");
        const terrain = map.getObjectLayer("Terrain");
        const obstacle = map.getObjectLayer("Obstacle");
        const resources = map.getObjectLayer("Resources");

        return {base, pad1, pad2, pad3, nuke, base1, base2, water, terrain, obstacle: obstacle, resources};
    }

    private calculateBaseOffset(base: TilemapLayer): [Vector2, Vector2] {
        const point = this.getFurthersPoints();
        const scaledBaseOffset = new Vector2((this.width - point.x) / 2 | 0, (this.height - point.y - 180));
        const baseOffset = scaledBaseOffset.clone().scale(1 / this.scaleFactor);
        base.setX(scaledBaseOffset.x);
        base.setY(scaledBaseOffset.y);
        return [baseOffset, scaledBaseOffset];
    }

    /** Returns the furthers of map scaled */
    private getFurthersPoints(): Vector2 {
        return this.map.getFurthersPoints(this.scaleFactor);
    }

    private createMapRepresentation(x: number, y: number): Set<Hex> {
        const left = 0;
        const right = x - 1;
        const top = 0;
        const bottom = y - 1;
        return this.createPointyRectangle(top, bottom, left, right);
    }

    private createPointyRectangle(top: number, bottom: number, left: number, right: number): Set<Hex> {
        const hexes = new Set<Hex>();
        for (let r = top; r <= bottom; r++) {
            const rOffset = Math.floor(r / 2);
            for (let q = left - rOffset; q <= right - rOffset; q++) {
                hexes.add(new Hex(q, r));
            }
        }
        return hexes;
    }

    private createResources(gameScene: GameScene): Resource[] {
        const a = this.layers.resources;
        const resources: Resource[] = [];
        for (const object of a.objects) {
            if (object.x && object.y) {
                const tile = this.map.pixelToTile(object.x, object.y);
                if (tile) {
                    const pos = this.hexToPos(tile.hex);
                    const priority = getPropertyValue(object, "priority") as number;
                    const res = new Resource(gameScene, pos.x, pos.y, Images.CRYSTAL, tile, priority, (resource) => {
                        this.player1.resources = this.player1.resources.filter(e => e !== resource);
                        this.player2.resources = this.player2.resources.filter(e => e !== resource);
                        const resourceInd = resources.indexOf(resource);
                        resources.splice(resourceInd, 1);
                        resource.destroy();
                    });
                    resources.push(res);
                    if (getPropertyValue(object, "player") === 0) {
                        this.player1.resources.push(res);
                    } else {
                        this.player2.resources.push(res);
                    }
                }
            }
        }
        return resources;
    }

    /** Returns the unscaled values of hex center position */
    public hexCenter(hex: Hex): Vector2 {
        return this.map.layout.hexToPixel(hex);
    }

    /** Returns the scaled hex center position  */
    public hexToPos(hex: Hex): Vector2 {
        return this.hexCenter(hex).add(this.baseOffset).scale(this.scaleFactor);
    }

    /** Pixel to tile on scaled and moved values
     * @see {@link HexMap.pixelToTile} for the unscaled resolve */
    public pointToTile(x: number, y: number): GameTile | undefined {
        const normalizedX = (x / this.scaleFactor | 0) - this.baseOffset.x;
        const normalizedY = (y / this.scaleFactor | 0) - this.baseOffset.y;
        return this.map.pixelToTile(normalizedX, normalizedY);
    }

    private calculatePadGameTiles() {
        this.nukeGameTile = this.layers.nuke.objects.map(value => this.map.pixelToTile(value.x!, value.y!)!)[0];
        this.pad1GameTiles = this.layers.pad1.objects.map(value => this.map.pixelToTile(value.x!, value.y!)!);
        this.pad2GameTiles = this.layers.pad2.objects.map(value => this.map.pixelToTile(value.x!, value.y!)!);
        this.pad3GameTiles = this.layers.pad3.objects.map(value => this.map.pixelToTile(value.x!, value.y!)!);
    }

    private createObjective() {
        return new Objective(this, {
            nuke: this.nukeGameTile,
            pad1: this.pad1GameTiles,
            pad2: this.pad2GameTiles,
            pad3: this.pad3GameTiles
        });
    }
}
