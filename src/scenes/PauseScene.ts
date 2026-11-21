import Phaser from "phaser";
import {returnToMenu, SceneRegistry} from "./SceneRegistry.js";
import {SHARED_CONFIG} from "../model/config.js";
import {defaultFont} from "../helpers/utils.js";
import {Images} from "./PreloadScene.js";

export default class PauseScene extends Phaser.Scene {
    constructor() {
        super(SceneRegistry.PAUSE);
    }

    create(data?: {gameKey?: string}) {
        // The paused game scene: the normal game or the network game
        const gameKey = data?.gameKey ?? SceneRegistry.GAME;
        const {width, height} = SHARED_CONFIG;
        this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setInteractive();
        this.add
            .text(width / 2, height / 2 - 140, "Paused", {
                fontFamily: defaultFont,
                fontSize: "56px",
            })
            .setOrigin(0.5);
        const resume = () => {
            this.scene.resume(gameKey);
            this.scene.stop();
        };
        this.addButton(height / 2, "Resume", resume);
        this.addButton(height / 2 + 100, "Return to menu", () => {
            this.scene.stop(gameKey);
            returnToMenu(this);
        });
        this.input.keyboard.on("keyup-ESC", resume);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off("keyup-ESC", resume));
    }

    private addButton(y: number, label: string, onClick: () => void) {
        this.add
            .image(SHARED_CONFIG.width / 2, y, Images.BUTTON)
            .setScale(2, 1.3)
            .setInteractive()
            .on("pointerup", onClick);
        this.add
            .text(SHARED_CONFIG.width / 2, y, label, {
                fontFamily: defaultFont,
                fontSize: "28px",
            })
            .setOrigin(0.5);
    }
}
