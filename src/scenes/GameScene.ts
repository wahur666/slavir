import type {SHARED_CONFIG} from "../main";
import type GameTile from "../model/GameTile";
import Phaser from "phaser";
import {SceneRegistry} from "./SceneRegistry";
import {Images, Tilemaps} from "./PreloadScene";
import HexMap, {Pathfinding} from "../model/HexMap";
import {Hex} from "../model/hexgrid";
import {Navigation} from "../model/navigation";
import Unit from "../entities/Unit";
import Card from "../entities/Card";
import {stats} from "../entities/UnitsStats";
import Pointer = Phaser.Input.Pointer;
import Graphics = Phaser.GameObjects.Graphics;
import Vector2 = Phaser.Math.Vector2;
import TilemapLayer = Phaser.Tilemaps.TilemapLayer;
import type Player from "../model/player/Player";
import {findObjectByProperty} from "../helpers/tilemap.helper";
import HumanPlayer from "../model/player/HumanPlayer";
import AiPlayer from "../model/player/AiPlayer";
import {range} from "../helpers/utils";

enum LAYERS {
    BASE = "base"
}

const grey = 0x808080;
const white = 0xFFFFFF;

const c1 = Phaser.Display.Color.ValueToColor(grey);
const c2 = Phaser.Display.Color.ValueToColor(white);

/** Number of steps when changing tile visibility */
const shadeSteps = 60;

/** Shade values to apply as tint */
const shadeValues = range(shadeSteps)
    .map(value => Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, shadeSteps, value))
    .map(value => Phaser.Display.Color.GetColor(value.r, value.g, value.b));

enum TILESETS {
    Hex_v01_grid = "Hex_v01_grid"
}

enum Buildings {
    CASTLE,
    BARRACK,
    FACTORY,
    HANGAR,
    TECH,
    SPAWN
}

export default class GameScene extends Phaser.Scene {

    currentTile: GameTile;
    scaleFactor = 3;
    hexMap: HexMap;
    graphics: Graphics;
    graphics2: Graphics;
    texts: Phaser.GameObjects.Text[] = [];
    hexes: Set<Hex>;
    navigation: Navigation;
    baseOffset: Phaser.Math.Vector2;
    scaledBaseOffset: Phaser.Math.Vector2;
    selectedUnit: Unit | null = null;
    path: GameTile[] = [];

    player1: HumanPlayer;
    player2: AiPlayer;

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

    constructor(private config: typeof SHARED_CONFIG) {
        super(SceneRegistry.GAME);
    }

    create() {
        const map = this.createMap();
        this.layers = this.createLayers(map);
        this.hexMap = new HexMap(this.layers);
        this.navigation = new Navigation(this.hexMap);
        this.calculateBaseOffset(this.layers.base);
        this.graphics = this.add.graphics();
        this.graphics2 = this.add.graphics().setScale(this.scaleFactor);
        this.input.mouse.disableContextMenu();
        this.player1 = new HumanPlayer(1, this);
        this.player2 = new AiPlayer(2);
        this.input.keyboard.on("keyup-F", () => {
           if (this.selectedUnit) {
               this.freeHandler(this.selectedUnit);
           }
        });
        this.input.on("pointerdown", (ev: Pointer) => {
            if (ev.rightButtonDown()) {
                // this.deselectUnit();
                if (ev.x < this.scaledBaseOffset.x || ev.x > this.config.width - this.scaledBaseOffset.x
                    || ev.y < this.scaledBaseOffset.y || ev.y > this.config.height - this.scaledBaseOffset.y) {
                    return;
                }
                const target = this.pointToTile(ev.x, ev.y);
                const unit = this.player1.units.find(e => this.pointToTile(e.pos.x, e.pos.y) === target);
                if (unit) {
                    if (target) {
                        this.setCurrentTile(target);
                        if (this.selectedUnit) {
                            const start = this.pointToTile(this.selectedUnit.pos.x, this.selectedUnit.pos.y);
                            if (start) {
                                this.path = this.navigation.findPath(start, target, Pathfinding.GROUND, true);
                                if (this.path.length > 0) {
                                    this.selectedUnit.setNav(this.path.map(e => this.calculateNavPoint(e)), unit);
                                }
                            }
                        }
                        if (this.config.debug.distance) {
                            this.drawTileDistance();
                        }
                    }
                }
            }
            if (ev.leftButtonDown()) {
                if (ev.x < this.scaledBaseOffset.x || ev.x > this.config.width - this.scaledBaseOffset.x
                    || ev.y < this.scaledBaseOffset.y || ev.y > this.config.height - this.scaledBaseOffset.y) {
                    return;
                }
                const target = this.pointToTile(ev.x, ev.y);
                const unit = this.player1.units.find(e => this.pointToTile(e.pos.x, e.pos.y) === target);
                if (unit) {
                    this.selectUnit(unit);
                } else {
                    if (target) {
                        this.setCurrentTile(target);
                        if (this.selectedUnit) {
                            const start = this.pointToTile(this.selectedUnit.pos.x, this.selectedUnit.pos.y);
                            if (start) {
                                this.path = this.navigation.findPath(start, target, Pathfinding.GROUND);
                                if (this.path.length > 0) {
                                    this.selectedUnit.setNav(this.path.map(e => this.hexMap.getCenter(e).add(this.baseOffset).scale(this.scaleFactor)));
                                }
                            }

                        }
                        if (this.config.debug.distance) {
                            this.drawTileDistance();
                        }
                    }
                }
            }
        });

        this.createMapRepresentation(new Vector2(this.layers.base.tilemap.width, this.layers.base.tilemap.height));

        for (const tile of this.hexMap.tiles) {
            tile.tile.tint = 0x545454;
        }

        if (this.config.debug.hexes) {
            this.drawHexes();
        }
        // this.drawVisibleTiles();
        if (this.config.debug.distance) {
            this.drawTileDistance();
        }
        if (this.config.debug.navMesh) {
            this.drawNavMesh();
        }
        // this.createPlayer1Units();
        this.createCards();
        this.createAllPlayerBuildings(this.player1);
        this.createAllPlayerBuildings(this.player2);
    }


    calculateNavPoint(gameTile: GameTile): Vector2 {
        return this.hexMap.getCenter(gameTile).add(this.baseOffset).scale(this.scaleFactor);
    }

    selectUnit(unit: Unit) {
        if (this.selectedUnit && unit !== this.selectedUnit) {
            this.selectedUnit.selected = false;
        }
        this.selectedUnit = unit;
        this.selectedUnit.selected = true;
    }

    deselectUnit() {
        if (this.selectedUnit) {
            this.selectedUnit.selected = false;
            this.selectedUnit = null;
        }
    }

    calculateBaseOffset(base: TilemapLayer) {
        const point = this.getFurthersPoints();
        this.scaledBaseOffset = new Vector2((this.config.width - point.x) / 2 | 0, (this.config.height - point.y - 180));
        this.baseOffset = this.scaledBaseOffset.clone().scale(1 / this.scaleFactor);
        base.setX(this.scaledBaseOffset.x);
        base.setY(this.scaledBaseOffset.y);
    }

    private drawTestNavigation(start: GameTile | undefined) {
        const dest = this.hexMap.coordsToTile(6, 6);
        if (start && dest) {
            this.path = this.navigation.findPath(start, dest, Pathfinding.GROUND);
            this.drawPath(this.path);
        }
    }

    drawPath(tiles: GameTile[]): void {
        this.graphics2.clear();
        if (tiles.length < 2) {
            return;
        }
        this.graphics2.lineStyle(3, 0xFF0000, 1);
        const start = this.hexCenter(tiles[0].hex).add(this.baseOffset);
        const end = this.hexCenter(tiles[tiles.length - 1].hex).add(this.baseOffset);
        const curve = new Phaser.Curves.Path(start.x, start.y);
        for (let i = 0; i < tiles.length - 1; i++) {
            const point1 = this.hexCenter(tiles[i].hex).add(this.baseOffset);
            const point2 = this.hexCenter(tiles[i + 1].hex).add(this.baseOffset);
            curve.add(new Phaser.Curves.Line(point1, point2));
        }
        curve.draw(this.graphics2, 64);
        this.graphics2.stroke();
        this.graphics2.fillStyle(0xFF0000, 1);
        this.graphics2.fillCircle(start.x, start.y, 5);
        this.graphics2.fillStyle(0x00FF00, 1);
        this.graphics2.fillCircle(end.x, end.y, 5);
    }

    setCurrentTile(tile: GameTile): void {
        this.currentTile = tile;
        const colors = {blue: 0x0000FF, green: 0x00FF00, red: 0xFF0000};
        this.graphics.clear();
        this.graphics.lineStyle(1, colors.green, 1);
        const center = this.hexMap.getCenter(tile).add(this.baseOffset);
        this.graphics.strokeCircle(center.x, center.y, 5).setScale(this.scaleFactor);
    }

    drawVisibleTiles() {
        const visibleTiles = new Set<GameTile>();
        for (const player1Unit of this.player1.units) {
            const tile = this.pointToTile(player1Unit.pos.x, player1Unit.pos.y);
            if (tile) {
                for (const visibleTile of this.hexMap.visibleTiles(tile, player1Unit.stat.visionRadius)) {
                    visibleTiles.add(visibleTile);
                }
            }
        }
        if (this.player1.buildings.CASTLE) {
            for (const visibleTile of this.hexMap.visibleTiles(this.player1.buildings.CASTLE, 3, true)) {
                visibleTiles.add(visibleTile);
            }
        }
        for (const tile of this.hexMap.tiles) {
            this.drawVisibility(tile, visibleTiles.has(tile));
        }
    }

    drawVisibility(tile: GameTile, visible: boolean) {
        if (tile.tile.index !== -1) {
            if (visible) {
                tile.shadeIndex = Math.min(shadeSteps - 1, tile.shadeIndex + 3);
            } else {
                tile.shadeIndex = Math.max(0, tile.shadeIndex - 1);
            }
            tile.tile.tint = shadeValues[tile.shadeIndex];
        }
    }

    debugHexPathFinding(tile: GameTile) {
        if (this.config.debug && tile.tile.index !== -1) {
            const colors = [0x0000FF, 0x00FF00, 0x00FFFF, 0xFF0000];
            this.graphics.lineStyle(1, colors[tile.pathfinding], 1);
            const center = this.hexMap.getCenter(tile);
            this.graphics.strokeCircle(center.x, center.y, 13);
        }
    }

    drawTileDistance() {
        if (this.texts.length === 0) {
            for (const tile of this.hexMap.tiles) {
                const center = this.hexMap.getCenter(tile);
                const text = tile.tile.index === -1 ? "" : this.hexMap.tileDistance(tile, this.currentTile) + "";
                this.texts.push(this.add.text((center.x + this.baseOffset.x) * this.scaleFactor, (center.y + this.baseOffset.y) * this.scaleFactor, text, {
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

    // Pixel to tile on scaled and moved values
    pointToTile(x: number, y: number): GameTile | undefined {
        const normalizedX = (x / this.scaleFactor | 0) - this.baseOffset.x;
        const normalizedY = (y / this.scaleFactor | 0) - this.baseOffset.y;
        return this.hexMap.pixelToTile(normalizedX, normalizedY);
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

    update(time: number, delta: number) {
        for (const unit of this.player1.units) {
            unit.update();
        }
        this.drawVisibleTiles();
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

    /** Draws non walkable paths */
    drawNavMesh() {
        const polyiz = this.hexMap.generateNavigationPolygons(Pathfinding.GROUND);
        for (const polygon of polyiz) {
            this.graphics2.lineStyle(1, 0xFF0000, 1);
            this.graphics2.strokePoints(polygon.points, true, true)
                .setX(this.scaledBaseOffset.x)
                .setY(this.scaledBaseOffset.y)
                .setScale(this.scaleFactor);
        }
    }

    drawHex(graphics: Graphics, hex: Hex): void {
        const points = this.hexMap.layout.polygonCorners(hex);
        graphics.lineStyle(1, 0xFF0000, 1);
        graphics.strokePoints(points, true, true)
            .setX(this.scaledBaseOffset.x)
            .setY(this.scaledBaseOffset.y)
            .setScale(this.scaleFactor);
    }

    /** Returns the unscaled values of hex center position */
    hexCenter(hex: Hex): Vector2 {
        return this.hexMap.layout.hexToPixel(hex);
    }

    /** Returns the furthers of map scaled */
    getFurthersPoints(): Vector2 {
        return this.hexMap.getFurthersPoints(this.scaleFactor);
    }

    /** Returns the scaled hext  */
    hexToPos(hex: Hex): Vector2 {
        return this.hexCenter(hex).add(this.baseOffset).scale(this.scaleFactor);
    }

    createUnit(hex: Hex, texture: string, stats: any): Unit {
        const pos = this.hexToPos(hex);
        return new Unit(this, pos.x, pos.y, texture, stats, this.freeHandler.bind(this)).play(Unit.AnimationKeys.IDLE_DOWN);
    }

    async freeHandler(unit: Unit) {
        const unitToFreeInd = this.player1.units.indexOf(unit);
        if (this.selectedUnit === unit) {
            this.deselectUnit();
            await unit.prepForDestroy();
        }
        unit.destroy();
        this.player1.units.splice(unitToFreeInd, 1);
        console.log(this.player1.units);
    }

    private createCards() {
        console.log(stats);
        const cards = [...stats.values()].map((e, index, arr) =>
            new Card(this, (this.config.width - arr.length * 90 + 45) / 2 + index * 90, 600, e, () => this.playerCreateUnit(this.player1, e)));

    }

    playerCreateUnit(player: Player, e: any) {
        const alreadyOccupiedPositions: GameTile[] = [...this.player1.units.map(unit => this.pointToTile(unit.pos.x, unit.pos.y)!)];
        const possibleTiles: { distance: number; tile: GameTile }[] = this.hexMap.tiles
            .filter(tile => !alreadyOccupiedPositions.includes(tile) && tile.pathfinding === Pathfinding.GROUND)
            .map(tile => ({
                tile,
                distance: this.hexMap.tileDistance(tile, this.player1.buildings.CASTLE!) + this.hexMap.tileDistance(tile, this.player1.buildings.SPAWN!)
            }))
            .sort((a, b) => a.distance - b.distance);
        if (possibleTiles.length > 0) {
            const unit = this.createUnit(possibleTiles[0].tile.hex, e.texture, e);
            player.units.push(unit);
            this.selectUnit(unit);
        }
    }

    createAllPlayerBuildings(player: Player) {
        this.createBuilding(player, Buildings.CASTLE, new Vector2(0.8), new Vector2(0.5, 0.6));
        this.createBuilding(player, Buildings.BARRACK, new Vector2(0.8));
        this.createBuilding(player, Buildings.FACTORY, new Vector2(0.8));
        this.createBuilding(player, Buildings.HANGAR, new Vector2(0.8));
        this.createBuilding(player, Buildings.TECH, new Vector2(0.8));
        this.createBuilding(player, Buildings.SPAWN, new Vector2(1.1), new Vector2(0.5, 0.45));
    }

    createBuilding(player: Player, building: Buildings, scale = new Vector2(1), origin = new Vector2(0.5)) {
        const baseTile = findObjectByProperty(this.layers["base" + player.index].objects, "id", building);
        let a;
        if (baseTile && baseTile.x && baseTile.y) {
            a = this.hexMap.pixelToTile(baseTile.x, baseTile.y);
        }
        const hex = a?.hex;
        if (hex) {
            const pos = this.hexToPos(hex);
            player.buildings[Buildings[building]] = this.hexMap.tiles.find(e => e.hex.equals(hex));
            this.add.image(pos.x, pos.y, Images[Buildings[building]]).setScale(scale.x, scale.y).setOrigin(origin.x, origin.y);
        }
    }

}


