import {describe, expect, it} from "vitest";
import {damagePerMember} from "../../../src/entities/Squad.js";
import type {UnitStat} from "../../../src/entities/UnitsStats.js";
import {
    ION_CANNON_BLAST_TIME,
    ION_CANNON_RADIUS,
    PowerName,
    UNITS_PER_HEX,
    ionCannonDamage,
    ionCannonFalloff,
    powerStats,
    withinTurretForwardLimit,
} from "../../../src/model/power/PowerRules.js";

describe("Commander power rules", () => {
    it("prices the powers and gives both a 30 second cooldown", () => {
        expect(powerStats[PowerName.Turret]).toMatchObject({cost: 40, coolDown: 30_000});
        expect(powerStats[PowerName.IonCannon]).toMatchObject({cost: 130, coolDown: 30_000});
        expect(ION_CANNON_BLAST_TIME).toBe(3300);
    });

    it("falls off with the distance from the epicenter: 100% to 6 units, 70% at 12, 30% at 18, nothing beyond", () => {
        expect(ionCannonFalloff(0)).toBe(1);
        expect(ionCannonFalloff(6)).toBe(1);
        expect(ionCannonFalloff(9)).toBeCloseTo(0.85);
        expect(ionCannonFalloff(12)).toBeCloseTo(0.7);
        expect(ionCannonFalloff(15)).toBeCloseTo(0.5);
        expect(ionCannonFalloff(18)).toBeCloseTo(0.3);
        expect(ionCannonFalloff(18.1)).toBe(0);
        // One hex step is 12 units, so the blast reaches the outer edge of the ring around the target hex
        expect(ION_CANNON_RADIUS).toBe(1.5 * UNITS_PER_HEX);
    });

    it("deals the ion cannon's damage by target kind", () => {
        expect(ionCannonDamage("infantry", false, 0, 0)).toBe(6000);
        expect(ionCannonDamage("vehicle", false, 0, 0)).toBe(6000);
        expect(ionCannonDamage("aircraft", false, 0, 0)).toBe(6000);
        // Harvesters are vehicles, but take far less
        expect(ionCannonDamage("vehicle", true, 0, 0)).toBe(1000);
        expect(ionCannonDamage("vehicle", false, 12, 1)).toBe(4200);
        expect(ionCannonDamage("vehicle", true, 12, 1)).toBe(700);
        expect(ionCannonDamage("infantry", false, 24, 2)).toBe(0);
    });

    it("hits structures by hex: 4000 on the epicenter's hex, 2000 next to it", () => {
        expect(ionCannonDamage("structure", false, 0, 0)).toBe(4000);
        expect(ionCannonDamage("structure", false, 12, 1)).toBe(2000);
        expect(ionCannonDamage("structure", false, 24, 2)).toBe(0);
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
