import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";

export default class Fantasy8 extends Unit {
    static readonly stat: UnitStat = {
        attackRange: 1,
        building: Buildings.BARRACK,
        canAttack: true,
        canAttackAir: false,
        className: Fantasy8,
        cost: 10,
        damageAgainstAir: 0,
        damageAgainstBase: 38,
        damageAgainstInfantry: 38,
        damageAgainstHarvester: 38,
        damageAgainstVehicle: 15,
        flying: false,
        goodAgainstInfantry: true,
        goodAgainstFactory: false,
        goodAgainstAir: false,
        health: 130,
        limit: -1,
        rateOfFire: 1.72,
        reference: "Rifleman",
        speed: 120,
        squadSize: 5,
        texture: UnitName.B1_Fantasy8,
        type: "infantry",
        visionRadius: 3,
    };
}
