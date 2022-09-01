import type {BuildingStat} from "./Building";
import Unit from "./Unit";
import Harvester from "./Harvester";

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
    texture: string;
    type: "infantry" | "vehicle" | "aircraft"
    visionRadius: 1 | 2 | 3;
}


export const stats: Map<string, UnitStat> = new Map([
    ["fantasy8", {
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
        texture: "fantasy8",
        type: "infantry",
        visionRadius: 3
    }],
    ["female_archer", {
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
        texture: "female_archer",
        type: "infantry",
        visionRadius: 2
    }],
    ["robot5", {
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
        texture: "robot5",
        type: "vehicle",
        visionRadius: 2
    }],
    ["guard", {
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
        texture: "guard",
        type: "vehicle",
        visionRadius: 2
    }],
    ["demon_dragon", {
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
        texture: "demon_dragon",
        type: "aircraft",
        visionRadius: 2
    }],
    ["black_dragon", {
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
        texture: "black_dragon",
        type: "aircraft",
        visionRadius: 2
    }],
    ["male_engineer", {
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
        texture: "male_engineer",
        type: "vehicle",
        visionRadius: 1
    }]
]);

