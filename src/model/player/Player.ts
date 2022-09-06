import Unit from "../../entities/Unit";
import Building, {Buildings, buildingStat} from "../../entities/Building";
import type GameTile from "../GameTile";
import type Resource from "../../entities/Resource";
import type Systems from "../Systems";
import type GameScene from "../../scenes/GameScene";
import type {UnitStat} from "../../entities/UnitsStats";
import {Pathfinding} from "../HexMap";
import type {Hex} from "../hexgrid";
import Harvester from "../../entities/Harvester";
import {findObjectByProperty} from "../../helpers/tilemap.helper";
import {UnitName, unitStatMap} from "../../entities/UnitsStats";


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

    protected constructor(public index: number, protected systems: Systems) {
        this.gameScene = systems.gameScene;
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

    private createUnitWithPos(hex: Hex, texture: string, stats: UnitStat): Unit {
        const pos = this.systems.hexToPos(hex);
        return new stats.className(this.systems, pos.x, pos.y, texture, stats, this, this.freeHandler.bind(this)).play(Unit.AnimationKeys.IDLE_DOWN);
    }

    increaseHarvesterCount() {
        this.numberOfHarvesters = Math.min(this.numberOfHarvesters + 1, 2);
    }

    decreaseHarvesterCount() {
        this.numberOfHarvesters = Math.max(this.numberOfHarvesters - 1 , 0);
    }

    createUnit(e: UnitName) {
        const unitStat = unitStatMap.get(e);
        if (!unitStat) {
            return;
        }
        if (this.createCoolDown !== 0) {
            return;
        }
        if (this.units.length > 5) {
            return;
        }
        if (this.resource < unitStat.cost) {
            return;
        }
        this.resource -= unitStat.cost;
        console.log("Player", this.index, "index", this.resource);
        const alreadyOccupiedPositions: GameTile[] = [...this.units.map(unit => this.systems.pointToTile(unit.pos.x, unit.pos.y)!)];
        const possibleTiles: { distance: number; tile: GameTile }[] = this.systems.map.tiles
            .filter(tile => !alreadyOccupiedPositions.includes(tile) && tile.pathfinding === Pathfinding.GROUND)
            .map(tile => ({
                tile,
                distance: this.systems.map.tileDistance(tile, this.base!) + this.systems.map.tileDistance(tile, this.spawn!)
            }))
            .sort((a, b) => a.distance - b.distance);
        if (possibleTiles.length > 0 && this.units.length < 6 && (unitStat.limit === -1 || unitStat.limit > this.units.filter(u => u.stat.texture === unitStat.texture).length)) {
            const unit = this.createUnitWithPos(possibleTiles[0].tile.hex, unitStat.texture, unitStat);
            this.units.push(unit);
            this.resetCreateCoolDown();
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

    addBuilding(building: Building, tile: GameTile) {
        if (building.stat.type === "castle") {
            this.base = tile;
        } else if (building.stat.type === "spawn") {
            this.spawn = tile;
        }
        this.buildings.push(building);
    }

    createBuilding(building: Buildings) {
        let baseTile;
        if (building === Buildings.CASTLE || building == Buildings.SPAWN) {
            baseTile = findObjectByProperty(this.systems.layers["base" + this.index].objects, "id", building);
        } else {
            baseTile = findObjectByProperty(this.systems.layers["base" + this.index].objects, "id", Object.values(this.hasBuildings).filter(e => !!e).length + 1);
        }
        let a;
        if (baseTile && baseTile.x && baseTile.y) {
            a = this.systems.map.pixelToTile(baseTile.x, baseTile.y);
        }
        const hex = a?.hex;
        if (hex) {
            const pos = this.systems.hexToPos(hex);
            const tile = this.systems.map.tiles.find(e => e.hex.equals(hex))!;
            this.addBuilding(new Building(this.systems, pos.x, pos.y, buildingStat.get(Buildings[building].toLowerCase())!), tile);
        }
    }

    buildSpawnAndBase() {
        this.createBuilding(Buildings.CASTLE);
        this.createBuilding(Buildings.SPAWN);
    }

    buildBarrack() {
        this.createBuilding(Buildings.BARRACK);
        this.hasBuildings.BARRACK = true;
    }

    buildFactory() {
        this.createBuilding(Buildings.FACTORY);
        this.hasBuildings.FACTORY = true;
    }

    buildHangar() {
        this.createBuilding(Buildings.HANGAR);
        this.hasBuildings.HANGAR = true;
    }

    buildTech() {
        // this.createBuilding(Buildings.TECH);
        // this.hasBuildings.TECH = true;
        throw Error("Unsupported");
    }


    createAllPlayerBuildings() {
        this.buildFactory();
        this.buildBarrack();
        this.buildHangar();
    }

    create() {
        this.buildSpawnAndBase();
    }
}
