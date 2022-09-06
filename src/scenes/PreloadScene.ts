import * as Phaser from "phaser";
import {SceneRegistry} from "./SceneRegistry";
import Hex_v01_grid from "../assets/Hex_v01_grid.png";
import map1 from "../maps/map2.json";
import guard from "../assets/guard.png";
import female_archer from "../assets/female_archer.png";
import male_engineer from "../assets/male_engineer.png";
import castle from "../assets/castle_large.png";
import hangar from "../assets/hangar.png";
import barrack from "../assets/militaryTent.png";
import factory from "../assets/shop.png";
import tech from "../assets/saloon.png";
import spawn from "../assets/tileDirt_tile.png";
import black_dragon from "../assets/blackDragon.png";
import robot5 from "../assets/robot-5.png";
import fantasy8 from "../assets/fantasy-8.png";
import demon_dragon from "../assets/demondragon.png";
import crystals1 from "../assets/crystals1.png";
import slavir from "../assets/slavir.png";
import buttonLong_blue from "../assets/buttonLong_blue.png";
import buttonLong_blue_pressed from "../assets/buttonLong_blue_pressed.png";
import parchmentAncient from "../assets/parchmentAncient.png";
import panel_blue from "../assets/panel_blue.png";
import icon_wing from "../assets/Icon.3_58.png";
import icon_armor from "../assets/Icon.6_94.png";
import icon_wizard from "../assets/Icons8_32.png";
import brown_panel from "../assets/panelInset_brown.png";
import beige_panel from "../assets/panelInset_beigeLight.png";
import tick_silver from "../assets/arrowSilver_right.png";
import tick_brown from "../assets/arrowBrown_right.png";
import icon_unit from "../assets/Icon.4_33.png";
import square_button_pressed_beige from "../assets/buttonSquare_beige_pressed.png";
import {defaultFont} from "../helpers/utils";
import {SHARED_CONFIG} from "../model/config";

export enum Images {
    HEX_GRID = "hex-grid",
    GUARD = "guard",
    FEMALE_ARCHER = "female_archer",
    CASTLE = "castle",
    BARRACK = "barrack",
    FACTORY = "factory",
    HANGAR = "hangar",
    TECH = "tech",
    SPAWN = "spawn",
    MALE_ENGINEER = "male_engineer",
    BLACK_DRAGON = "black_dragon",
    ROBOT5 = "robot5",
    FANTASY8 = "fantasy8",
    DEMON_DRAGON = "demon_dragon",
    CRYSTAL = "crystals1",
    SLAVIR = "slavir",
    BUTTON = "button",
    BUTTON_PRESSED = "button-pressed",
    BROWN_BG = "brown_bg",
    PANEL_BLUE = "panel-blue",
    PANEL_BEIGE = "panel-beige",
    ICON_WING = "icon-wing",
    ICON_ARMOR = "icon-armor",
    ICON_WIZARD = "icon-wizard",
    BROWN_PANEL = "brown-panel",
    TICK_SILVER = "tick-silver",
    TICK_BROWN = "tick-brown",
    ICON_UNIT = "icon-unit",
    BUTTON_PRESSED_BEIGE = "button-pressed-beige",
}

export enum Tilemaps {
    MAP1 = "map1"
}

export default class PreloadScene extends Phaser.Scene {
    loadingText: Phaser.GameObjects.Text;
    background: Phaser.GameObjects.Rectangle;
    foreground: Phaser.GameObjects.Rectangle;
    private config: typeof SHARED_CONFIG;

    constructor() {
        super(SceneRegistry.PRELOAD);
        this.config = SHARED_CONFIG;
    }

    createLoadingGui() {
        this.loadingText = this.add.text(this.config.width / 2 - 85, this.config.height / 2 - 110, "Loading...", {
            fontFamily: defaultFont,
            fontSize: "50px"
        });
        this.background = this.add.rectangle(this.config.width / 2, this.config.height / 2 + 50, 600, 50, 0xFFFFFF);
        this.foreground = this.add.rectangle(343, this.config.height / 2 + 50, 595, 45, 0x233565)
            .setOrigin(0, 0.5);
        this.load.on("progress", (value) => {
            this.foreground.setDisplaySize(595 * value | 0, 45);
        });
    }

    preload() {
        this.load.image(Images.SLAVIR, slavir);
        this.load.image(Images.HEX_GRID, Hex_v01_grid);
        this.load.image(Images.CASTLE, castle);
        this.load.image(Images.BARRACK, barrack);
        this.load.image(Images.FACTORY, factory);
        this.load.image(Images.HANGAR, hangar);
        this.load.image(Images.TECH, tech);
        this.load.image(Images.SPAWN, spawn);
        this.load.image(Images.CRYSTAL, crystals1);
        this.load.image(Images.BUTTON, buttonLong_blue);
        this.load.image(Images.BUTTON_PRESSED, buttonLong_blue_pressed);
        this.load.image(Images.BROWN_BG, parchmentAncient);
        this.load.image(Images.PANEL_BLUE, panel_blue);
        this.load.image(Images.ICON_WING, icon_wing);
        this.load.image(Images.ICON_ARMOR, icon_armor);
        this.load.image(Images.ICON_WIZARD, icon_wizard);
        this.load.image(Images.BROWN_PANEL, brown_panel);
        this.load.image(Images.TICK_SILVER, tick_silver);
        this.load.image(Images.TICK_BROWN, tick_brown);
        this.load.image(Images.PANEL_BEIGE, beige_panel);
        this.load.image(Images.ICON_UNIT, icon_unit);
        this.load.image(Images.BUTTON_PRESSED_BEIGE, square_button_pressed_beige);

        this.load.spritesheet(Images.GUARD, guard, {
            frameWidth: 128,
            frameHeight: 128,
        });

        this.load.spritesheet(Images.BLACK_DRAGON, black_dragon, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(Images.ROBOT5, robot5, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(Images.FANTASY8, fantasy8, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(Images.DEMON_DRAGON, demon_dragon, {
            frameWidth: 128,
            frameHeight: 128,
        });

        this.load.spritesheet(Images.FEMALE_ARCHER, female_archer, {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(Images.MALE_ENGINEER, male_engineer, {
            frameWidth: 128,
            frameHeight: 128
        });

        this.load.tilemapTiledJSON(Tilemaps.MAP1, map1);

        this.createLoadingGui();

        this.load.once("complete", () => {
            this.startGame();
        });
    }

    startGame() {
        setTimeout(() => {
            this.foreground.destroy();
            this.background.destroy();
            this.loadingText.destroy();
            if (this.config.debug.autoLoadGame) {
                this.scene.start(SceneRegistry.GAME);
            } else {
                this.scene.start(SceneRegistry.MENU);
            }
        }, 1000);
    }

}
