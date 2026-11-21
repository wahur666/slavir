import {describe, expect, it} from "vitest";
import {Hex} from "../../../src/model/hexgrid/Hex.js";
import type GameTile from "../../../src/model/GameTile.js";
import {canEnter, canPark, freeTilesNear, isFreeEndTile, type TileOccupant} from "../../../src/model/navigation/Occupancy.js";

/** Tiles are only compared by identity and distance */
function tile(q: number, r: number): GameTile {
    const hex = new Hex(q, r);
    return {hex, distance: (other: GameTile) => hex.distance(other.hex)} as unknown as GameTile;
}

const P1 = {name: "p1"};
const P2 = {name: "p2"};

function unit(
    player: object,
    claimedTile: GameTile,
    options: Partial<{flying: boolean; parked: boolean; destination: GameTile | null}> = {}
): TileOccupant {
    return {
        player,
        stat: {flying: options.flying ?? false},
        claimedTile,
        destination: options.destination ?? null,
        parked: options.parked ?? true,
        markedForDeletion: false,
    };
}

describe("Occupancy", () => {
    const a = tile(0, 0);
    const b = tile(1, 0);
    const c = tile(2, 0);

    it("blocks hexes held by enemies of the same layer", () => {
        const mover = unit(P1, a, {parked: false});
        expect(canEnter(mover, b, [mover, unit(P2, b)])).toBe(false);
        expect(canEnter(mover, b, [mover, unit(P2, b, {parked: false})])).toBe(false);
    });

    it("lets units walk through friendly units", () => {
        const mover = unit(P1, a, {parked: false});
        expect(canEnter(mover, b, [mover, unit(P1, b)])).toBe(true);
    });

    it("lets units pass over and under the other layer", () => {
        const mover = unit(P1, a, {parked: false});
        expect(canEnter(mover, b, [mover, unit(P2, b, {flying: true})])).toBe(true);
        expect(canEnter(mover, b, [mover, unit(P1, b, {flying: true})])).toBe(true);
        // A flying unit only passing by does not hold the hex for ground units
        expect(canPark(mover, b, [mover, unit(P2, b, {flying: true, parked: false})])).toBe(true);
    });

    it("never parks a ground and a flying unit on one hex", () => {
        const mover = unit(P1, a, {parked: false});
        expect(canPark(mover, b, [mover, unit(P2, b, {flying: true})])).toBe(false);
        expect(canPark(mover, b, [mover, unit(P1, b, {flying: true})])).toBe(false);
        const flyer = unit(P1, a, {flying: true, parked: false});
        expect(canPark(flyer, b, [flyer, unit(P2, b)])).toBe(false);
    });

    it("never picks the end hex of a friendly unit of the other layer", () => {
        const flyer = unit(P1, a, {flying: true, parked: false});
        const friend = unit(P1, c, {parked: false, destination: b});
        expect(isFreeEndTile(flyer, b, [flyer, friend])).toBe(false);
    });

    it("ignores dying units", () => {
        const mover = unit(P1, a, {parked: false});
        const dying = {...unit(P2, b), markedForDeletion: true};
        expect(canEnter(mover, b, [mover, dying])).toBe(true);
    });

    it("never parks two units on one hex", () => {
        const mover = unit(P1, a, {parked: false});
        expect(canPark(mover, b, [mover, unit(P1, b)])).toBe(false);
        // A friend only passing through does not hold the hex
        expect(canPark(mover, b, [mover, unit(P1, b, {parked: false})])).toBe(true);
    });

    it("never picks the end hex of a friendly unit", () => {
        const mover = unit(P1, a, {parked: false});
        const friend = unit(P1, c, {parked: false, destination: b});
        expect(isFreeEndTile(mover, b, [mover, friend])).toBe(false);
        expect(canPark(mover, b, [mover, friend])).toBe(true);
    });

    it("finds the closest free hex, closest to the unit on a tie", () => {
        const tiles = [tile(0, 0), tile(1, 0), tile(2, 0), tile(1, -1), tile(1, 1), tile(3, 0)];
        const [origin, east] = [tiles[1], tiles[2]];
        const mover = unit(P1, tiles[5], {parked: false});
        const occupants = [mover, unit(P1, origin)];
        const free = freeTilesNear(mover, origin, tiles, occupants);
        expect(free[0]).toBe(east);
        expect(free).not.toContain(origin);
    });

    it("respects the extra condition and the radius", () => {
        const tiles = [tile(0, 0), tile(1, 0), tile(5, 0)];
        const mover = unit(P1, tiles[0]);
        expect(freeTilesNear(mover, tiles[0], tiles, [mover], 2, t => t !== tiles[0])).toEqual([tiles[1]]);
    });
});
