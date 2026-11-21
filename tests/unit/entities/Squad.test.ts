import {describe, expect, it} from "vitest";
import {aliveMembers, damagePerMember, formationOffsets, maxSquadHealth, shootingMembers, squadVolleyStat} from "../../../src/entities/Squad.js";
import Volley from "../../../src/entities/Volley.js";
import type {UnitStat} from "../../../src/entities/UnitsStats.js";

const RIFLEMEN = {health: 130, squadSize: 5};
const MISSILE_SQUAD = {
    rateOfFire: 5,
    squadSize: 4,
    squadFire: "rotating" as const,
    volley: {shots: 1, initialChargeUp: 0.25, shotInterval: 0, reload: 5},
};

/** Runs a squad's weapon for `ms` in 10ms frames and returns [time, shooters] for every shot it takes */
function simulate(stat: typeof MISSILE_SQUAD | {rateOfFire: number; squadSize: number}, ms: number, alive: (t: number) => number) {
    const volley = new Volley(squadVolleyStat(stat));
    const shots: [number, number[]][] = [];
    for (let t = 0; t <= ms; t += 10) {
        if (volley.ready) {
            const shooters = shootingMembers(stat, alive(t), volley.ammo);
            volley.fire();
            if (shooters.length > 0) shots.push([t, shooters]);
        }
        volley.update(10, true);
    }
    return shots;
}

describe("Squad", () => {
    it("shares one health pool across the members", () => {
        expect(maxSquadHealth(RIFLEMEN)).toBe(650);
        expect(maxSquadHealth({health: 1210, squadSize: 1})).toBe(1210);
    });

    it("kills one member every time the pool crosses a member's health", () => {
        expect(aliveMembers(650, RIFLEMEN)).toBe(5);
        expect(aliveMembers(521, RIFLEMEN)).toBe(5);
        expect(aliveMembers(520, RIFLEMEN)).toBe(4);
        expect(aliveMembers(131, RIFLEMEN)).toBe(2);
        expect(aliveMembers(130, RIFLEMEN)).toBe(1);
        expect(aliveMembers(1, RIFLEMEN)).toBe(1);
        expect(aliveMembers(0, RIFLEMEN)).toBe(0);
        expect(aliveMembers(-40, RIFLEMEN)).toBe(0);
    });

    it("picks the per-member damage by the target's type", () => {
        const attacker = {damageAgainstAir: 1, damageAgainstInfantry: 2, damageAgainstVehicle: 3} as UnitStat;
        expect(damagePerMember(attacker, {type: "aircraft"})).toBe(1);
        expect(damagePerMember(attacker, {type: "infantry"})).toBe(2);
        expect(damagePerMember(attacker, {type: "vehicle"})).toBe(3);
    });

    it("puts the leader on the center and the rest in a ring", () => {
        const offsets = formationOffsets(5, 20);
        expect(offsets).toHaveLength(5);
        expect(offsets[0]).toEqual({x: 0, y: 0});
        expect(offsets[1]).toEqual({x: 0, y: -12});
        expect(formationOffsets(1, 20)).toEqual([{x: 0, y: 0}]);
    });

    it("fires every living member at once by default", () => {
        const riflemen = {rateOfFire: 1.72, squadSize: 5};
        expect(squadVolleyStat(riflemen)).toEqual({shots: 1, initialChargeUp: 0, shotInterval: 0, reload: 1.72});
        expect(simulate(riflemen, 3500, () => 3)).toEqual([
            [0, [0, 1, 2]],
            [1720, [0, 1, 2]],
            [3440, [0, 1, 2]],
        ]);
    });

    it("lets a rotating squad take turns, one member every reload / squadSize seconds", () => {
        expect(squadVolleyStat(MISSILE_SQUAD)).toEqual({shots: 4, initialChargeUp: 0.25, shotInterval: 1.25, reload: 5});
        expect(simulate(MISSILE_SQUAD, 10_000, () => 4)).toEqual([
            [250, [0]],
            [1500, [1]],
            [2750, [2]],
            [4000, [3]],
            [5250, [0]],
            [6500, [1]],
            [7750, [2]],
            [9000, [3]],
        ]);
    });

    it("skips the turn of a dead member without shooting", () => {
        // The last member dies at 3s, the third one at 6s
        expect(simulate(MISSILE_SQUAD, 10_000, t => (t < 3000 ? 4 : t < 6000 ? 3 : 2))).toEqual([
            [250, [0]],
            [1500, [1]],
            [2750, [2]],
            [5250, [0]],
            [6500, [1]],
        ]);
    });
});
