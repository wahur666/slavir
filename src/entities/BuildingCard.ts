import Phaser from "phaser";
import type {BuildingStat} from "./Building";
import {Images} from "../scenes/PreloadScene";
import type Player from "../model/player/Player";
import type GameScene from "../scenes/GameScene";
import {defaultFont} from "../helpers/utils";


export default class BuildingCard extends Phaser.GameObjects.Image {
    private icon: Phaser.GameObjects.Image;
    private crystal: Phaser.GameObjects.Image;
    private costText: Phaser.GameObjects.Text;
    private markedForDestroy = false;

    constructor(private gameScene: GameScene, x: number, y: number, private player: Player, private buildingStat: BuildingStat) {
        super(gameScene, x, y, Images.PANEL_BLUE);
        this.gameScene.add.existing(this);
        const wideConst = 2;
        const scaleConst = wideConst * this.width * 0.8 + (wideConst - 1) * 10;
        this.setScale(scaleConst / this.width, 1.4);
        this.setDepth(14);

        this.setInteractive();
        this.icon = this.gameScene.add.image(x - 40, y, buildingStat.texture).setDepth(15);
        this.crystal = this.gameScene.add.image(x + 20, y, Images.CRYSTAL).setDepth(15);
        this.costText = this.scene.add.text(x + 45, y - 15, `${buildingStat.cost}`, {
            fontFamily: defaultFont,
            fontSize: "24px"
        });
        this.costText.setDepth(15);

        this.on("pointerup", () => {
            if (player.resource < buildingStat.cost) {
                return;
            }
            player.createBuilding(buildingStat.type);
            player.buildings[player.buildings.length - 1].setRevealed(true);
            this.cleanup();
        });
    }

    update() {
        if (this.markedForDestroy) {
            return;
        }
        this.costText.setColor(this.player.resource < this.buildingStat.cost ? "#FF0000": "#FFFFFF");
    }

    cleanup() {
        this.markedForDestroy = true;
        this.icon.destroy();
        this.crystal.destroy();
        this.costText.destroy();
        this.destroy();
    }

}
