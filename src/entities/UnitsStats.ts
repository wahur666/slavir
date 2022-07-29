export interface UnitStat {
    armored: boolean;
    building: "castle" | "barrack" | "factory" | "hangar"
    attackRange: 1 | 2;
    canAttack: boolean,
    canAttackAir: boolean;
    cost: number;
    damageAgainstHeavyArmor: number;
    damageAgainstLightArmor: number;
    flying: boolean;
    health: number;
    limit: number;
    rateOfFire: number;
    speed: number;
    texture: string;
    visionRadius: 1 | 2 | 3;
}


export const stats: Map<string, UnitStat> = new Map([
    ["fantasy8", {
        armored: true,
        attackRange: 1,
        building: "barrack",
        canAttack: true,
        canAttackAir: false,
        cost: 20,
        damageAgainstHeavyArmor: 15,
        damageAgainstLightArmor: 20,
        flying: false,
        health: 150,
        limit: -1,
        rateOfFire: 0.6,
        speed: 120,
        texture: "fantasy8",
        visionRadius: 3
    }],
    ["female_archer", {
        armored: false,
        attackRange: 2,
        building: "barrack",
        canAttack: true,
        canAttackAir: true,
        cost: 30,
        damageAgainstHeavyArmor: 12,
        damageAgainstLightArmor: 15,
        flying: false,
        health: 120,
        limit: -1,
        rateOfFire: 1,
        speed: 100,
        texture: "female_archer",
        visionRadius: 2
    }],
    ["robot5", {
        armored: false,
        attackRange: 1,
        building: "factory",
        canAttack: true,
        canAttackAir: true,
        cost: 40,
        damageAgainstHeavyArmor: 15,
        damageAgainstLightArmor: 25,
        flying: false,
        health: 200,
        limit: -1,
        rateOfFire: 0.8,
        speed: 120,
        texture: "robot5",
        visionRadius: 2
    }],
    ["guard", {
        armored: true,
        attackRange: 1,
        building: "factory",
        canAttack: true,
        canAttackAir: false,
        cost: 60,
        damageAgainstHeavyArmor: 30,
        damageAgainstLightArmor: 15,
        flying: false,
        health: 250,
        limit: -1,
        rateOfFire: 1.2,
        speed: 120,
        texture: "guard",
        visionRadius: 2
    }],
    ["demon_dragon", {
        armored: false,
        attackRange: 1,
        building: "hangar",
        canAttack: true,
        canAttackAir: true,
        cost: 40,
        damageAgainstHeavyArmor: 20,
        damageAgainstLightArmor: 30,
        flying: true,
        health: 150,
        limit: -1,
        rateOfFire: 1.4,
        speed: 140,
        texture: "demon_dragon",
        visionRadius: 2
    }],
    ["black_dragon", {
        armored: true,
        attackRange: 1,
        building: "hangar",
        canAttack: true,
        canAttackAir: false,
        cost: 60,
        damageAgainstHeavyArmor: 30,
        damageAgainstLightArmor: 14,
        flying: true,
        health: 250,
        limit: -1,
        rateOfFire: 1.3,
        speed: 110,
        texture: "black_dragon",
        visionRadius: 2
    }],
    ["male_engineer", {
        armored: true,
        attackRange: 1,
        building: "castle",
        canAttack: false,
        canAttackAir: false,
        cost: 80,
        damageAgainstHeavyArmor: 0,
        damageAgainstLightArmor: 0,
        flying: false,
        health: 400,
        limit: 2,
        rateOfFire: 1,
        speed: 80,
        texture: "male_engineer",
        visionRadius: 1
    }]
]);

