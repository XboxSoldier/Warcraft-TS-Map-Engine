class BCApp {
    constructor(mode) {
        switch (mode) {
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
    static init(func) {
        this.inits.add(func);
    }
    static load(func) {
        this.loads.add(func);
    }
    static get(fill, fallBack, path) {
        if (path.length < 1)
            return null;
        path = path.concat();
        let key = path.pop();
        let current = BCApp.storage;
        for (let i = 0; i < path.length; i++) {
            if (current.has(path[i])) {
                current = current.get(path[i]);
                if (!(current instanceof Map))
                    return null;
            }
            else {
                if (fill) {
                    current.set(path[i], new Map());
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
    static set(path, value) {
        if (path.length < 2)
            return;
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
BCApp.inits = new Set();
BCApp.loads = new Set();
BCApp.storage = new Map();
console.log('message.');
let a = ['a'];
let b = ['b'];
let c = ['c'];
BCApp.set(['global', a, b], c);
console.log(BCApp.get(false, null, ['global', a, b])[0]);
BCApp.get(true, Map, ['global', b, a, c]);
console.log(BCApp.get(false, null, ['global', b, a, c]));
