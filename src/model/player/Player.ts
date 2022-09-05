import Unit from "../../entities/Unit";
import type Building from "../../entities/Building";
import type GameTile from "../GameTile";
import type Resource from "../../entities/Resource";
import type Systems from "../Systems";
import type GameScene from "../../scenes/GameScene";
import type {UnitStat} from "../../entities/UnitsStats";
import {Pathfinding} from "../HexMap";
import type {Hex} from "../hexgrid";
import Harvester from "../../entities/Harvester";


export default abstract class Player {

    units: Unit[] = [];
    private buildings: Building[] = [];
    selectedUnit: Unit | null = null;
    resources: Resource[] = [];
    base: GameTile | undefined;
    spawn: GameTile | undefined;
    maxBaseHealth = 1000;
    currentBaseHealth = this.maxBaseHealth;
    resource = 100;
    hasBuildings = {
        BARRACK: false,
        FACTORY: false,
        HANGAR: false,
        TECH: false
    };

    numberOfHarvesters = 0;
    currentHarvestTime = 0;
    harvestTime = 5000;

    baseCreateCoolDown = 5000;
    createCoolDown = 0;
    protected gameScene: GameScene;

    constructor(public index: number, protected systems: Systems) {
        this.gameScene = systems.gameScene;
    }

    addBuilding(building: Building, tile: GameTile) {
        if (building.stat.type === "castle") {
            this.base = tile;
        } else if (building.stat.type === "spawn") {
            this.spawn = tile;
        }
        this.buildings.push(building);
    }

    update(delta: number) {
        this.currentHarvestTime +=  delta * 5 / (5 - this.numberOfHarvesters * 2);
        if (this.currentHarvestTime > this.harvestTime) {
            this.resource += 10;
            this.currentHarvestTime -= this.harvestTime;
            console.log(this.resource);
        }
        if (this.createCoolDown > 0) {
            this.createCoolDown = Math.max(0, this.createCoolDown - delta);
            // console.log("Create cooldown", this.createCoolDown | 0);
        }
    }

    resetCreateCoolDown() {
        this.createCoolDown = this.baseCreateCoolDown * this.units.length;
    }

    takeObjectiveDamage() {
        this.currentBaseHealth = Math.max(0, this.currentBaseHealth - this.maxBaseHealth / 2);
    }

    createUnit(hex: Hex, texture: string, stats: UnitStat, player: Player): Unit {
        const pos = this.systems.hexToPos(hex);
        return new stats.className(this.systems, pos.x, pos.y, texture, stats, player, this.freeHandler.bind(this)).play(Unit.AnimationKeys.IDLE_DOWN);
    }

    buildBarrack() {

    }

    buildFactory() {

    }

    buildHangar() {

    }

    buildTech() {
        throw Error("Unsupported");
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
        const alreadyOccupiedPositions: GameTile[] = [...player.units.map(unit => this.systems.pointToTile(unit.pos.x, unit.pos.y)!)];
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

    async freeHandler(unit: Unit): Promise<void> {
        const unitToFreeInd = unit.player.units.indexOf(unit);
        unit.player.createCoolDown = Math.max(0, unit.player.createCoolDown - unit.player.baseCreateCoolDown);
        if (unit instanceof Harvester) {
            const playerToReward = this.systems.players.filter(e => e !== this)[0];
            playerToReward.resource += 80;
            console.log(playerToReward.resource);
        }
        if (this.selectedUnit === unit) {
            this.deselectUnit();
        }
        await unit.prepForDestroy();
        unit.destroy();
        unit.player.units.splice(unitToFreeInd, 1);
        // console.log(unit.player.units);
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
}
