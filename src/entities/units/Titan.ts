import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";
import {Hex} from "../../model/hexgrid/Hex.js";
import {fireShockwave} from "../Shockwave.js";
import type GameTile from "../../model/GameTile.js";

/**
 * Texture "titan" (assets/06.png), mapped to the reference unit: Titan
 *
 * Heavy walker from the Tech Lab: 2000 damage against vehicles and harvesters, 180 against infantry, cannot hit aircraft.
 * One shot every 5s after a 0.3s wind-up.
 *
 * Its shot is a shockwave that travels in a line: it hits the target's hex and the hex right behind it (seen from the
 * Titan), damaging every enemy ground unit on both. If either hex belongs to the enemy base (the castle or a building
 * slot, not the spawn), the base takes one hit too, never two, whatever the angle.
 */
export default class Titan extends Unit {
    static readonly stat: UnitStat = {
        attackRange: 1,
        building: Buildings.TECH,
        canAttack: true,
        canAttackAir: false,
        className: Titan,
        cost: 130,
        damageAgainstAir: 0,
        damageAgainstBase: 2000,
        damageAgainstInfantry: 180,
        damageAgainstHarvester: 2000,
        damageAgainstVehicle: 2000,
        flying: false,
        goodAgainstInfantry: false,
        goodAgainstFactory: true,
        goodAgainstAir: false,
        health: 5500,
        limit: -1,
        rateOfFire: 5,
        initialChargeUp: 0.3,
        reference: "Titan",
        speed: 100,
        squadSize: 1,
        texture: UnitName.T2_Titan,
        type: "vehicle",
        visionRadius: 2,
    };

    /** The hex right behind `target`, on the line from `origin` through `target` */
    static hexBehind(origin: Hex, target: Hex): Hex {
        const distance = origin.distance(target);
        if (distance === 0) return target;
        // Same nudge as Hex.lineDraw, so a line along a hex edge rounds consistently
        const nudge = (hex: Hex) => hex.add(new Hex(1e-6, 1e-6, -2e-6));
        return nudge(origin)
            .lerp(nudge(target), (distance + 1) / distance)
            .round();
    }

    attackTarget(): number[] {
        const target = this.fireTarget;
        const origin = this.gameTile();
        const targetTile = target?.gameTile();
        const shooters = super.attackTarget();
        if (shooters.length === 0 || !target || !origin || !targetTile) return shooters;
        // The target itself was already hit by the normal shot
        const hitTiles = this.shockwave(origin, targetTile, shooters.length, target, this.visible || target.visible);
        // The wave rolls on into the enemy base behind the target
        const baseTile = hitTiles.find(tile => this.isEnemyBaseTile(tile));
        if (baseTile) this.player.enemyPlayer.takeBaseDamage(this.stat.damageAgainstBase * shooters.length, baseTile);
        return shooters;
    }

    protected attackBaseTile(): number[] {
        const tile = this.baseFireTile;
        const origin = this.gameTile();
        const shooters = super.attackBaseTile();
        if (shooters.length === 0 || !tile || !origin) return shooters;
        // The base was hit by the normal shot, a base hex behind it is the same base and takes no second hit
        this.shockwave(origin, tile, shooters.length, null, this.visible || this.systems.player1.visibleTiles.has(tile));
        return shooters;
    }

    /**
     * Rolls the wave through `targetTile` and the hex behind it: draws it and damages every enemy unit on them except
     * `spared`, which the normal shot already hit
     * @returns the hexes the wave went through
     */
    private shockwave(origin: GameTile, targetTile: GameTile, shooters: number, spared: Unit | null, visible: boolean): GameTile[] {
        const behindTile = this.systems.map.hexToTile(Titan.hexBehind(origin.hex, targetTile.hex));
        const hitTiles = behindTile ? [targetTile, behindTile] : [targetTile];
        for (const enemy of [...this.player.enemyPlayer.units]) {
            if (enemy === spared || !this.canAttack(enemy)) continue;
            const tile = enemy.gameTile();
            if (tile && hitTiles.some(hit => hit.equals(tile))) enemy.takeDamage(this, shooters);
        }
        fireShockwave(
            this.scene,
            this.pos,
            hitTiles.map(tile => this.systems.hexToPos(tile.hex)),
            visible
        );
        return hitTiles;
    }

    private isEnemyBaseTile(tile: GameTile): boolean {
        return this.player.enemyPlayer.baseTiles.some(baseTile => baseTile.equals(tile));
    }

    /** The shockwave is drawn in {@link attackTarget}, which knows the hexes it travels through */
    protected playShotEffect() {}
}
