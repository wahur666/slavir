import Phaser from "phaser";
import Player from "./Player.js";
import Pointer = Phaser.Input.Pointer;
import cursorGauntlet_grey from "../../assets/cursorGauntlet_grey.png";
import type GameTile from "../GameTile.js";
import type Systems from "../Systems.js";
import type Unit from "../../entities/Unit.js";
import type {UnitName} from "../../entities/UnitsStats.js";
import {unitStatMap} from "../../entities/units/UnitRegistry.js";
import Card from "../../entities/Card.js";
import {Images} from "../../scenes/PreloadScene.js";
import {defaultFont} from "../../helpers/utils.js";
import {buildingStat} from "../../entities/Building.js";
import BuildingCard from "../../entities/BuildingCard.js";
import CommandHub from "../command/CommandHub.js";
import PowerCard from "../../entities/PowerCard.js";
import {PowerName, powerOrder, powerStats} from "../power/PowerRules.js";
import {ION_CANNON_ICON, TURRET_ICON} from "../../entities/powers/PowerArt.js";

export default class HumanPlayer extends Player {
    resourceSpeedTicks: Phaser.GameObjects.Image[];
    private path: GameTile[];
    resourceText: Phaser.GameObjects.Text;
    resourceBarFg: Phaser.GameObjects.Rectangle;
    private cards: Card[];
    private unitTicks: Phaser.GameObjects.Image[];
    private buildCards: BuildingCard[];
    private powerCards: PowerCard[] = [];
    /** The power being aimed, null when not aiming */
    targetingPower: PowerName | null = null;
    private targetGraphics: Phaser.GameObjects.Graphics;

    constructor(index: number, systems: Systems) {
        super(index, systems);
        this.targetGraphics = this.gameScene.add.graphics().setDepth(5);
        this.setupInput();
        this.createCards();
        this.createPowerCards();
        this.setupResourceUI();
        this.setupUnitCapUI();
    }

    private setupInput() {
        this.gameScene.input.setDefaultCursor(`url(${cursorGauntlet_grey}), default`);
        this.gameScene.input.keyboard.on("keyup-F", () => {
            if (this.selectedUnit) {
                this.systems.commands.issue({kind: "disband", playerIndex: this.index, unitIds: [this.selectedUnit.id]});
            }
        });
        const hotkeys = powerOrder.map(power => {
            const event = `keyup-${powerStats[power].hotkey}`;
            const handler = () => this.toggleTargeting(power);
            this.gameScene.input.keyboard.on(event, handler);
            return {event, handler};
        });
        this.gameScene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            for (const {event, handler} of hotkeys) this.gameScene.input.keyboard.off(event, handler);
        });
        this.gameScene.input.on("pointermove", () => this.drawTargeting());
        this.gameScene.input.on("pointerdown", (ev: Pointer) => {
            if (!this.gameScene.canIssueCommands) return;
            if (this.targetingPower) {
                this.handleTargetingClick(ev);
                return;
            }
            if (ev.leftButtonDown()) {
                // this.deselectUnit();
                if (
                    ev.x < this.systems.scaledBaseOffset.x ||
                    ev.x > this.systems.width - this.systems.scaledBaseOffset.x ||
                    ev.y < this.systems.scaledBaseOffset.y ||
                    ev.y > this.systems.height - this.systems.scaledBaseOffset.y
                ) {
                    return;
                }
                // target tile, to check does have unit on it
                const target = this.systems.pointToTile(ev.x, ev.y);
                // unit on the target tile
                const unit = this.units.find(e => !e.immobile && this.systems.pointToTile(e.pos.x, e.pos.y) === target);
                if (unit) {
                    this.selectUnit(unit);
                } else {
                    if (target) {
                        this.gameScene.setCurrentTile(target);
                        if (this.selectedUnit) {
                            const unitIds = [this.selectedUnit.id];
                            const enemyUnit = this.visibleEnemyUnits.find(e => !e.markedForDeletion && e.gameTile() === target);
                            if (enemyUnit) {
                                this.systems.commands.issue({kind: "attack", playerIndex: this.index, unitIds, targetId: enemyUnit.id});
                            } else {
                                this.systems.commands.issue({kind: "move", playerIndex: this.index, unitIds, tile: CommandHub.tileRef(target)});
                            }
                        }
                    }
                }
            }
        });
    }

    protected createCards() {
        console.log(unitStatMap);
        this.buildCards = [...buildingStat.values()]
            .slice(1, 5)
            .map((e, i) => new BuildingCard(this.gameScene, this.systems.width / 2 - 345 + i * 180, this.systems.height / 2 + 245, this, e));
        this.cards = [...unitStatMap.values()].map(
            (e, index, arr) => new Card(this.gameScene, (this.systems.width - arr.length * 90 + 45) / 2 + index * 90, 600, e, this)
        );
    }

    /** Commander power cards, in the free column on the right of the map */
    protected createPowerCards() {
        const icons = {[PowerName.Turret]: TURRET_ICON, [PowerName.IonCannon]: ION_CANNON_ICON};
        this.powerCards = powerOrder.map(
            (power, i) => new PowerCard(this.gameScene, 1222, 270 + i * 140, powerStats[power], icons[power], this, () => this.toggleTargeting(power))
        );
    }

    /** Starts aiming the power, or stops if it is already being aimed */
    toggleTargeting(power: PowerName) {
        if (this.powerCards.length === 0 || !this.gameScene.canIssueCommands) return;
        if (this.targetingPower === power || !this.powers.isReady(power)) {
            this.cancelTargeting();
            return;
        }
        this.targetingPower = power;
        this.drawTargeting();
    }

    cancelTargeting(): boolean {
        if (!this.targetingPower) return false;
        this.targetingPower = null;
        this.targetGraphics.clear();
        return true;
    }

    /** Left click uses the aimed power on the clicked hex (if allowed there), right click cancels */
    private handleTargetingClick(ev: Pointer) {
        const power = this.targetingPower!;
        if (!ev.leftButtonDown()) {
            this.cancelTargeting();
            return;
        }
        const tile = this.systems.pointToTile(ev.x, ev.y);
        if (!tile) return;
        if (this.systems.commands.issue({kind: "power", playerIndex: this.index, power, tile: CommandHub.tileRef(tile)})) {
            this.cancelTargeting();
        }
    }

    /**
     * While aiming: the turret shows every hex it may go on; the hovered hex is outlined green where the power can be
     * used and red where not, the ion cannon also outlines the half-damage ring around it
     */
    private drawTargeting() {
        const graphics = this.targetGraphics;
        graphics.clear();
        const power = this.targetingPower;
        if (!power) return;
        if (!this.powers.isReady(power) || !this.gameScene.canIssueCommands) {
            this.cancelTargeting();
            return;
        }
        if (power === PowerName.Turret) {
            graphics.fillStyle(0xb8ffbf, 0.3);
            graphics.lineStyle(1.5, 0xe8ffe9, 0.7);
            for (const tile of this.visibleTiles) {
                if (!this.powers.canTarget(power, tile)) continue;
                const corners = this.hexCorners(tile);
                graphics.fillPoints(corners, true);
                graphics.strokePoints(corners, true);
            }
        }
        const pointer = this.gameScene.input.activePointer;
        const hovered = this.systems.pointToTile(pointer.x, pointer.y);
        if (!hovered) return;
        const valid = this.powers.canTarget(power, hovered);
        const color = valid ? (power === PowerName.Turret ? 0x7dff8a : 0x6fd3ff) : 0xff5050;
        if (power === PowerName.IonCannon && valid) {
            graphics.lineStyle(2, color, 0.6);
            for (const tile of this.systems.map.tiles) {
                if (tile.tile.index !== -1 && tile.distance(hovered) === 1) graphics.strokePoints(this.hexCorners(tile), true);
            }
            graphics.fillStyle(color, 0.25);
            graphics.fillPoints(this.hexCorners(hovered), true);
        }
        graphics.lineStyle(4, color, 1);
        graphics.strokePoints(this.hexCorners(hovered), true);
    }

    /** Scaled screen corners of a hex */
    private hexCorners(tile: GameTile): Phaser.Math.Vector2[] {
        return this.systems.map.layout.polygonCorners(tile.hex).map(corner => corner.add(this.systems.baseOffset).scale(this.systems.scaleFactor));
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
            fontSize: "20px",
        });
        this.resourceText.setDepth(12);
        const resourceBarBg = this.gameScene.add.rectangle(baseX + 70, baseY - 7, 65, 15, 0xffffff);
        resourceBarBg.setDepth(12).setOrigin(0, 0.5);

        this.resourceBarFg = this.gameScene.add.rectangle(baseX + 70, baseY - 7, 65, 15, 0x00ff00);
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
        this.resourceBarFg.setDisplaySize((65 * this.currentHarvestTime) / this.harvestTime, 15);
        this.cards.forEach(c => c.update());
        this.buildCards.forEach(c => c.update());
        this.powerCards.forEach(card => card.update(card.stat.name === this.targetingPower));
        this.drawTargeting();
    }

    updateTicks() {
        this.resourceSpeedTicks.forEach((item, index) => item.setTexture(index <= this.numberOfHarvesters ? Images.TICK_BROWN : Images.TICK_SILVER));
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
        const unitBg = this.gameScene.add.rectangle(baseX + 60, baseY, 72, 12, 0xffffff);
        unitBg.setDepth(12).setOrigin(0, 0.5);
        this.unitTicks = [];
        for (let i = 0; i < 6; i++) {
            const img = this.gameScene.add.image(baseX + 61 + 13 * i, baseY, Images.BUTTON_PRESSED_BEIGE);
            img.setDepth(13).setScale(12 / 45);
            img.setVisible(false);
            this.unitTicks.push(img);
        }
    }

    createUnit(e: UnitName): Unit | null {
        const unit = super.createUnit(e);
        this.updateUnitCounter();
        return unit;
    }

    protected onUnitRemoved(_unit: Unit): void {
        this.updateUnitCounter();
    }

    updateUnitCounter() {
        const unitsLength = this.army.length;
        this.unitTicks.forEach((e, i) => {
            e.setVisible(i < unitsLength);
            if (unitsLength <= 2) {
                e.tint = 0xffffff;
            } else if (unitsLength > 2 && unitsLength <= 4) {
                e.tint = 0xffa500;
            } else {
                e.tint = 0xff0000;
            }
        });
    }
}
