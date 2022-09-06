import Phaser from "phaser";
import Rectangle = Phaser.Geom.Rectangle;
import type {UnitStat} from "./UnitsStats";
import {Images} from "../scenes/PreloadScene";
import {defaultFont} from "../helpers/utils";

export default class Card extends Phaser.GameObjects.Sprite {

    constructor(scene: Phaser.Scene, x: number, y: number, unitStat: UnitStat, private onCLick: () => void) {
        super(scene, x, y, unitStat.texture, 1);
        scene.add.existing(this);
        this.setDepth(2);
        this.setCrop(28, 0, 72, 100);
        this.setOrigin(0.54, 0.58);
        this.setDepth(11);
        const backdrop = this.scene.add.image(x - 6, y + 5, Images.PANEL_BLUE).setScale(0.8, 1.4).setDepth(10);
        backdrop.setInteractive();
        backdrop.on("pointerdown", (ev) => this.onCLick());
        const costText = this.scene.add.text(x - 6, y + 25, `${unitStat.cost}`, {
            fontFamily: defaultFont,
            fontSize: "18px"
        });
        costText.setDepth(12);
        const crystal = this.scene.add.image(x - 20, y + 38, Images.CRYSTAL);
        crystal.setDepth(12).setScale(0.5);

        const wizardIcon = this.scene.add.image(x - 25, y + 58, Images.ICON_WIZARD);
        wizardIcon.setDepth(12).setScale(0.5);
        if (unitStat.canAttack) {
            if (unitStat.goodAgainstInfantry) {
                wizardIcon.tint = 0x00FF00;
            }
        } else {
            wizardIcon.tint = 0xFF0000;
        }

        const armorIcon = this.scene.add.image(x - 5, y + 58, Images.ICON_ARMOR);
        armorIcon.setDepth(12).setScale(0.5);
        if (unitStat.canAttack) {
            if (unitStat.goodAgainstFactory) {
                armorIcon.tint = 0x00FF00;
            }
        } else {
            armorIcon.tint = 0xFF0000;
        }

        const wingIcon = this.scene.add.image(x + 15, y + 58, Images.ICON_WING);
        wingIcon.setDepth(12).setScale(0.5);
        if (unitStat.canAttack && unitStat.canAttackAir) {
            if (unitStat.goodAgainstAir) {
                wingIcon.tint = 0x00FF00;
            }
        } else {
            wingIcon.tint = 0xFF0000;
        }
    }



}
