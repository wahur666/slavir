import Player from "./Player";
import Pointer = Phaser.Input.Pointer;
import cursorGauntlet_grey from "../../assets/cursorGauntlet_grey.png";
import type GameTile from "../GameTile";
import type Systems from "../Systems";
import type Unit from "../../entities/Unit";
import {unitStatMap} from "../../entities/UnitsStats";
import Card from "../../entities/Card";


export default class HumanPlayer extends Player {
    private path: GameTile[];

    constructor(index: number, systems: Systems) {
        super(index, systems);
        this.setupInput();
        this.createCards();
    }

    private setupInput() {
        this.gameScene.input.setDefaultCursor(`url(${cursorGauntlet_grey}), default`);
        this.gameScene.input.keyboard.on("keyup-F", () => {
            if (this.selectedUnit) {
                this.freeHandler(this.selectedUnit);
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
                const target = this.systems.pointToTile(ev.x, ev.y);
                // unit on the target tile
                const unit = this.units.find(e => this.systems.pointToTile(e.pos.x, e.pos.y) === target);
                if (unit) {
                    if (target) {
                        this.gameScene.setCurrentTile(target);
                        if (this.selectedUnit) {
                            if (unit.gameTile().distance(this.selectedUnit.gameTile()) <= this.selectedUnit.stat.attackRange
                                && this.systems.navigation.checkBlockade(this.selectedUnit.gameTile(), unit.gameTile())) {
                                this.selectedUnit?.setNav([], unit);
                            } else {
                                const start = this.systems.pointToTile(this.selectedUnit.pos.x, this.selectedUnit.pos.y);
                                if (start) {
                                    this.path = this.systems.navigation.findPath(start, target, this.selectedUnit.pathfinding, this.selectedUnit.stat.attackRange);
                                    this.selectedUnit.setNav(this.path.map(e => this.systems.navigation.calculateNavPoint(e)), unit);
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
                const target = this.systems.pointToTile(ev.x, ev.y);
                const unit = this.units.find(e => this.systems.pointToTile(e.pos.x, e.pos.y) === target);
                if (unit) {
                    this.selectUnit(unit);
                } else {
                    if (target) {
                        this.gameScene.setCurrentTile(target);
                        if (this.selectedUnit) {
                            const start = this.systems.pointToTile(this.selectedUnit.pos.x, this.selectedUnit.pos.y);
                            if (start) {
                                this.path = this.systems.navigation.findPath(start, target, this.selectedUnit.pathfinding);
                                if (this.path.length > 0) {
                                    this.selectedUnit.setNav(this.path.map(e => this.systems.map.getCenter(e)
                                        .add(this.systems.baseOffset).scale(this.gameScene.scaleFactor)));
                                }
                            }
                        }
                    }
                }
            }
        });
    }



    private createCards() {
        console.log(unitStatMap);
        const cards = [...unitStatMap.values()].map((e, index, arr) =>
            new Card(this.gameScene, (this.systems.width - arr.length * 90 + 45) / 2 + index * 90, 600, e, () => this.createUnit(e.texture)));
    }

}
