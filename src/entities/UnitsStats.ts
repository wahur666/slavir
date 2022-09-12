import type {BuildingStat} from "./Building";
import {Buildings} from "./Building";
import Unit from "./Unit";
import Harvester from "./Harvester";

export enum UnitName {
    B1_Fantasy8 = "fantasy8",
    B2_Female_Archer = "female_archer",
    F1_Robot5 = "robot5",
    F2_Guard = "guard",
    H1_Demon_Dragon = "demon_dragon",
    H2_Black_Dragon = "black_dragon",
    Harvester = "male_engineer",
}

export interface UnitStat {
    building: BuildingStat["type"]
    attackRange: 1 | 2;
    canAttack: boolean,
    canAttackAir: boolean;
    className: typeof Unit;
    cost: number;
    damageAgainstAir: number;
    damageAgainstBase: number;
    damageAgainstInfantry: number;
    damageAgainstHarvester: number;
    damageAgainstVehicle: number;
    flying: boolean;
    goodAgainstInfantry: boolean;
    goodAgainstFactory: boolean;
    goodAgainstAir: boolean;
    health: number;
    limit: number;
    rateOfFire: number;
    reference: string;
    speed: number;
    squadSize: number;
    texture: UnitName;
    type: "infantry" | "vehicle" | "aircraft"
    visionRadius: 1 | 2 | 3;
}


export const unitStatMap: Map<UnitName, UnitStat> = new Map([
    [UnitName.B1_Fantasy8, {
        attackRange: 1,
        building: Buildings.BARRACK,
        canAttack: true,
        canAttackAir: false,
        className: Unit,
        cost: 10,
        damageAgainstAir: 0,
        damageAgainstBase: 38,
        damageAgainstInfantry: 38,
        damageAgainstHarvester: 15,
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
        visionRadius: 3
    }],
    [UnitName.B2_Female_Archer, {
        attackRange: 1,
        building: Buildings.BARRACK,
        canAttack: true,
        canAttackAir: true,
        className: Unit,
        cost: 30,
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
        visionRadius: 2
    }],
    [UnitName.F1_Robot5, {
        attackRange: 1,
        building: Buildings.FACTORY,
        canAttack: true,
        canAttackAir: true,
        className: Unit,
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
        visionRadius: 2
    }],
    [UnitName.F2_Guard, {
        attackRange: 1,
        building: Buildings.FACTORY,
        canAttack: true,
        canAttackAir: false,
        className: Unit,
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
        health: 250,
        limit: -1,
        rateOfFire: 3.44,
        reference: "Predator Tank",
        speed: 120,
        squadSize: 1,
        texture: UnitName.F2_Guard,
        type: "vehicle",
        visionRadius: 2
    }],
    [UnitName.H1_Demon_Dragon, {
        attackRange: 1,
        building: Buildings.HANGAR,
        canAttack: true,
        canAttackAir: true,
        className: Unit,
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
        visionRadius: 2
    }],
    [UnitName.H2_Black_Dragon, {
        attackRange: 1,
        building: Buildings.HANGAR,
        canAttack: true,
        canAttackAir: false,
        className: Unit,
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
        rateOfFire: 2.25,
        reference: "Orca",
        speed: 110,
        squadSize: 1,
        texture: UnitName.H2_Black_Dragon,
        type: "aircraft",
        visionRadius: 2
    }],
    [UnitName.Harvester, {
        attackRange: 1,
        building: Buildings.CASTLE,
        canAttack: false,
        canAttackAir: false,
        className: Harvester,
        cost: 60,
        damageAgainstAir: 0,
        damageAgainstBase: 0,
        damageAgainstInfantry: 0,
        damageAgainstHarvester: 0,
        damageAgainstVehicle: 0,
        flying: false,
        goodAgainstInfantry: false,
        goodAgainstFactory: false,
        goodAgainstAir: false,
        health: 3400,
        limit: 2,
        rateOfFire: 1,
        reference: "Harvester",
        speed: 80,
        squadSize: 1,
        texture: UnitName.Harvester,
        type: "vehicle",
        visionRadius: 1
    }]
]);

