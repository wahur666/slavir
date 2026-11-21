import Phaser from "phaser";
import {SceneRegistry} from "./SceneRegistry.js";
import {Images} from "./PreloadScene.js";
import cursorGauntlet_grey from "../assets/cursorGauntlet_grey.png";
import {defaultFont} from "../helpers/utils.js";
import {SHARED_CONFIG} from "../model/config.js";

export default class MenuScene extends Phaser.Scene {
    logo: Phaser.GameObjects.Sprite;
    startButton: Phaser.GameObjects.Sprite;
    startButtonText: Phaser.GameObjects.Text;
    bg: Phaser.GameObjects.Sprite;
    private config: typeof SHARED_CONFIG;
    constructor() {
        super(SceneRegistry.MENU);
        this.config = SHARED_CONFIG;
    }

    create() {
        this.input.setDefaultCursor(`url(${cursorGauntlet_grey}), default`);
        this.bg = this.add.sprite(this.config.width / 2, this.config.height / 2, Images.BROWN_BG).setScale(1.25);
        this.logo = this.add.sprite(this.config.width / 2, this.config.height / 2 - 150, Images.SLAVIR).setScale(0.3);
        this.startButton = this.add.sprite(this.config.width / 2, this.config.height / 2 + 170, Images.BUTTON).setScale(3, 2);
        this.startButtonText = this.add.text(this.config.width / 2 - 35, this.config.height / 2 + 130, "Play", {
            fontFamily: defaultFont,
            fontSize: "50px",
        });
        this.startButton.setInteractive();
        this.startButton.on("pointerup", () => {
            this.scene.start(SceneRegistry.GAME);
        });
        // The network game has its own page with an HTML lobby
        this.add
            .text(this.config.width / 2, this.config.height / 2 + 270, "Network game", {
                fontFamily: defaultFont,
                fontSize: "28px",
                color: "#ffd27a",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setInteractive({useHandCursor: true})
            .on("pointerup", () => {
                window.location.href = "./networkgame/";
            });
    }
}
