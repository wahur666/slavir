import Phaser from "phaser";
import {returnToMenu, SceneRegistry} from "./SceneRegistry.js";
import {Images} from "./PreloadScene.js";
import cursorGauntlet_grey from "../assets/cursorGauntlet_grey.png";
import {defaultFont} from "../helpers/utils.js";
import {SHARED_CONFIG} from "../model/config.js";
import {downloadReplay, pickReplayFile, type Replay} from "../model/replay/Replay.js";
import type {GameSceneData} from "./GameScene.js";

export default class ScoreScene extends Phaser.Scene {
    startButton: Phaser.GameObjects.Sprite;
    startButtonText: Phaser.GameObjects.Text;
    result: Phaser.GameObjects.Text;
    bg: Phaser.GameObjects.Sprite;
    private config: typeof SHARED_CONFIG;
    private messageText: Phaser.GameObjects.Text;

    constructor() {
        super(SceneRegistry.SCORE);
        this.config = SHARED_CONFIG;
    }

    create(data: {result: boolean; replay?: Replay}) {
        this.input.setDefaultCursor(`url(${cursorGauntlet_grey}), default`);
        this.bg = this.add.sprite(this.config.width / 2, this.config.height / 2, Images.BROWN_BG).setScale(1.25);
        this.result = this.add.text(this.config.width / 2 - 150, this.config.height / 2, data.result ? "Victory" : "Defeat", {
            fontFamily: defaultFont,
            fontSize: "75px",
            color: "#0685e5",
        });
        this.result.setPosition((this.config.width - this.result.width) / 2, this.config.height / 2 - 150);
        this.startButton = this.add.sprite(this.config.width / 2, this.config.height / 2 + 170, Images.BUTTON).setScale(3, 2);
        this.startButtonText = this.add.text(this.config.width / 2 - 155, this.config.height / 2 + 130, "Return to menu", {
            fontFamily: defaultFont,
            fontSize: "50px",
        });
        this.startButton.setInteractive();
        this.startButton.on("pointerup", () => {
            returnToMenu(this);
        });
        this.setupReplayButtons(data.replay);
    }

    private setupReplayButtons(replay: Replay | undefined) {
        const y = this.config.height / 2 + 20;
        const centerX = this.config.width / 2;
        this.messageText = this.add
            .text(centerX, y + 60, "", {fontFamily: defaultFont, fontSize: "20px", color: "#ffd27a", stroke: "#000000", strokeThickness: 4})
            .setOrigin(0.5);
        if (replay) {
            this.addButton(centerX - 190, y, "Download replay", () => downloadReplay(replay));
        }
        this.addButton(replay ? centerX + 190 : centerX, y, "Load replay", () => this.loadReplay());
    }

    private async loadReplay() {
        try {
            const replay = await pickReplayFile();
            if (replay) this.scene.start(SceneRegistry.GAME, {replay} satisfies GameSceneData);
        } catch (error) {
            this.messageText.setText(`Could not load replay: ${(error as Error).message}`);
        }
    }

    private addButton(x: number, y: number, label: string, onClick: () => void) {
        this.add.image(x, y, Images.BUTTON).setScale(1.9, 1.3).setInteractive().on("pointerup", onClick);
        this.add.text(x, y, label, {fontFamily: defaultFont, fontSize: "26px"}).setOrigin(0.5);
    }
}
