declare module "*.scss" {
    const content: {[className: string]: string};
    export = content;
}

declare module "*.svg" {
    const content: any;
    export default content;
}

declare module "*.jpg";
declare module "*.png";
declare module "*.jpeg";
declare module "*.gif";
declare module "*.css";

/** True only in the itch.io build (`npm run itch`), set by vite's define; undefined elsewhere, see IS_ITCH_BUILD */
declare const __ITCH_BUILD__: boolean | undefined;
