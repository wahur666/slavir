import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";

/** Texture "guard", mapped to the reference unit: Predator Tank */
export default class Guard extends Unit {
    static readonly stat: UnitStat = {
        attackRange: 1,
        building: Buildings.FACTORY,
        canAttack: true,
        canAttackAir: false,
        fireOnMove: true,
        className: Guard,
        cost: 70,
        damageAgainstAir: 0,
        damageAgainstBase: 830,
        damageAgainstInfantry: 96,
        damageAgainstHarvester: 830,
        damageAgainstVehicle: 830,
        goodAgainstInfantry: false,
        goodAgainstFactory: true,
        goodAgainstAir: false,
        flying: false,
        health: 2823,
        limit: -1,
        rateOfFire: 3.44,
        reference: "Predator Tank",
        speed: 80,
        squadSize: 1,
        texture: UnitName.F2_Guard,
        type: "vehicle",
        visionRadius: 2,
    };
}
