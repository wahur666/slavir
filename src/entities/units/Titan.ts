import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";
import {Hex} from "../../model/hexgrid/Hex.js";
import {fireShockwave} from "../Shockwave.js";

/**
 * Texture "titan" (assets/06.png), mapped to the reference unit: Titan
 *
 * Heavy walker from the Tech Lab: 2000 damage against vehicles and harvesters, 180 against infantry, cannot hit aircraft.
 * One shot every 5s after a 0.3s wind-up.
 *
 * Its shot is a shockwave that travels in a line: it hits the target's hex and the hex right behind it (seen from the
 * Titan), damaging every enemy ground unit on both.
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

        const behindTile = this.systems.map.hexToTile(Titan.hexBehind(origin.hex, targetTile.hex));
        const hitTiles = behindTile ? [targetTile, behindTile] : [targetTile];
        // Everyone else caught in the wave; the target itself was already hit by the normal shot
        for (const enemy of [...this.player.enemyPlayer.units]) {
            if (enemy === target || !this.canAttack(enemy)) continue;
            const tile = enemy.gameTile();
            if (tile && hitTiles.some(hit => hit.equals(tile))) enemy.takeDamage(this, shooters.length);
        }

        const visible = this.visible || target.visible;
        fireShockwave(
            this.scene,
            this.pos,
            hitTiles.map(tile => this.systems.hexToPos(tile.hex)),
            visible
        );
        return shooters;
    }

    /** The shockwave is drawn in {@link attackTarget}, which knows the hexes it travels through */
    protected playShotEffect() {}
}
