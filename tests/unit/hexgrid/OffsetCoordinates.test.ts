import {describe, expect, it} from "vitest";
import {Hex} from "../../../src/model/hexgrid/Hex.js";
import {OffsetCoordinate} from "../../../src/model/hexgrid/OffsetCoordinates.js";

const hexes = [new Hex(0, 0), new Hex(1, 0), new Hex(1, -1), new Hex(-2, 3), new Hex(3, -5), new Hex(4, 2)];

describe("OffsetCoordinate", () => {
    it("converts flat-top cube coordinates to odd-q offsets", () => {
        expect(OffsetCoordinate.qOffsetFromCube(new Hex(1, 0)).toArray()).toEqual([1, 0]);
        expect(OffsetCoordinate.qOffsetFromCube(new Hex(2, -1)).toArray()).toEqual([2, 0]);
        expect(OffsetCoordinate.qOffsetFromCube(new Hex(3, -1)).toArray()).toEqual([3, 0]);
    });

    it("converts pointy-top cube coordinates to odd-r offsets", () => {
        expect(OffsetCoordinate.rOffsetFromCube(new Hex(0, 1)).toArray()).toEqual([0, 1]);
        expect(OffsetCoordinate.rOffsetFromCube(new Hex(-1, 2)).toArray()).toEqual([0, 2]);
    });

    it.each(hexes)("round-trips flat-top offsets for %o", hex => {
        expect(OffsetCoordinate.qOffsetToCube(OffsetCoordinate.qOffsetFromCube(hex)).equals(hex)).toBe(true);
    });

    it.each(hexes)("round-trips pointy-top offsets for %o", hex => {
        expect(OffsetCoordinate.rOffsetToCube(OffsetCoordinate.rOffsetFromCube(hex)).equals(hex)).toBe(true);
    });

    it("round-trips with the even offset variant", () => {
        for (const hex of hexes) {
            expect(OffsetCoordinate.qOffsetToCube(OffsetCoordinate.qOffsetFromCube(hex, 1), 1)).toEqual(hex);
            expect(OffsetCoordinate.rOffsetToCube(OffsetCoordinate.rOffsetFromCube(hex, 1), 1)).toEqual(hex);
        }
    });
});
