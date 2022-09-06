import Phaser from "phaser";
import type {UnitStat} from "./UnitsStats";
import {Images} from "../scenes/PreloadScene";
import {defaultFont} from "../helpers/utils";
import type Player from "../model/player/Player";

export default class Card extends Phaser.GameObjects.Sprite {
    costText: Phaser.GameObjects.Text;
    private player: Player;
    private unitStat: UnitStat;
    cooldownLine: Phaser.GameObjects.Rectangle;

    constructor(scene: Phaser.Scene, x: number, y: number, unitStat: UnitStat, player: Player, private onCLick: () => void) {
        super(scene, x, y, unitStat.texture, 1);
        this.player = player;
        this.unitStat = unitStat;
        scene.add.existing(this);
        this.setDepth(2);
        this.setCrop(28, 0, 72, 100);
        this.setOrigin(0.54, 0.58);
        this.setDepth(11);
        const backdrop = this.scene.add.image(x - 6, y + 5, Images.PANEL_BLUE).setScale(0.8, 1.4).setDepth(10);
        backdrop.setInteractive();
        backdrop.on("pointerdown", (ev) => this.onCLick());
        this.costText = this.scene.add.text(x - 6, y + 25, `${unitStat.cost}`, {
            fontFamily: defaultFont,
            fontSize: "18px"
        });
        this.costText.setDepth(12);
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

        this.cooldownLine = this.scene.add.rectangle(x - 5, y, 80, 5, 0xFF0000, 0.7);
        this.cooldownLine.setDepth(13);
        this.cooldownLine.setVisible(false);
    }

    update() {
        if (this.player.resource < this.unitStat.cost) {
            this.costText.setColor("#FF0000");
        } else {
            this.costText.setColor("#FFFFFF");
        }
        if (this.player.createCoolDown === 0) {
            this.cooldownLine.setVisible(false);
        } else {
            this.cooldownLine.setVisible(true);
            const maxHeight = this.y - 63;
            const minHeight = this.y + 48;
            const percent = this.player.createCoolDown / this.player.baseCreateCoolDown / this.player.units.length;
            this.cooldownLine.setY(Phaser.Math.Linear(maxHeight, minHeight, percent));
        }
    }

}
