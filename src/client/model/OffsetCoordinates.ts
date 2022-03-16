import Hex from "./Hex";

const EVEN = 1;
const ODD = -1;

type Offset = typeof EVEN | typeof ODD

export default class OffsetCoordinate {

    constructor(public col: number, public row: number) {}

    /** Flat top */
    static qOffsetFromCube(hex: Hex, offset: Offset = ODD): OffsetCoordinate {
        const col = hex.q;
        const row = hex.r + ((hex.q + offset * (hex.q & 1)) / 2 | 0);
        return new OffsetCoordinate(col, row);
    }

    /** Flat top */
    static qOffsetToCube(h: OffsetCoordinate, offset: Offset = ODD): Hex {
        const q = h.col;
        const r = h.row - ((h.col + offset * (h.col & 1)) / 2 | 0);
        return new Hex(q, r);
    }

    /** Pointy top */
    static rOffsetFromCube(h: Hex, offset: Offset = ODD): OffsetCoordinate {
        const col = h.q + ((h.r + offset * (h.r & 1)) / 2 | 0);
        const row = h.r;
        return new OffsetCoordinate(col, row);
    }

    /** Pointy top */
    static rOffsetToCube(h: OffsetCoordinate, offset: Offset = ODD): Hex {
        const q = h.col - ((h.row + offset * (h.row & 1)) / 2 | 0);
        const r = h.row;
        return new Hex(q, r);
    }

}
