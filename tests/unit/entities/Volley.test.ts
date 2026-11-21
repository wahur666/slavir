import {describe, expect, it} from "vitest";
import Volley, {volleyStatOf} from "../../../src/entities/Volley.js";

const ORCA = {shots: 4, initialChargeUp: 0.1, shotInterval: 0.2, reload: 9};

/** Runs the volley for `ms` in `step` ms frames, firing whenever ready, and returns the fire times */
function simulate(volley: Volley, ms: number, step = 10, engaged: (t: number) => boolean = () => true): number[] {
    const shots: number[] = [];
    for (let t = 0; t <= ms; t += step) {
        if (volley.ready && engaged(t)) {
            volley.fire();
            shots.push(t);
        }
        volley.update(step, engaged(t));
    }
    return shots;
}

describe("Volley", () => {
    it("fires 4 shots after the wind-up, 0.2s apart, then waits for the 9s reload", () => {
        const shots = simulate(new Volley(ORCA), 20_000);
        expect(shots).toEqual([100, 300, 500, 700, 9100, 9300, 9500, 9700, 18100, 18300, 18500, 18700]);
    });

    it("starts the reload with the first shot and refills the whole magazine", () => {
        const volley = new Volley(ORCA);
        volley.update(100, true);
        volley.fire();
        expect(volley.ammo).toBe(3);
        expect(volley.reloadLeft).toBe(9000);
        volley.update(9000, false);
        expect(volley.ammo).toBe(4);
        expect(volley.reloadLeft).toBe(0);
    });

    it("restarts the wind-up when the unit stops being engaged, ammo and reload carry on", () => {
        const volley = new Volley(ORCA);
        // Engaged for 0-399ms (shots at 100 and 300), moving 400-999ms, engaged again from 1000ms
        const shots = simulate(volley, 2000, 10, t => t < 400 || t >= 1000);
        expect(shots).toEqual([100, 300, 1100, 1300]);
        expect(volley.ammo).toBe(0);
    });

    it("never fires before the wind-up is complete", () => {
        const volley = new Volley(ORCA);
        volley.update(90, true);
        expect(volley.ready).toBe(false);
        volley.update(10, true);
        expect(volley.ready).toBe(true);
    });

    it("gives single-shot units their initial charge up", () => {
        const stat = volleyStatOf({rateOfFire: 5, initialChargeUp: 0.3});
        expect(stat).toEqual({shots: 1, initialChargeUp: 0.3, shotInterval: 0, reload: 5});
        const volley = new Volley(stat);
        volley.update(290, true);
        expect(volley.ready).toBe(false);
        volley.update(10, true);
        expect(volley.ready).toBe(true);
    });

    it("prefers the volley's own charge up", () => {
        const volley = {shots: 4, initialChargeUp: 0.1, shotInterval: 0.2, reload: 9};
        expect(volleyStatOf({rateOfFire: 9, initialChargeUp: 0.5, volley})).toBe(volley);
    });

    it("behaves like a plain rate-of-fire cooldown for single-shot units", () => {
        const stat = volleyStatOf({rateOfFire: 1.72});
        expect(stat).toEqual({shots: 1, initialChargeUp: 0, shotInterval: 0, reload: 1.72});
        const volley = new Volley(stat);
        expect(volley.ready).toBe(true);
        volley.fire();
        expect(volley.coolDown).toBe(1720);
        volley.update(1719, true);
        expect(volley.ready).toBe(false);
        volley.update(1, true);
        expect(volley.ready).toBe(true);
    });

    it("averages 4 shots per 9s for the Orca", () => {
        expect(simulate(new Volley(ORCA), 90_000 - 1)).toHaveLength(40);
    });
});
