import type {SHARED_CONFIG} from "../main";
import type GameTile from "../model/GameTile";
import Phaser from "phaser";
import {SceneRegistry} from "./SceneRegistry";
import {Images} from "./PreloadScene";
import {Pathfinding} from "../model/HexMap";
import type {Hex} from "../model/hexgrid";
import type Player from "../model/player/Player";
import {range} from "../helpers/utils";
import Graphics = Phaser.GameObjects.Graphics;
import Systems from "../model/Systems";

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

export default class GameScene extends Phaser.Scene {

    currentTile: GameTile;
    scaleFactor = 3;
    graphics: Graphics;
    graphics2: Graphics;
    gameEnded = false;
    systems: Systems;
    player1: Player;
    player2: Player;
    bg: Phaser.GameObjects.Sprite;

    constructor(public config: typeof SHARED_CONFIG) {
        super(SceneRegistry.GAME);
        // @ts-ignore
        window.game = this;
    }

    create() {
        this.bg = this.add.sprite(this.config.width / 2 , this.config.height / 2, Images.BROWN_BG).setScale(1.25);

        this.systems = new Systems(this, {
            scaleFactor: this.scaleFactor,
            width: this.config.width,
            height: this.config.height
        });
        this.player1 = this.systems.player1;
        this.player2 = this.systems.player2;

        this.graphics = this.add.graphics();
        this.graphics2 = this.add.graphics().setScale(this.scaleFactor);
        this.input.mouse.disableContextMenu();


        for (const tile of this.systems.map.tiles) {
            tile.tile.tint = 0x545454;
        }

        if (this.config.debug.hexes) {
            this.drawHexes();
        }

        if (this.config.debug.navMesh) {
            this.drawNavMesh();
        }
        this.player1.create();
        this.player2.create();
    }

    setCurrentTile(tile: GameTile): void {
        this.currentTile = tile;
        const colors = {blue: 0x0000FF, green: 0x00FF00, red: 0xFF0000};
        this.graphics.clear();
        this.graphics.lineStyle(1, colors.green, 1);
        const center = this.systems.map.getCenter(tile).add(this.systems.baseOffset);
        this.graphics.strokeCircle(center.x, center.y, 5).setScale(this.scaleFactor);
    }

    drawVisibleTiles() {
        const visibleTiles = new Set<GameTile>();
        for (const player1Unit of this.player1.units) {
            const tile = this.systems.pointToTile(player1Unit.pos.x, player1Unit.pos.y);
            if (tile) {
                for (const visibleTile of this.systems.map.visibleTiles(tile, player1Unit.stat.visionRadius)) {
                    visibleTiles.add(visibleTile);
                }
            }
        }
        if (this.player1.base) {
            for (const visibleTile of this.systems.map.visibleTiles(this.player1.base, 3, true)) {
                visibleTiles.add(visibleTile);
            }
        }
        for (const tile of this.systems.map.tiles) {
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

    update(time: number, delta: number) {
        if (this.gameEnded) {
            return;
        }
        for (const unit of this.player1.units) {
            unit.update(delta);
        }
        for (const unit of this.player2.units) {
            unit.update(delta);
        }
        for (const resource of this.systems.resources) {
            resource.update(delta);
        }
        this.systems.objective.update(delta);
        this.player1.update(delta);
        this.player2.update(delta);
        this.drawVisibleTiles();
        if (this.player1.currentBaseHealth <= 0) {
            console.log("You lost");
            this.endGame();
        }
        if (this.player2.currentBaseHealth <= 0) {
            console.log("You won");
            this.endGame();
        }
    }

    endGame() {
        this.gameEnded = true;
        this.stopUnits();
    }

    stopUnits() {
        for (const unit of this.player1.units) {
            unit.stopUnit();
        }
        for (const unit of this.player2.units) {
            unit.stopUnit();
        }
    }

    private drawHexes() {
        const graphics = this.add.graphics();
        for (const hex of this.systems.hexes) {
            this.drawHex(graphics, hex);
        }
    }

    /** Draws non walkable paths */
    drawNavMesh() {
        const polyiz = this.systems.map.generateNavigationPolygons(Pathfinding.GROUND);
        for (const polygon of polyiz) {
            this.graphics2.lineStyle(1, 0xFF0000, 1);
            this.graphics2.strokePoints(polygon.points, true, true)
                .setX(this.systems.scaledBaseOffset.x)
                .setY(this.systems.scaledBaseOffset.y)
                .setScale(this.scaleFactor);
        }
    }

    drawHex(graphics: Graphics, hex: Hex): void {
        const points = this.systems.map.layout.polygonCorners(hex);
        graphics.lineStyle(1, 0xFF0000, 1);
        graphics.strokePoints(points, true, true)
            .setX(this.systems.scaledBaseOffset.x)
            .setY(this.systems.scaledBaseOffset.y)
            .setScale(this.scaleFactor);
    }

}


