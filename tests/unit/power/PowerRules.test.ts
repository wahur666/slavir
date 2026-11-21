import {describe, expect, it} from "vitest";
import {damagePerMember} from "../../../src/entities/Squad.js";
import type {UnitStat} from "../../../src/entities/UnitsStats.js";
import {ION_CANNON_BLAST_TIME, PowerName, ionCannonDamage, powerStats, withinTurretForwardLimit} from "../../../src/model/power/PowerRules.js";

describe("Commander power rules", () => {
    it("prices the powers and gives both a 30 second cooldown", () => {
        expect(powerStats[PowerName.Turret]).toMatchObject({cost: 40, coolDown: 30_000});
        expect(powerStats[PowerName.IonCannon]).toMatchObject({cost: 130, coolDown: 30_000});
        expect(ION_CANNON_BLAST_TIME).toBe(3300);
    });

    it("deals the ion cannon's damage by target kind, half of it on the adjacent hexes", () => {
        expect(ionCannonDamage("infantry", false, 0)).toBe(6000);
        expect(ionCannonDamage("vehicle", false, 0)).toBe(6000);
        expect(ionCannonDamage("aircraft", false, 0)).toBe(6000);
        expect(ionCannonDamage("structure", false, 0)).toBe(4000);
        // Harvesters are vehicles, but take far less
        expect(ionCannonDamage("vehicle", true, 0)).toBe(1000);
        expect(ionCannonDamage("vehicle", false, 1)).toBe(3000);
        expect(ionCannonDamage("vehicle", true, 1)).toBe(500);
        expect(ionCannonDamage("infantry", false, 2)).toBe(0);
    });

    it("allows turrets up to one and a half hexes past the middle of the map", () => {
        const width = 32;
        expect(withinTurretForwardLimit(-5 * width, width)).toBe(true);
        expect(withinTurretForwardLimit(0, width)).toBe(true);
        expect(withinTurretForwardLimit(1.5 * width, width)).toBe(true);
        expect(withinTurretForwardLimit(2 * width, width)).toBe(false);
    });

    it("lets units hit structures with their damage against structures", () => {
        const attacker = {damageAgainstBase: 830, damageAgainstVehicle: 100} as UnitStat;
        expect(damagePerMember(attacker, {type: "structure"})).toBe(830);
    });
});
