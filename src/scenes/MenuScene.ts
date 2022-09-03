import Phaser from "phaser";
import {SceneRegistry} from "./SceneRegistry";
import {Images} from "./PreloadScene";
import type {SHARED_CONFIG} from "../main";


export default class MenuScene extends Phaser.Scene {

    logo: Phaser.GameObjects.Sprite;

    constructor(private config: typeof SHARED_CONFIG) {
        super(SceneRegistry.MENU);
    }

    create() {
        this.logo = this.add.sprite(this.config.width / 2 , this.config.height / 2, Images.SLAVIR).setScale(0.3);

        setTimeout(() => {
            this.scene.start(SceneRegistry.GAME)
        }, 3000);
    }


}
