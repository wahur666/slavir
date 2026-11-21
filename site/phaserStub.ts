/**
 * Stand-in for the "phaser" package when the site generator loads game modules in Node.
 *
 * Unit stats live on classes that extend Phaser game objects, and their modules touch Phaser at load time
 * (`class X extends Phaser.GameObjects.Sprite`, `const Vector2 = Phaser.Math.Vector2`, `new Vector2(0.8)`). Every
 * property, call and construction of this stub returns another stub, so those modules load without a browser. Nothing
 * it returns does anything: only plain data (stats, enums, asset URLs) is meaningful.
 */

type Stub = any;

function makeStub(): Stub {
    const cache = new Map<PropertyKey, Stub>();
    // A plain function, so the stub can be called, constructed and extended
    const target = function phaserStub() {};
    return new Proxy(target, {
        get(_, key) {
            // Not a thenable, or `await` on a module namespace would hang
            if (key === "then") return undefined;
            if (key === Symbol.toPrimitive) return () => 0;
            if (key === Symbol.iterator) return function* () {};
            if (!cache.has(key)) cache.set(key, makeStub());
            return cache.get(key);
        },
        apply: () => makeStub(),
        construct: () => makeStub(),
    });
}

const Phaser: Stub = makeStub();
export default Phaser;

// For `import * as Phaser from "phaser"`: a namespace import only sees real named exports
export const {
    Actions,
    Animations,
    AUTO,
    BlendModes,
    Cameras,
    CANVAS,
    Curves,
    Data,
    Display,
    Events,
    Game,
    GameObjects,
    Geom,
    Input,
    Loader,
    Physics,
    Renderer,
    Scale,
    Scene,
    Sound,
    Structs,
    Textures,
    Tilemaps,
    Time,
    Tweens,
    Types,
    Utils,
    WEBGL,
} = Phaser;

// Exported under its Phaser name without shadowing the global Math here
const PhaserMath: Stub = Phaser.Math;
export {PhaserMath as Math};
