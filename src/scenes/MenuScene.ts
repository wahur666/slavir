import Phaser from "phaser";
import {SceneRegistry} from "./SceneRegistry";
import {Images} from "./PreloadScene";
import cursorGauntlet_grey from "../assets/cursorGauntlet_grey.png";
import type {SHARED_CONFIG} from "../main";
import {defaultFont} from "../helpers/utils";


export default class MenuScene extends Phaser.Scene {

    logo: Phaser.GameObjects.Sprite;
    startButton: Phaser.GameObjects.Sprite;
    startButtonText: Phaser.GameObjects.Text;
    bg: Phaser.GameObjects.Sprite;

    constructor(private config: typeof SHARED_CONFIG) {
        super(SceneRegistry.MENU);
    }

    create() {
        this.input.setDefaultCursor(`url(${cursorGauntlet_grey}), default`);
        this.bg = this.add.sprite(this.config.width / 2 , this.config.height / 2, Images.BROWN_BG).setScale(1.25);
        this.logo = this.add.sprite(this.config.width / 2 , this.config.height / 2 - 150, Images.SLAVIR).setScale(0.3);
        this.startButton = this.add.sprite(this.config.width / 2 , this.config.height / 2 + 170, Images.BUTTON).setScale(3, 2);
        this.startButtonText = this.add.text(this.config.width / 2 - 35 , this.config.height / 2 + 130, "Play", {
            fontFamily: defaultFont,
            fontSize: "50px"
        });

        setTimeout(() => {
            this.scene.start(SceneRegistry.GAME)
        }, 3000);
    }


}
