import type {BuildingStat} from "./Building.js";
import type Unit from "./Unit.js";
import type {VolleyStat} from "./Volley.js";

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
    building: BuildingStat["type"];
    attackRange: 1 | 2;
    canAttack: boolean;
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
    type: "infantry" | "vehicle" | "aircraft";
    visionRadius: 1 | 2 | 3;
    /** Burst fire; without it the unit fires one shot every `rateOfFire` seconds */
    volley?: VolleyStat;
    /**
     * How a squad's members use their weapon (`volley`/`rateOfFire` describes one member's weapon):
     * - "volley" (default): every living member fires at once
     * - "rotating": members take turns in a fixed order, one shot every `reload / squadSize` seconds; the slot of a
     *   dead member is skipped without a shot, so the squad fires slower as it loses members
     */
    squadFire?: "volley" | "rotating";
    /**
     * The unit shoots while driving: at its ordered target, or at any visible enemy in range when that is out of range.
     * Movement itself is unchanged, the unit still only ever stops on a hex center.
     */
    fireOnMove?: boolean;
}
