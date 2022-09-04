import type {BuildingStat} from "./Building";
import Unit from "./Unit";
import Harvester from "./Harvester";

export const enum UnitName {
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
    damageAgainstVehicle: number;
    flying: boolean;
    health: number;
    limit: number;
    rateOfFire: number;
    speed: number;
    texture: UnitName;
    type: "infantry" | "vehicle" | "aircraft"
    visionRadius: 1 | 2 | 3;
}


export const stats: Map<UnitName, UnitStat> = new Map([
    [UnitName.B1_Fantasy8, {
        attackRange: 1,
        building: "barrack",
        canAttack: true,
        canAttackAir: false,
        className: Unit,
        cost: 20,
        damageAgainstAir: 0,
        damageAgainstBase: 10,
        damageAgainstInfantry: 20,
        damageAgainstVehicle: 15,
        flying: false,
        health: 150,
        limit: -1,
        rateOfFire: 0.8,
        speed: 120,
        texture: UnitName.B1_Fantasy8,
        type: "infantry",
        visionRadius: 3
    }],
    [UnitName.B2_Female_Archer, {
        attackRange: 2,
        building: "barrack",
        canAttack: true,
        canAttackAir: true,
        className: Unit,
        cost: 30,
        damageAgainstAir: 17,
        damageAgainstBase: 8,
        damageAgainstInfantry: 15,
        damageAgainstVehicle: 12,
        flying: false,
        health: 120,
        limit: -1,
        rateOfFire: 1,
        speed: 100,
        texture: UnitName.B2_Female_Archer,
        type: "infantry",
        visionRadius: 2
    }],
    [UnitName.F1_Robot5, {
        attackRange: 1,
        building: "factory",
        canAttack: true,
        canAttackAir: true,
        className: Unit,
        cost: 40,
        damageAgainstAir: 22,
        damageAgainstBase: 10,
        damageAgainstInfantry: 25,
        damageAgainstVehicle: 15,
        flying: false,
        health: 200,
        limit: -1,
        rateOfFire: 0.8,
        speed: 120,
        texture: UnitName.F1_Robot5,
        type: "vehicle",
        visionRadius: 2
    }],
    [UnitName.F2_Guard, {
        attackRange: 1,
        building: "factory",
        canAttack: true,
        canAttackAir: false,
        className: Unit,
        cost: 60,
        damageAgainstAir: 0,
        damageAgainstBase: 20,
        damageAgainstInfantry: 15,
        damageAgainstVehicle: 30,
        flying: false,
        health: 250,
        limit: -1,
        rateOfFire: 1.2,
        speed: 120,
        texture: UnitName.F2_Guard,
        type: "vehicle",
        visionRadius: 2
    }],
    [UnitName.H1_Demon_Dragon, {
        attackRange: 1,
        building: "hangar",
        canAttack: true,
        canAttackAir: true,
        className: Unit,
        cost: 40,
        damageAgainstAir: 25,
        damageAgainstBase: 12,
        damageAgainstInfantry: 30,
        damageAgainstVehicle: 20,
        flying: true,
        health: 150,
        limit: -1,
        rateOfFire: 1.4,
        speed: 140,
        texture: UnitName.H1_Demon_Dragon,
        type: "aircraft",
        visionRadius: 2
    }],
    [UnitName.H2_Black_Dragon, {
        attackRange: 1,
        building: "hangar",
        canAttack: true,
        canAttackAir: false,
        className: Unit,
        cost: 60,
        damageAgainstAir: 0,
        damageAgainstBase: 25,
        damageAgainstVehicle: 30,
        damageAgainstInfantry: 14,
        flying: true,
        health: 250,
        limit: -1,
        rateOfFire: 1.3,
        speed: 110,
        texture: UnitName.H2_Black_Dragon,
        type: "aircraft",
        visionRadius: 2
    }],
    [UnitName.Harvester, {
        attackRange: 1,
        building: "castle",
        canAttack: false,
        canAttackAir: false,
        className: Harvester,
        cost: 60,
        damageAgainstAir: 0,
        damageAgainstBase: 0,
        damageAgainstInfantry: 0,
        damageAgainstVehicle: 0,
        flying: false,
        health: 300,
        limit: 2,
        rateOfFire: 1,
        speed: 80,
        texture: UnitName.Harvester,
        type: "vehicle",
        visionRadius: 1
    }]
]);

