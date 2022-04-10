import Phaser from "phaser";
import {SHARED_CONFIG} from "../main";
import {SceneRegistry} from "./SceneRegistry";
import {Images, Tilemaps} from "./PreloadScene";
import HexMap, {Pathfinding} from "../model/HexMap";
import GameTile from "../model/GameTile";
import {Hex} from "../model/hexgrid";
import {Navigation} from "../model/navigation";
import Unit, {AnimationKeys} from "../entities/Unit";
import Pointer = Phaser.Input.Pointer;
import Graphics = Phaser.GameObjects.Graphics;
import Vector2 = Phaser.Math.Vector2;
import TilemapLayer = Phaser.Tilemaps.TilemapLayer;

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
    graphics2: Graphics;
    texts: Phaser.GameObjects.Text[] = [];
    hexes: Set<Hex>;
    navigation: Navigation;
    baseOffset: Phaser.Math.Vector2;
    scaledBaseOffset: Phaser.Math.Vector2;
    // guard: Unit;
    // guard2: Unit;
    selectedUnit: Unit | null = null;
    player1Units: Unit[] = [];
    path: GameTile[] = [];
    dest: Phaser.Math.Vector2 | undefined;

    constructor(private config: typeof SHARED_CONFIG) {
        super(SceneRegistry.GAME);
    }

    create() {
        const map = this.createMap();
        const layers = this.createLayers(map);
        this.hexMap = new HexMap(layers);
        this.navigation = new Navigation(this.hexMap);
        this.calculateBaseOffset(layers.base);
        this.graphics = this.add.graphics();
        this.graphics2 = this.add.graphics().setScale(this.scaleFactor);
        this.input.mouse.disableContextMenu();
        this.input.on("pointerdown", (ev: Pointer) => {
            if (ev.rightButtonDown()) {
                if (this.selectedUnit) {
                    this.selectedUnit.selected = false;
                    this.selectedUnit = null;
                }
            }
            if (ev.leftButtonDown()) {
                if (ev.x < this.scaledBaseOffset.x || ev.x > this.config.width - this.scaledBaseOffset.x
                    || ev.y < this.scaledBaseOffset.y || ev.y > this.config.height - this.scaledBaseOffset.y) {
                    return;
                }
                const unit = this.player1Units.find(e => e.pointInCircle(new Vector2(ev.x, ev.y)));
                if (unit) {
                    if (unit !== this.selectedUnit) {
                        if (this.selectedUnit) {
                            this.selectedUnit.selected = false;
                        }
                        this.selectedUnit = unit;
                        this.selectedUnit.selected = true;
                    }
                } else {
                    const target = this.pointToTile(ev.x, ev.y);
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

        this.createMapRepresentation(new Vector2(layers.base.tilemap.width, layers.base.tilemap.height));

        for (const tile of this.hexMap.tiles) {
            tile.tile.tint = 0x545454;
        }
        const startPoint = this.hexMap.coordsToTile(4, 3);
        if (startPoint) {
            this.setCurrentTile(startPoint);
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
        this.createPlayer1Units();

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
        for (const player1Unit of this.player1Units) {
            const tile = this.pointToTile(player1Unit.pos.x, player1Unit.pos.y);
            if (tile) {
                for (const visibleTile of this.hexMap.visibleTiles(tile, this.visionRadius)) {
                    visibleTiles.add(visibleTile);
                }
            }
        }
        for (const tile of this.hexMap.tiles) {
            this.drawVisibility(tile, visibleTiles.has(tile));
        }
    }

    drawVisibility(tile: GameTile, visible: boolean) {
        if (tile.tile.index !== -1) {
            tile.tile.tint = VisibilityColors[Number(visible)];
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

    // Pixel to Tile
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
        for (const unit of this.player1Units) {
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

    hexCenter(hex: Hex): Vector2 {
        return this.hexMap.layout.hexToPixel(hex);
    }

    getFurthersPoints(): Vector2 {
        return this.hexMap.getFurthersPoints(this.scaleFactor);
    }

    hexToPos(hex: Hex): Vector2 {
        return this.hexCenter(hex).add(this.baseOffset).scale(this.scaleFactor);
    }

    createUnit(hex: Hex): Unit {
        const pos = this.hexToPos(hex);
        return new Unit(this, pos.x, pos.y).play(AnimationKeys.IDLE);
    }

    private createPlayer1Units() {
        [new Hex(4, 3), new Hex(2, 2)]
            .map(e => this.createUnit(e))
            .forEach(value => {
                this.player1Units.push(value);
            });
    }
}


