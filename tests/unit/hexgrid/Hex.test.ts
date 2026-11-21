import {describe, expect, it} from "vitest";
import {Hex} from "../../../src/model/hexgrid/Hex";

describe("Hex", () => {
    it("derives s so that q + r + s is zero", () => {
        const hex = new Hex(2, -3);
        expect(hex.s).toBe(1);
        expect(hex.q + hex.r + hex.s).toBe(0);
    });

    it("compares by value", () => {
        expect(new Hex(1, 2).equals(new Hex(1, 2))).toBe(true);
        expect(new Hex(1, 2).equals(new Hex(2, 1))).toBe(false);
    });

    it("adds, subtracts, and multiplies component-wise", () => {
        const a = new Hex(1, -3, 2);
        const b = new Hex(3, -7, 4);
        expect(a.add(b)).toEqual(new Hex(4, -10, 6));
        expect(a.sub(b)).toEqual(new Hex(-2, 4, -2));
        expect(a.mul(b)).toEqual(new Hex(3, 21, 8));
    });

    it("measures length and distance in hex steps", () => {
        expect(new Hex(0, 0).length()).toBe(0);
        expect(new Hex(3, -7, 4).length()).toBe(7);
        expect(new Hex(3, -7, 4).distance(new Hex(0, 0))).toBe(7);
        expect(new Hex(1, 0).distance(new Hex(-1, 0))).toBe(2);
    });

    it("has six unit-length neighbours around a hex", () => {
        const center = new Hex(2, -1);
        const neighbours = center.neighbours();
        expect(neighbours).toHaveLength(6);
        for (const neighbour of neighbours) {
            expect(neighbour.distance(center)).toBe(1);
        }
        expect(new Set(neighbours.map(h => `${h.q},${h.r}`)).size).toBe(6);
        expect(center.neighbor(0)).toEqual(new Hex(3, -1, -2));
    });

    it("rounds fractional coordinates to the nearest valid hex", () => {
        expect(new Hex(0.1, 0.8, -0.9).round()).toEqual(new Hex(0, 1, -1));
        expect(new Hex(1.6, -0.7, -0.9).round()).toEqual(new Hex(2, -1, -1));
        const rounded = new Hex(0.4, 0.4, -0.8).round();
        expect(rounded.q + rounded.r + rounded.s).toBe(0);
    });

    it("interpolates linearly between hexes", () => {
        const mid = new Hex(0, 0).lerp(new Hex(4, -2), 0.5);
        expect(mid.q).toBeCloseTo(2);
        expect(mid.r).toBeCloseTo(-1);
        expect(mid.s).toBeCloseTo(-1);
    });

    it("draws a contiguous line including both endpoints", () => {
        const start = new Hex(0, 0);
        const end = new Hex(3, -1);
        const line = start.lineDraw(end);
        expect(line[0]).toEqual(start);
        expect(line.some(h => h.equals(end))).toBe(true);
        expect(line.length).toBeGreaterThanOrEqual(start.distance(end) + 1);
        for (const hex of line) {
            expect(hex.distance(start) + hex.distance(end)).toBeLessThanOrEqual(start.distance(end) + 1);
        }
    });

    it("draws a single-hex line to itself", () => {
        const hex = new Hex(1, 1);
        expect(hex.lineDraw(hex)).toEqual([hex]);
    });
});
