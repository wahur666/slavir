import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";

export default class DemonDragon extends Unit {
    static readonly stat: UnitStat = {
        attackRange: 1,
        building: Buildings.HANGAR,
        canAttack: true,
        canAttackAir: true,
        className: DemonDragon,
        cost: 30,
        damageAgainstAir: 172.5,
        damageAgainstBase: 172.5,
        damageAgainstInfantry: 114,
        damageAgainstHarvester: 40,
        damageAgainstVehicle: 40,
        goodAgainstInfantry: true,
        goodAgainstFactory: false,
        goodAgainstAir: true,
        flying: true,
        health: 909,
        limit: -1,
        rateOfFire: 1,
        reference: "Talon",
        speed: 140,
        squadSize: 1,
        texture: UnitName.H1_Demon_Dragon,
        type: "aircraft",
        visionRadius: 2,
    };
}
