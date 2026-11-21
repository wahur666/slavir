import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";
import type Volley from "../Volley.js";
import {fireShotEffect, TRACER} from "../ShotEffect.js";

/**
 * Texture "wolverine" (assets/24.png), mapped to the reference unit: Wolverine
 *
 * Fast-firing light walker from the Tech Lab: 45 / 19 / 50 damage against infantry / vehicles / aircraft, one shot every 0.19s
 */
export default class Wolverine extends Unit {
    static readonly stat: UnitStat = {
        attackRange: 1,
        building: Buildings.TECH,
        canAttack: true,
        canAttackAir: true,
        className: Wolverine,
        cost: 80,
        damageAgainstAir: 50,
        damageAgainstBase: 45,
        damageAgainstInfantry: 45,
        damageAgainstHarvester: 19,
        damageAgainstVehicle: 19,
        flying: false,
        goodAgainstInfantry: true,
        goodAgainstFactory: false,
        goodAgainstAir: true,
        health: 2800,
        limit: -1,
        rateOfFire: 0.19,
        reference: "Wolverine",
        speed: 100,
        squadSize: 1,
        texture: UnitName.T1_Wolverine,
        type: "vehicle",
        visionRadius: 2,
    };

    protected playShotEffect(target: Unit, _volley: Volley) {
        fireShotEffect(this.scene, this.x, this.y - 30, target.x, target.y - 20, this.visible || target.visible, TRACER);
    }
}
