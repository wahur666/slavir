import Player from "./Player";
import Pointer = Phaser.Input.Pointer;
import cursorGauntlet_grey from "../../assets/cursorGauntlet_grey.png";
import type GameTile from "../GameTile";
import type Systems from "../Systems";
import type Unit from "../../entities/Unit";
import {UnitName, unitStatMap} from "../../entities/UnitsStats";
import Card from "../../entities/Card";
import {Images} from "../../scenes/PreloadScene";
import {defaultFont} from "../../helpers/utils";


export default class HumanPlayer extends Player {
    resourceSpeedTicks: Phaser.GameObjects.Image[];
    private path: GameTile[];
    resourceText: Phaser.GameObjects.Text;
    resourceBarFg: Phaser.GameObjects.Rectangle;
    private cards: Card[];
    private unitTicks: Phaser.GameObjects.Image[];

    constructor(index: number, systems: Systems) {
        super(index, systems);
        this.setupInput();
        this.createCards();
        this.setupResourceUI();
        this.setupUnitCapUI();
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
        this.cards = [...unitStatMap.values()].map((e, index, arr) =>
            new Card(this.gameScene, (this.systems.width - arr.length * 90 + 45) / 2 + index * 90, 600, e, this, () => this.createUnit(e.texture)));
    }


    setupResourceUI() {
        const baseX = 50;
        const baseY = 570;
        const panel = this.gameScene.add.image(baseX, baseY, Images.PANEL_BLUE);
        panel.setDepth(11).setScale(1.5, 0.6).setOrigin(0, 0.5);
        const crystal = this.gameScene.add.image(baseX + 20, baseY, Images.CRYSTAL);
        crystal.setDepth(12).setScale(0.5);
        this.resourceText = this.gameScene.add.text(baseX + 35, baseY - 17, `${this.resource}`, {
           fontFamily: defaultFont,
           fontSize: "20px"
        });
        this.resourceText.setDepth(12);
        const resourceBarBg = this.gameScene.add.rectangle(baseX + 70, baseY - 7, 65, 15, 0xFFFFFF);
        resourceBarBg.setDepth(12).setOrigin(0, 0.5);

        this.resourceBarFg = this.gameScene.add.rectangle(baseX + 70, baseY - 7, 65, 15, 0x00FF00);
        this.resourceBarFg.setDepth(12).setOrigin(0, 0.5);

        this.resourceSpeedTicks = [];
        for (let i = 0; i < 3; i++) {
            const item = this.gameScene.add.image(baseX + 75 + i * 15, baseY + 12, Images.TICK_SILVER);
            item.setDepth(12).setScale(0.5);
            if (i === 0) {
                item.setTexture(Images.TICK_BROWN);
            }
            this.resourceSpeedTicks.push(item);
        }
    }

    update(delta: number) {
        super.update(delta);
        this.resourceText.setText(`${this.resource}`);
        this.resourceBarFg.setDisplaySize(65 * this.currentHarvestTime / this.harvestTime, 15);
        this.cards.forEach(c => c.update());
    }

    updateTicks() {
        this.resourceSpeedTicks.forEach((item, index) =>
            item.setTexture(index <= this.numberOfHarvesters ? Images.TICK_BROWN : Images.TICK_SILVER));
    }

    increaseHarvesterCount() {
        super.increaseHarvesterCount();
        this.updateTicks();
    }

    decreaseHarvesterCount() {
        super.decreaseHarvesterCount();
        this.updateTicks();
    }

    setupUnitCapUI() {
        const baseX = 50;
        const baseY = 640;
        const panel = this.gameScene.add.image(baseX, baseY, Images.PANEL_BLUE);
        panel.setDepth(11).setScale(1.5, 0.6).setOrigin(0, 0.5);
        const image = this.gameScene.add.image(baseX + 30, baseY, Images.ICON_UNIT);
        image.setDepth(12);
        const unitBg = this.gameScene.add.rectangle(baseX + 60, baseY, 72, 12, 0xFFFFFF);
        unitBg.setDepth(12).setOrigin(0, 0.5);
        this.unitTicks = [];
        for (let i = 0; i < 6; i++) {
            const img = this.gameScene.add.image(baseX + 61 + 13 * i, baseY, Images.BUTTON_PRESSED_BEIGE);
            img.setDepth(13).setScale(12 / 45);
            img.setVisible(false);
            this.unitTicks.push(img);
        }
    }

    createUnit(e: UnitName) {
        super.createUnit(e);
        this.updateUnitCounter();
    }

    async freeHandler(unit: Unit): Promise<void> {
        const res = await super.freeHandler(unit);
        this.updateUnitCounter();
        return res;
    }

    updateUnitCounter() {
        const unitsLength = this.units.length;
        this.unitTicks.forEach((e, i) => {
            e.setVisible(i < unitsLength);
            if (unitsLength <= 2) {
                e.tint = 0xFFFFFF;
            } else if (unitsLength > 2 && unitsLength <= 4) {
                e.tint = 0xFFA500;
            } else {
                e.tint = 0xFF0000;
            }
        });
    }


}
