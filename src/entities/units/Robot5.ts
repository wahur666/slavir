import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";

export default class Robot5 extends Unit {
    static readonly stat: UnitStat = {
        attackRange: 1,
        building: Buildings.FACTORY,
        canAttack: true,
        canAttackAir: true,
        className: Robot5,
        cost: 30,
        damageAgainstAir: 82,
        damageAgainstBase: 80,
        damageAgainstInfantry: 80,
        damageAgainstHarvester: 60,
        damageAgainstVehicle: 60,
        flying: false,
        goodAgainstInfantry: true,
        goodAgainstFactory: false,
        goodAgainstAir: true,
        health: 1611,
        limit: -1,
        rateOfFire: 0.75,
        reference: "Rhino",
        speed: 120,
        squadSize: 1,
        texture: UnitName.F1_Robot5,
        type: "vehicle",
        visionRadius: 2,
    };
}
