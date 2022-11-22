class BCApp {
    public static inits = new Set<(this: any) => void>();
    public static loads = new Set<(this: any) => void>();
    public static storage = new Map<any, any>();
    public static init(func: (this: any) => void) {
        this.inits.add(func);
    }
    public static load(func: (this: any) => void) {
        this.loads.add(func);
    }
    constructor(mode: string) {
        switch(mode) {
            case "init": {
                BCApp.inits.forEach((func) => func());
                return;
            }
            case "load": {
                BCApp.loads.forEach((func) => func());
                return;
            }
            default: return;
        }
    }
    public static get(fill: boolean, fallBack: Function | null, path: any[]) {
        if (path.length < 1) return null;
        path = path.concat();
        let key = path.pop();
        let current = BCApp.storage;
        for (let i = 0; i < path.length; i ++) {
            if (current.has(path[i])) {
                current = current.get(path[i]);
                if (!(current instanceof Map)) return null;
            }
            else {
                if (fill) {
                    current.set(path[i], new Map<any, any>());
                    current = current.get(path[i]);
                }
                else {
                    return null;
                }
            }
        }
        if (current.has(key)) {
            return current.get(key);
        }
        else if (fallBack) {
            current.set(key, fallBack());
        }
        else {
            return null;
        }
    }
    public static set(path: any[], value: any) {
        if (path.length < 2) return;
        path = path.concat();
        let key = path.pop();
        let map = BCApp.get(true, Map, path);
        if (map instanceof Map) {
            map.set(key, value);
            return true;
        }
        else {
            return false;
        }
    }
}

console.log('message.');
let a = ['a'];
let b = ['b'];
let c = ['c'];
BCApp.set(['global', a, b], c);
console.log(BCApp.get(false, null, ['global', a, b])[0]);
BCApp.get(true, Map, ['global', b, a, c]);
console.log(BCApp.get(false, null, ['global', b, a, c]));