import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";

/** Texture "female_archer", mapped to the reference unit: Missile Squad */
export default class FemaleArcher extends Unit {
    static readonly stat: UnitStat = {
        attackRange: 1,
        building: Buildings.BARRACK,
        canAttack: true,
        canAttackAir: true,
        className: FemaleArcher,
        cost: 20,
        damageAgainstAir: 250,
        damageAgainstBase: 250,
        damageAgainstInfantry: 35,
        damageAgainstHarvester: 250,
        damageAgainstVehicle: 250,
        flying: false,
        goodAgainstInfantry: false,
        goodAgainstFactory: true,
        goodAgainstAir: true,
        health: 220,
        limit: -1,
        rateOfFire: 5,
        reference: "Missile Squad",
        speed: 100,
        squadSize: 4,
        texture: UnitName.B2_Female_Archer,
        type: "infantry",
        visionRadius: 2,
    };
}
