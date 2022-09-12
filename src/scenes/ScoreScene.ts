import Phaser from "phaser";
import {SceneRegistry} from "./SceneRegistry";
import {Images} from "./PreloadScene";
import cursorGauntlet_grey from "../assets/cursorGauntlet_grey.png";
import {defaultFont} from "../helpers/utils";
import {SHARED_CONFIG} from "../model/config";


export default class ScoreScene extends Phaser.Scene {

    startButton: Phaser.GameObjects.Sprite;
    startButtonText: Phaser.GameObjects.Text;
    result: Phaser.GameObjects.Text;
    bg: Phaser.GameObjects.Sprite;
    private config: typeof SHARED_CONFIG;

    constructor() {
        super(SceneRegistry.SCORE);
        this.config = SHARED_CONFIG;
    }

    create(data: {result: boolean}) {
        this.input.setDefaultCursor(`url(${cursorGauntlet_grey}), default`);
        this.bg = this.add.sprite(this.config.width / 2, this.config.height / 2, Images.BROWN_BG).setScale(1.25);
        this.result = this.add.text(this.config.width / 2 - 150, this.config.height / 2, data.result ? "Victory" : "Defeat", {
            fontFamily: defaultFont,
            fontSize: "75px",
            color: "#0685e5"
        });
        this.result.setPosition((this.config.width - this.result.width) / 2, this.config.height / 2 - 150 );
        this.startButton = this.add.sprite(this.config.width / 2, this.config.height / 2 + 170, Images.BUTTON).setScale(3, 2);
        this.startButtonText = this.add.text(this.config.width / 2 - 155, this.config.height / 2 + 130, "Return to menu", {
            fontFamily: defaultFont,
            fontSize: "50px"
        });
        this.startButton.setInteractive();
        this.startButton.on("pointerup", () => {
            // this.scene.start(SceneRegistry.MENU);
            console.log("There is a bug, so");
            window.location.reload();
        });
    }
}
