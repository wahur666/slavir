import type Player from "../player/Player.js";
import type Systems from "../Systems.js";
import type GameTile from "../GameTile.js";
import {Pathfinding} from "../HexMap.js";
import Harvester from "../../entities/units/Harvester.js";
import IonCannonStrike from "../../entities/powers/IonCannonStrike.js";
import {PowerName, ionCannonDamage, ION_CANNON_FALLOFF, powerStats, withinTurretForwardLimit} from "./PowerRules.js";

/**
 * A player's commander powers: costs, cooldowns, where each may be used, and their effects.
 * Called through the "power" command, so human input, the AI and replays all go the same way.
 *
 * - Turret: a gun emplacement on a visible, free, walkable hex that is no pad, no building, and at most
 *   1.5 hexes past the middle of the map
 * - Ion cannon: after a 3.3s blast sequence, heavy damage to the enemies on the targeted visible hex,
 *   half of it to the hexes around
 */
export default class CommanderPowers {
    /** ms left before each power can be used again */
    readonly coolDowns: Record<PowerName, number> = {[PowerName.Turret]: 0, [PowerName.IonCannon]: 0};
    /** Ion cannon strikes on their way */
    readonly strikes: IonCannonStrike[] = [];

    constructor(
        private readonly player: Player,
        private readonly systems: Systems
    ) {}

    update(delta: number) {
        for (const power of Object.values(PowerName)) {
            this.coolDowns[power] = Math.max(0, this.coolDowns[power] - delta);
        }
        for (const strike of [...this.strikes]) {
            if (strike.update(delta)) this.strikes.splice(this.strikes.indexOf(strike), 1);
        }
    }

    /** Off cooldown and affordable, wherever it is aimed */
    isReady(power: PowerName): boolean {
        return this.coolDowns[power] === 0 && this.player.resource >= powerStats[power].cost;
    }

    /** Whether the power may be aimed at the tile, regardless of cost and cooldown */
    canTarget(power: PowerName, tile: GameTile | undefined): tile is GameTile {
        if (!tile || tile.tile.index === -1 || !this.player.visibleTiles.has(tile)) return false;
        return power === PowerName.Turret ? this.canPlaceTurret(tile) : true;
    }

    canUse(power: PowerName, tile: GameTile | undefined): tile is GameTile {
        return this.systems.gameScene.canIssueCommands && this.isReady(power) && this.canTarget(power, tile);
    }

    /** Pays for and fires the power; use the "power" command instead of calling this directly */
    use(power: PowerName, tile: GameTile | undefined): boolean {
        if (!this.canUse(power, tile)) return false;
        this.player.resource -= powerStats[power].cost;
        this.coolDowns[power] = powerStats[power].coolDown;
        if (power === PowerName.Turret) {
            this.player.deployTurret(tile);
        } else {
            this.fireIonCannon(tile);
        }
        return true;
    }

    private canPlaceTurret(tile: GameTile): boolean {
        const systems = this.systems;
        if (tile.pathfinding !== Pathfinding.GROUND) return false;
        if (tile === systems.nukeGameTile || [systems.pad1GameTiles, systems.pad2GameTiles, systems.pad3GameTiles].some(pad => pad.includes(tile))) {
            return false;
        }
        if (systems.players.some(player => player.buildings.some(building => building.gameTile() === tile))) return false;
        const onTile = systems
            .allUnits()
            .some(unit => !unit.markedForDeletion && (unit.claimedTile === tile || unit.destination === tile || unit.gameTile() === tile));
        if (onTile) return false;
        return this.withinForwardLimit(tile);
    }

    /** At most 1.5 hexes past the middle of the map (the objective's column), towards the enemy */
    private withinForwardLimit(tile: GameTile): boolean {
        const own = this.player.base;
        const enemy = this.player.enemyPlayer.base;
        if (!own || !enemy) return false;
        const map = this.systems.map;
        const towardsEnemy = Math.sign(map.getCenter(enemy).x - map.getCenter(own).x) || 1;
        const offsetX = (map.getCenter(tile).x - map.getCenter(this.systems.nukeGameTile).x) * towardsEnemy;
        return withinTurretForwardLimit(offsetX, this.hexWidth);
    }

    /** Horizontal distance between neighbouring hex centers, unscaled */
    private get hexWidth(): number {
        return this.systems.map.layout.size.x * Math.sqrt(3);
    }

    private fireIonCannon(tile: GameTile) {
        const pos = this.systems.hexToPos(tile.hex);
        // The visuals cover the full-damage hex and the half-damage ring around it
        const radius = this.hexWidth * this.systems.scaleFactor * (ION_CANNON_FALLOFF.length - 0.35);
        const strike = new IonCannonStrike(this.systems.gameScene, pos, radius, () => this.ionBlast(tile));
        this.strikes.push(strike);
    }

    /** Damages the enemies around the tile; units that walked away in time are spared */
    private ionBlast(tile: GameTile) {
        for (const enemy of [...this.player.enemyPlayer.units]) {
            if (enemy.markedForDeletion) continue;
            const damage = ionCannonDamage(enemy.stat.type, enemy instanceof Harvester, enemy.gameTile().distance(tile));
            if (damage > 0) enemy.applyDamage(damage);
        }
    }
}
