import Phaser from "phaser";
import {Hex} from "./Hex";
import Vector2 = Phaser.Math.Vector2;

class Orientation {
    constructor(public f0: number,
                public f1: number,
                public f2: number,
                public f3: number,
                public b0: number,
                public b1: number,
                public b2: number,
                public b3: number,
                public startAngle) {
    }
}

const sqrt3 = Math.sqrt(3);

export class Layout {

    static layoutPointy = new Orientation(sqrt3, sqrt3 / 2, 0, 3/2, sqrt3/3, -1/3, 0, 2/3, 0.5);
    static layoutFlat = new Orientation(3/2, 0, sqrt3/2, sqrt3, 2/3, 0, -1/3, sqrt3/3, 0);

    constructor(public orientation: Orientation,
                public size: Phaser.Math.Vector2,
                public origin: Phaser.Math.Vector2) {
    }

    /** Returns the center of the Hex in pixels */
    hexToPixel(hex: Hex): Vector2 {
        const M = this.orientation;
        const x = (M.f0 * hex.q + M.f1 * hex.r) * this.size.x;
        const y = (M.f2 * hex.q + M.f3 * hex.r) * this.size.y;
        return new Vector2(x + this.origin.x, y + this.origin.y);
    }

    /** Returns the corresponding Hex */
    pixelToHex(p: Vector2): Hex {
        const M = this.orientation;
        const pt = new Vector2((p.x - this.origin.x) / this.size.x, (p.y - this.origin.y) / this.size.y);
        const q = M.b0 * pt.x + M.b1 * pt.y;
        const r = M.b2 * pt.x + M.b3 * pt.y;
        return new Hex(q, r, -q-r).round();
    }

    private hexCornerOffset(corner: number): Vector2 {
        const angle = 2 * Math.PI * (this.orientation.startAngle + corner) / 6;
        return new Vector2(this.size.x * Math.cos(angle), this.size.y * Math.sin(angle));
    }

    private hexCornerOffset2(corner: number, scale: number): Vector2 {
        const angle = 2 * Math.PI * (this.orientation.startAngle + corner) / 6;
        return new Vector2(this.size.x * scale * Math.cos(angle), this.size.y * scale * Math.sin(angle));
    }

    /** Returns the polygon corners */
    polygonCorners(hex: Hex): Vector2[] {
        const corners: Vector2[] = [];
        const center = this.hexToPixel(hex);
        for (let i = 0; i < 6; i++) {
          const offset = this.hexCornerOffset(i);
          corners.push(new Vector2(center.x + offset.x, center.y + offset.y));
        }
        return corners;
    }

    /** Returns the polygon corners with scale */
    polygonCorners2(hex: Hex, scale: number): Vector2[] {
        const corners: Vector2[] = [];
        const center = this.hexToPixel(hex);
        for (let i = 0; i < 6; i++) {
            const offset = this.hexCornerOffset2(i, scale);
            corners.push(new Vector2(center.x + offset.x | 0, center.y + offset.y | 0));
        }
        return [...corners, corners[0]];
    }

}


