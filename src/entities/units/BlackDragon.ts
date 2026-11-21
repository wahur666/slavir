import Unit from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";

/** Texture "black_dragon", mapped to the reference unit: Orca */
export default class BlackDragon extends Unit {
    static readonly stat: UnitStat = {
        attackRange: 1,
        building: Buildings.HANGAR,
        canAttack: true,
        canAttackAir: false,
        className: BlackDragon,
        cost: 70,
        damageAgainstAir: 0,
        damageAgainstBase: 510,
        damageAgainstVehicle: 510,
        damageAgainstHarvester: 510,
        damageAgainstInfantry: 75,
        goodAgainstInfantry: false,
        goodAgainstFactory: true,
        goodAgainstAir: false,
        flying: true,
        health: 1210,
        limit: -1,
        rateOfFire: 9,
        reference: "Orca",
        speed: 140,
        squadSize: 1,
        texture: UnitName.H2_Black_Dragon,
        type: "aircraft",
        visionRadius: 2,
        volley: {shots: 4, initialChargeUp: 0.1, shotInterval: 0.2, reload: 9},
    };
}
