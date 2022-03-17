import Phaser from "phaser";
import {SHARED_CONFIG} from "../main";
import {SceneRegistry} from "./SceneRegistry";
import Vector2 = Phaser.Math.Vector2;
import Graphics = Phaser.GameObjects.Graphics;
import Pointer = Phaser.Input.Pointer;
import {Hex, Layout, OffsetCoordinate} from "../model/hexgrid";


export default class HexTestScene extends Phaser.Scene {
    private layout: Layout;
    private readonly hexes: Set<Hex>;
    private graphics: Graphics;

    constructor(private config: typeof SHARED_CONFIG) {
        super(SceneRegistry.HEX_TEST);
        this.hexes = new Set<Hex>();
        this.layout = new Layout(Layout.layoutPointy, new Vector2(50, 50), new Vector2(50, 50));
    }

    create() {
        this.graphics = this.add.graphics();
        const left = 0;
        const right = 6;
        const top = 0;
        const bottom = 4;

        this.input.on("pointerdown", (ev: Pointer) => {
            const hex = this.layout.pixelToHex(new Phaser.Geom.Point(ev.x, ev.y));
            console.log("pointed", OffsetCoordinate.rOffsetFromCube(hex), hex);
        });

        this.createPointyRectangle(top, bottom, left, right);
        this.graphics.clear();
        for (const hex of this.hexes) {
            this.drawHex(hex);
        }
        const src = new Hex(1, 1);
        const target = new Hex(2, 2);
        console.log("Distance", src.distance(target));
        console.log("Line", src.lineDraw(target));
    }

    private createPointyRectangle(top: number, bottom: number, left: number, right: number) {
        for (let r = top; r <= bottom; r++) {
            const rOffset = Math.floor(r / 2);
            for (let q = left - rOffset; q <= right - rOffset; q++) {
                this.hexes.add(new Hex(q, r));
            }
        }
    }

    drawHex(hex: Hex): void {
        const points = this.layout.polygonCorners(hex);
        this.graphics.lineStyle(3, 0xFF0000, 1);
        this.graphics.strokePoints(points, true, true);
    }

}


