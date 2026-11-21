import {describe, expect, it} from "vitest";
import type Phaser from "phaser";
import {findObjectByProperty, getPropertyValue} from "../../../src/helpers/tilemap.helper";

type TiledObject = Phaser.Types.Tilemaps.TiledObject;

const tiledObject = (name: string, properties: {name: string; value: unknown}[]): TiledObject => ({name, properties}) as TiledObject;

const objects = [
    tiledObject("castle", [{name: "id", value: 0}]),
    tiledObject("barrack", [
        {name: "id", value: 1},
        {name: "owner", value: "player1"},
    ]),
    tiledObject("spawn", [{name: "id", value: 5}]),
];

describe("findObjectByProperty", () => {
    it("returns the first object whose property matches", () => {
        expect(findObjectByProperty(objects, "id", 5)?.name).toBe("spawn");
        expect(findObjectByProperty(objects, "owner", "player1")).toBe(objects[1]);
    });

    it("compares values strictly", () => {
        expect(findObjectByProperty(objects, "id", "1")).toBeUndefined();
    });

    it("returns undefined when nothing matches", () => {
        expect(findObjectByProperty(objects, "id", 99)).toBeUndefined();
        expect(findObjectByProperty([], "id", 0)).toBeUndefined();
    });
});

describe("getPropertyValue", () => {
    it("reads a named property", () => {
        expect(getPropertyValue<string>(objects[1], "owner")).toBe("player1");
        expect(getPropertyValue<number>(objects[1], "id")).toBe(1);
    });

    it("returns undefined for a missing property", () => {
        expect(getPropertyValue(objects[0], "owner")).toBeUndefined();
    });
});
