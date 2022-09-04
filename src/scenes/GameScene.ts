import type {SHARED_CONFIG} from "../main";
import type GameTile from "../model/GameTile";
import Phaser from "phaser";
import {SceneRegistry} from "./SceneRegistry";
import {Images} from "./PreloadScene";
import {Pathfinding} from "../model/HexMap";
import type {Hex} from "../model/hexgrid";
import Unit from "../entities/Unit";
import Card from "../entities/Card";
import {stats, UnitStat} from "../entities/UnitsStats";
import type Player from "../model/player/Player";
import {findObjectByProperty} from "../helpers/tilemap.helper";
import {range} from "../helpers/utils";
import Graphics = Phaser.GameObjects.Graphics;
import Building, {Buildings, buildingStat} from "../entities/Building";
import type Resource from "../entities/Resource";
import Harvester from "../entities/Harvester";
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
    selectedUnit: Unit | null = null;
    resources: Resource[] = [];
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
        this.createCards();
        this.createAllPlayerBuildings(this.player1);
        this.createAllPlayerBuildings(this.player2);
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
            const tile = this.pointToTile(player1Unit.pos.x, player1Unit.pos.y);
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

    // Pixel to tile on scaled and moved values
    pointToTile(x: number, y: number): GameTile | undefined {
        const normalizedX = (x / this.scaleFactor | 0) - this.systems.baseOffset.x;
        const normalizedY = (y / this.scaleFactor | 0) - this.systems.baseOffset.y;
        return this.systems.map.pixelToTile(normalizedX, normalizedY);
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
        for (const resource of this.resources) {
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

    createUnit(hex: Hex, texture: string, stats: UnitStat, player: Player): Unit {
        const pos = this.systems.hexToPos(hex);
        return new stats.className(this, pos.x, pos.y, texture, stats, player, this.systems.navigation, this.freeHandler.bind(this)).play(Unit.AnimationKeys.IDLE_DOWN);
    }

    async freeHandler(unit: Unit): Promise<void> {
        const unitToFreeInd = unit.player.units.indexOf(unit);
        unit.player.createCoolDown = Math.max(0, unit.player.createCoolDown - unit.player.baseCreateCoolDown);
        if (unit instanceof Harvester) {
            const playerToReward = unit.player === this.player1 ? this.player2 : this.player1;
            playerToReward.resource += 80;
            // console.log(playerToReward.resource);
        }
        if (this.selectedUnit === unit) {
            this.deselectUnit();
        }
        await unit.prepForDestroy();
        unit.destroy();
        unit.player.units.splice(unitToFreeInd, 1);
        // console.log(unit.player.units);
    }

    private createCards() {
        console.log(stats);
        const cards = [...stats.values()].map((e, index, arr) =>
            new Card(this, (this.config.width - arr.length * 90 + 45) / 2 + index * 90, 600, e, () => this.playerCreateUnit(this.player1, e)));

    }

    playerCreateUnit(player: Player, e: UnitStat) {
        if (player.createCoolDown !== 0) {
            return;
        }
        if (player.units.length > 5) {
            return;
        }
        if (player.resource < e.cost) {
            return;
        }
        player.resource -= e.cost;
        console.log("Player", player.index, "index", player.resource);
        const alreadyOccupiedPositions: GameTile[] = [...player.units.map(unit => this.pointToTile(unit.pos.x, unit.pos.y)!)];
        const possibleTiles: { distance: number; tile: GameTile }[] = this.systems.map.tiles
            .filter(tile => !alreadyOccupiedPositions.includes(tile) && tile.pathfinding === Pathfinding.GROUND)
            .map(tile => ({
                tile,
                distance: this.systems.map.tileDistance(tile, player.base!) + this.systems.map.tileDistance(tile, player.spawn!)
            }))
            .sort((a, b) => a.distance - b.distance);
        if (possibleTiles.length > 0 && player.units.length < 6 && (e.limit === -1 || e.limit > player.units.filter(u => u.stat.texture === e.texture).length)) {
            const unit = this.createUnit(possibleTiles[0].tile.hex, e.texture, e, player);
            player.units.push(unit);
            player.resetCreateCoolDown();
            this.selectUnit(unit);
        }
    }

    createAllPlayerBuildings(player: Player) {
        this.createBuilding(player, Buildings.CASTLE);
        this.createBuilding(player, Buildings.BARRACK);
        this.createBuilding(player, Buildings.FACTORY);
        this.createBuilding(player, Buildings.HANGAR);
        this.createBuilding(player, Buildings.TECH);
        this.createBuilding(player, Buildings.SPAWN);
    }

    createBuilding(player: Player, building: Buildings) {
        const baseTile = findObjectByProperty(this.systems.layers["base" + player.index].objects, "id", building);
        let a;
        if (baseTile && baseTile.x && baseTile.y) {
            a = this.systems.map.pixelToTile(baseTile.x, baseTile.y);
        }
        const hex = a?.hex;
        if (hex) {
            const pos = this.systems.hexToPos(hex);
            const tile = this.systems.map.tiles.find(e => e.hex.equals(hex))!;
            player.addBuilding(new Building(this, pos.x, pos.y, buildingStat.get(Buildings[building].toLowerCase())!), tile);
        }
    }


}


