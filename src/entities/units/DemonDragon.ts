import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";
import Volley, {type VolleyStat} from "../Volley.js";
import {AA_MISSILE, fireShotEffect, TRACER} from "../ShotEffect.js";

/**
 * Texture "demon_dragon", mapped to the reference unit: Talon
 *
 * Has two independent weapons:
 * - Ground gun against infantry, vehicles and harvesters: 57 / 20 / 20 damage, one shot every 0.5s
 * - Anti-air missile against aircraft: 345 damage, 0.1s wind-up, one shot every 2s
 */
export default class DemonDragon extends Unit {
    static readonly stat: UnitStat = {
        attackRange: 1,
        building: Buildings.HANGAR,
        canAttack: true,
        canAttackAir: true,
        className: DemonDragon,
        cost: 30,
        // Per shot: damageAgainstAir is the anti-air missile, the rest is the ground gun
        damageAgainstAir: 345,
        damageAgainstBase: 57,
        damageAgainstInfantry: 57,
        damageAgainstHarvester: 20,
        damageAgainstVehicle: 20,
        goodAgainstInfantry: true,
        goodAgainstFactory: false,
        goodAgainstAir: true,
        flying: true,
        health: 909,
        limit: -1,
        // Ground gun; the anti-air missile uses airVolley
        rateOfFire: 0.5,
        reference: "Talon",
        speed: 140,
        squadSize: 1,
        texture: UnitName.H1_Demon_Dragon,
        type: "aircraft",
        visionRadius: 2,
    };

    static readonly airVolley: VolleyStat = {shots: 1, initialChargeUp: 0.1, shotInterval: 0, reload: 2};

    /** Anti-air missile; the inherited `volley` is the ground gun */
    airVolley = new Volley(DemonDragon.airVolley);

    protected volleyFor(target: Unit): Volley {
        return target.stat.type === "aircraft" ? this.airVolley : this.volley;
    }

    protected updateVolleys(delta: number, engaged: boolean) {
        const againstAir = this.target?.stat.type === "aircraft";
        this.volley.update(delta, engaged && !againstAir);
        this.airVolley.update(delta, engaged && againstAir);
    }

    protected playShotEffect(target: Unit, volley: Volley) {
        const style = volley === this.airVolley ? AA_MISSILE : TRACER;
        fireShotEffect(this.scene, this.x, this.y - 30, target.x, target.y - 20, this.visible || target.visible, style);
    }
}
