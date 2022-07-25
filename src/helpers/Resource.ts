

export default class Resource {
    name: string;
    promise: Promise<void>;
    resolve: () => void;
    resolved = false;
    constructor(name: string) {
        this.name = name;
        this.promise = new Promise<void>(resolve1 => {
           this.resolve = resolve1;
           this.resolved = true;
        });
    }
}
