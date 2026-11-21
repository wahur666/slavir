import type Phaser from "phaser";
import {Images} from "../scenes/PreloadScene.js";
import {defaultFont} from "../helpers/utils.js";
import type Player from "../model/player/Player.js";
import type GameScene from "../scenes/GameScene.js";
import type {PowerStat} from "../model/power/PowerRules.js";

const WIDTH = 90;
const HEIGHT = 120;

/** HUD card of a commander power: click it (or press its hotkey) to aim the power, shows cost and cooldown */
export default class PowerCard {
    private readonly backdrop: Phaser.GameObjects.Image;
    private readonly icon: Phaser.GameObjects.Image;
    private readonly costText: Phaser.GameObjects.Text;
    private readonly coolDownShade: Phaser.GameObjects.Rectangle;
    private readonly coolDownText: Phaser.GameObjects.Text;
    private readonly highlight: Phaser.GameObjects.Rectangle;

    constructor(
        scene: GameScene,
        private readonly x: number,
        private readonly y: number,
        readonly stat: PowerStat,
        icon: string,
        private readonly player: Player,
        onClick: () => void
    ) {
        this.backdrop = scene.add.image(x, y, Images.PANEL_BLUE).setDisplaySize(WIDTH, HEIGHT).setDepth(10).setInteractive({useHandCursor: true});
        this.backdrop.on("pointerdown", (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            if (!pointer.leftButtonDown()) return;
            // Keep the click from reaching the map, which would use the power right away
            event.stopPropagation();
            onClick();
        });
        scene.add
            .text(x, y - HEIGHT / 2 + 12, stat.label.toUpperCase(), {
                fontFamily: defaultFont,
                fontSize: "13px",
                stroke: "#000000",
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(12);
        this.icon = scene.add.image(x, y - 4, icon).setDepth(11);
        scene.add
            .image(x - 14, y + HEIGHT / 2 - 18, Images.CRYSTAL)
            .setScale(0.5)
            .setDepth(12);
        this.costText = scene.add.text(x, y + HEIGHT / 2 - 30, `${stat.cost}`, {fontFamily: defaultFont, fontSize: "18px"}).setDepth(12);
        // Hotkey badge
        scene.add
            .rectangle(x + WIDTH / 2 - 13, y - HEIGHT / 2 + 30, 18, 18, 0x0d1b33, 0.85)
            .setStrokeStyle(1, 0xffffff, 0.6)
            .setDepth(12);
        scene.add
            .text(x + WIDTH / 2 - 13, y - HEIGHT / 2 + 30, stat.hotkey, {fontFamily: defaultFont, fontSize: "13px"})
            .setOrigin(0.5)
            .setDepth(13);
        this.coolDownShade = scene.add
            .rectangle(x, y + HEIGHT / 2 - 4, WIDTH - 8, HEIGHT - 8, 0x000000, 0.6)
            .setOrigin(0.5, 1)
            .setDepth(13);
        this.coolDownText = scene.add
            .text(x, y - 4, "", {fontFamily: defaultFont, fontSize: "28px", stroke: "#000000", strokeThickness: 5})
            .setOrigin(0.5)
            .setDepth(14);
        this.highlight = scene.add
            .rectangle(x, y, WIDTH + 4, HEIGHT + 4)
            .setStrokeStyle(3, 0xffd24a, 1)
            .setDepth(14)
            .setVisible(false);
    }

    update(selected: boolean) {
        const coolDown = this.player.powers.coolDowns[this.stat.name];
        const affordable = this.player.resource >= this.stat.cost;
        this.costText.setColor(affordable ? "#FFFFFF" : "#FF0000");
        this.icon.setTint(coolDown === 0 && affordable ? 0xffffff : 0x8a8a8a);
        const share = coolDown / this.stat.coolDown;
        this.coolDownShade.setDisplaySize(WIDTH - 8, (HEIGHT - 8) * share);
        this.coolDownText.setText(coolDown > 0 ? `${Math.ceil(coolDown / 1000)}` : "");
        this.highlight.setVisible(selected);
    }
}
