import type Phaser from "phaser";
import Unit from "../../entities/Unit.js";
import Building, {Buildings, buildingStat} from "../../entities/Building.js";
import type GameTile from "../GameTile.js";
import type Resource from "../../entities/Resource.js";
import type Systems from "../Systems.js";
import type GameScene from "../../scenes/GameScene.js";
import type {UnitStat} from "../../entities/UnitsStats.js";
import type {UnitName} from "../../entities/UnitsStats.js";
import {unitStatMap} from "../../entities/units/UnitRegistry.js";
import {Pathfinding} from "../HexMap.js";
import type {Hex} from "../hexgrid/Hex.js";
import Harvester from "../../entities/units/Harvester.js";
import {findObjectByProperty} from "../../helpers/tilemap.helper.js";
import HealthBar from "../../entities/HealthBar.js";
import CommanderPowers from "../power/CommanderPowers.js";
import Turret from "../../entities/units/Turret.js";
import {TURRET_TEXTURES} from "../../entities/powers/PowerArt.js";

export default abstract class Player {
    /** Paid to the enemy of a player who loses a harvester */
    static readonly HARVESTER_BOUNTY = 80;

    /** Every unit of the player, deployed structures (turrets) included, see {@link army} */
    units: Unit[] = [];
    visibleEnemyUnits: Unit[] = [];
    /** Tiles the player currently sees, updated by the fog of war pass every tick */
    visibleTiles: Set<GameTile> = new Set();
    buildings: Building[] = [];
    selectedUnit: Unit | null = null;
    resources: Resource[] = [];
    base: GameTile | undefined;
    spawn: GameTile | undefined;
    maxBaseHealth = 30_000;
    currentBaseHealth = this.maxBaseHealth;
    resource = 100;
    hasBuildings = {
        BARRACK: false,
        FACTORY: false,
        HANGAR: false,
        TECH: false,
    };

    protected maxUnitCount: number = 10;
    numberOfHarvesters = 0;
    /** Harvesters lost (destroyed or dismissed) that can be rebuilt for free, one each; see {@link unitCost} */
    freeHarvesters = 0;
    currentHarvestTime = 0;
    harvestTime = 5000;

    baseCreateCoolDown = 2500;
    // The cooldown counter which counts down
    createCoolDown = 0;
    // The current cooldown is started counting down
    createCoolDownDuration = 0;
    protected gameScene: GameScene;
    private baseHealthBar?: HealthBar;
    readonly powers: CommanderPowers;

    protected constructor(
        public index: number,
        protected systems: Systems
    ) {
        this.gameScene = systems.gameScene;
        this.powers = new CommanderPowers(this, systems);
    }

    /** Unit cap, see {@link army} */
    get maxUnits(): number {
        return this.maxUnitCount;
    }

    /** Recruited units, without structures; the unit cap and the recruitment cooldown count these */
    get army(): Unit[] {
        return this.units.filter(unit => unit.stat.type !== "structure");
    }

    update(delta: number) {
        this.currentHarvestTime += (delta * 5) / (5 - this.numberOfHarvesters * 2);
        while (this.currentHarvestTime >= this.harvestTime) {
            this.resource += 10;
            this.currentHarvestTime -= this.harvestTime;
            console.log(this.resource);
        }
        this.powers.update(delta);
        if (this.createCoolDown > 0) {
            this.createCoolDown = Math.max(0, this.createCoolDown - delta);
            // console.log("Create cooldown", this.createCoolDown | 0);
        }
        if (this.baseHealthBar) {
            const castle = this.buildings[0];
            this.baseHealthBar.update(castle.x, castle.y - 60, this.currentBaseHealth / this.maxBaseHealth);
        }
    }

    private resetCreateCoolDown() {
        this.createCoolDownDuration = this.baseCreateCoolDown * this.army.length;
        this.createCoolDown = this.createCoolDownDuration;
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
        this.numberOfHarvesters = Math.max(this.numberOfHarvesters - 1, 0);
    }

    /** What recruiting the unit costs now: a lost harvester is replaced for free */
    unitCost(e: UnitName): number {
        const unitStat = unitStatMap.get(e);
        if (!unitStat) return 0;
        return unitStat.className === Harvester && this.freeHarvesters > 0 ? 0 : unitStat.cost;
    }

    canCreateUnit(e: UnitName): boolean {
        const unitStat = unitStatMap.get(e);
        if (!unitStat) return false;

        if (!this.gameScene.canIssueCommands) return false;
        if (this.createCoolDown !== 0) return false;
        if (this.army.length >= this.maxUnitCount) return false;
        if (this.resource < this.unitCost(e)) return false;

        if (!this.buildings.some(b => b.stat.type === unitStat.building)) return false;

        if (unitStat.limit !== -1) {
            const count = this.units.filter(u => u.stat.texture === e).length;
            if (count >= unitStat.limit) return false;
        }

        return true;
    }

    createUnit(e: UnitName): Unit | null {
        if (!this.canCreateUnit(e)) return null;
        const unitStat = unitStatMap.get(e)!;
        const cost = this.unitCost(e);
        const unit = this.placeUnit(unitStat);
        if (unit) {
            this.resource -= cost;
            if (unit instanceof Harvester && cost === 0) this.freeHarvesters--;
            this.resetCreateCoolDown();
            this.selectUnit(unit);
        }
        return unit;
    }

    /** Puts a new unit on the free ground tile closest to the base and spawn, without any cost or availability check */
    placeUnit(unitStat: UnitStat): Unit | null {
        const alreadyOccupiedPositions = this.systems.players
            .flatMap(player => player.units)
            // Never two units on one hex, flying or not
            .filter(unit => !unit.markedForDeletion)
            .flatMap(unit => (unit.destination ? [unit.claimedTile, unit.destination] : [unit.claimedTile]));
        const possibleTiles: {distance: number; tile: GameTile}[] = this.systems.map.tiles
            .filter(tile => !alreadyOccupiedPositions.includes(tile) && tile.pathfinding === Pathfinding.GROUND)
            .map(tile => ({
                tile,
                distance: this.systems.map.tileDistance(tile, this.base!) + this.systems.map.tileDistance(tile, this.spawn!),
            }))
            .sort((a, b) => a.distance - b.distance);
        if (possibleTiles.length > 0) {
            const unit = this.createUnitWithPos(possibleTiles[0].tile.hex, unitStat.texture, unitStat);
            // Enemy units start hidden; the fog of war pass reveals them once they are on a visible tile.
            // Without this a unit created after the fog pass is drawn for one frame.
            if (this !== this.systems.player1) unit.setActivelyVisible(false);
            this.units.push(unit);
            return unit;
        }
        return null;
    }

    /**
     * Removes a unit that died or left the game
     * @param destroyed it was killed; a dismissed harvester pays no bounty and gives no free rebuild
     */
    protected freeHandler(unit: Unit, destroyed = true): void {
        if (unit.markedForDeletion || !this.units.includes(unit)) return;
        if (unit.stat.type !== "structure") {
            unit.player.createCoolDown = Math.max(0, unit.player.createCoolDown - unit.player.baseCreateCoolDown);
        }
        if (unit instanceof Harvester && destroyed) {
            // The bounty goes to the enemy whoever destroyed it, the owner's own ion cannon included
            this.enemyPlayer.resource += Player.HARVESTER_BOUNTY;
            this.freeHarvesters++;
        }
        if (this.selectedUnit === unit) {
            this.deselectUnit();
        }
        this.systems.commands.forget(unit);
        unit.prepForDestroy(() => {
            unit.destroy();
            const unitToFreeInd = this.units.indexOf(unit);
            if (unitToFreeInd !== -1) this.units.splice(unitToFreeInd, 1);
            this.onUnitRemoved(unit);
        });
    }

    /** A structure ran out of lifespan; it is removed like a destroyed one */
    expireStructure(unit: Unit): void {
        this.freeHandler(unit);
    }

    /** Puts a turret on the tile; validation and cost are handled by {@link CommanderPowers} */
    deployTurret(tile: GameTile): Turret {
        const pos = this.systems.hexToPos(tile.hex);
        const texture = TURRET_TEXTURES[this === this.systems.player1 ? 0 : 1];
        const turret = new Turret(this.systems, pos.x, pos.y, texture, Turret.stat, this, this.freeHandler.bind(this));
        turret.play(Unit.AnimationKeys.IDLE_DOWN);
        if (this !== this.systems.player1) turret.setActivelyVisible(false);
        this.units.push(turret);
        return turret;
    }

    /** Leaves the power targeting mode; returns true if it was active (only a human player has one) */
    cancelTargeting(): boolean {
        return false;
    }

    /** Called once a dead unit finished dying and left {@link units} */
    protected onUnitRemoved(_unit: Unit): void {}

    /** Removes the unit from the game; issue a "disband" command instead of calling this directly */
    disband(unit: Unit): void {
        this.freeHandler(unit, false);
    }

    protected selectUnit(unit: Unit): void {
        if (this.selectedUnit && unit !== this.selectedUnit) {
            this.selectedUnit.selected = false;
        }
        this.selectedUnit = unit;
        this.selectedUnit.selected = true;
    }

    protected deselectUnit(): void {
        if (this.selectedUnit) {
            this.selectedUnit.selected = false;
            this.selectedUnit = null;
        }
    }

    private cachedBaseTiles: GameTile[] | null = null;

    /**
     * The base's five hexes: the castle and the four building slots around it (the spawn is not part of it).
     * Units cannot attack the base; the ion cannon damages it when it hits on or next to one of these.
     */
    get baseTiles(): GameTile[] {
        if (!this.cachedBaseTiles) {
            const objects = this.systems.layers[`base${this.index}` as "base1" | "base2"].objects;
            this.cachedBaseTiles = [0, 1, 2, 3, 4]
                .map(id => findObjectByProperty(objects, "id", id))
                .filter(object => object?.x !== undefined && object.y !== undefined)
                .map(object => this.systems.map.pixelToTile(object.x!, object.y!))
                .filter((tile): tile is GameTile => !!tile);
        }
        return this.cachedBaseTiles;
    }

    get enemyPlayer(): Player {
        return this.systems.enemyPlayer(this);
    }

    private addBuilding(building: Building, tile: GameTile): void {
        if (building.stat.type === "castle") {
            this.base = tile;
        } else if (building.stat.type === "spawn") {
            this.spawn = tile;
        }
        this.buildings.push(building);
    }

    public createBuilding(building: Buildings): Building | null {
        const stats = buildingStat.get(building);
        if (!stats) {
            return null;
        }
        const initialBuilding = building === Buildings.CASTLE || building === Buildings.SPAWN;
        if (!initialBuilding && !this.gameScene.canIssueCommands) {
            return null;
        }
        if (this.buildings.some(existing => existing.stat.type === building)) {
            return null;
        }
        if (this.resource < stats.cost) {
            return null;
        }

        let baseTile: Phaser.Types.Tilemaps.TiledObject = null;
        if (building === Buildings.CASTLE || building === Buildings.SPAWN) {
            const id = building === Buildings.CASTLE ? 0 : 5;
            baseTile = findObjectByProperty(this.systems.layers["base" + this.index].objects, "id", id);
        } else {
            baseTile = findObjectByProperty(
                this.systems.layers["base" + this.index].objects,
                "id",
                Object.values(this.hasBuildings).filter(e => !!e).length + 1
            );
        }
        let gameTile: GameTile | undefined;
        if (baseTile && baseTile.x !== undefined && baseTile.y !== undefined) {
            gameTile = this.systems.map.pixelToTile(baseTile.x, baseTile.y);
        }
        const hex = gameTile?.hex;
        if (hex) {
            const pos = this.systems.hexToPos(hex);
            const tile = this.systems.map.tiles.find(e => e.hex.equals(hex))!;
            const created = new Building(this.systems, pos.x, pos.y, stats);
            this.addBuilding(created, tile);
            this.resource -= stats.cost;
            if (this === this.systems.player1) created.setRevealed(true);
            if (building === Buildings.CASTLE) {
                this.baseHealthBar = new HealthBar(this.gameScene, pos.x, pos.y - 60, 100, 15);
            }
            switch (building) {
                case Buildings.BARRACK:
                    this.hasBuildings.BARRACK = true;
                    break;
                case Buildings.FACTORY:
                    this.hasBuildings.FACTORY = true;
                    break;
                case Buildings.HANGAR:
                    this.hasBuildings.HANGAR = true;
                    break;
                case Buildings.TECH:
                    this.hasBuildings.TECH = true;
                    break;
            }
            return created;
        }
        return null;
    }

    private buildSpawnAndBase(): void {
        this.createBuilding(Buildings.CASTLE);
        this.createBuilding(Buildings.SPAWN);
    }

    buildBarrack(): Building | null {
        return this.createBuilding(Buildings.BARRACK);
    }

    buildFactory(): Building | null {
        return this.createBuilding(Buildings.FACTORY);
    }

    buildHangar(): Building | null {
        return this.createBuilding(Buildings.HANGAR);
    }

    private buildTech(): Building | null | never {
        // this.createBuilding(Buildings.TECH);
        // this.hasBuildings.TECH = true;
        throw Error("Unsupported");
    }

    create(): void {
        this.buildSpawnAndBase();
    }
}
