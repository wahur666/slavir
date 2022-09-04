import Player from "./Player";
import Pointer = Phaser.Input.Pointer;
import cursorGauntlet_grey from "../../assets/cursorGauntlet_grey.png";
import type GameTile from "../GameTile";
import type Systems from "../Systems";


export default class HumanPlayer extends Player {
    private path: GameTile[];

    constructor(index: number, systems: Systems) {
        super(index, systems);
        this.setupInput();
    }

    private setupInput() {
        this.gameScene.input.setDefaultCursor(`url(${cursorGauntlet_grey}), default`);
        this.gameScene.input.keyboard.on("keyup-F", () => {
            if (this.gameScene.selectedUnit) {
                this.gameScene.freeHandler(this.gameScene.selectedUnit);
            }
        });
        this.gameScene.input.on("pointerdown", (ev: Pointer) => {
            if (ev.rightButtonDown()) {
                // this.deselectUnit();
                if (ev.x < this.systems.scaledBaseOffset.x || ev.x > this.systems.width - this.systems.scaledBaseOffset.x
                    || ev.y < this.systems.scaledBaseOffset.y || ev.y > this.systems.height - this.systems.scaledBaseOffset.y) {
                    return;
                }
                // target tile, to check does have unit on it
                const target = this.gameScene.pointToTile(ev.x, ev.y);
                // unit on the target tile
                const unit = this.units.find(e => this.gameScene.pointToTile(e.pos.x, e.pos.y) === target);
                if (unit) {
                    if (target) {
                        this.gameScene.setCurrentTile(target);
                        if (this.gameScene.selectedUnit) {
                            if (unit.gameTile().distance(this.gameScene.selectedUnit.gameTile()) <= this.gameScene.selectedUnit.stat.attackRange
                                && this.systems.navigation.checkBlockade(this.gameScene.selectedUnit.gameTile(), unit.gameTile())) {
                                this.gameScene.selectedUnit?.setNav([], unit);
                            } else {
                                const start = this.gameScene.pointToTile(this.gameScene.selectedUnit.pos.x, this.gameScene.selectedUnit.pos.y);
                                if (start) {
                                    this.path = this.systems.navigation.findPath(start, target, this.gameScene.selectedUnit.pathfinding, this.gameScene.selectedUnit.stat.attackRange);
                                    this.gameScene.selectedUnit.setNav(this.path.map(e => this.systems.navigation.calculateNavPoint(e)), unit);
                                }
                            }
                        }
                    }
                }
            }
            if (ev.leftButtonDown()) {
                if (ev.x < this.systems.scaledBaseOffset.x || ev.x > this.systems.width - this.systems.scaledBaseOffset.x
                    || ev.y < this.systems.scaledBaseOffset.y || ev.y > this.systems.height - this.systems.scaledBaseOffset.y) {
                    return;
                }
                const target = this.gameScene.pointToTile(ev.x, ev.y);
                const unit = this.units.find(e => this.gameScene.pointToTile(e.pos.x, e.pos.y) === target);
                if (unit) {
                    this.gameScene.selectUnit(unit);
                } else {
                    if (target) {
                        this.gameScene.setCurrentTile(target);
                        if (this.gameScene.selectedUnit) {
                            const start = this.gameScene.pointToTile(this.gameScene.selectedUnit.pos.x, this.gameScene.selectedUnit.pos.y);
                            if (start) {
                                this.path = this.systems.navigation.findPath(start, target, this.gameScene.selectedUnit.pathfinding);
                                if (this.path.length > 0) {
                                    this.gameScene.selectedUnit.setNav(this.path.map(e => this.systems.map.getCenter(e)
                                        .add(this.systems.baseOffset).scale(this.gameScene.scaleFactor)));
                                }
                            }
                        }
                    }
                }
            }
        });
    }


}
