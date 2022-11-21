export {};

declare global {
    interface Map<K, V> {
        superior?: Map<K, V>;
        key: K;
        setF(key: K, value: V): void;
        view(keys: K[], FallBackM?: FallBack, FallBackF?: FallBack): V;
        write(keys: K[], value: V): V;
    }
}

class FallBack {
    public func: (this: void, superior: Map<any, any>, key: any) => any;
    constructor(func: (this: void, superior: Map<any, any>, key: any) => any) {
        this.func = func;
    }
    public execute(superior: Map<any, any>, key: any) {
        return this.func(superior, key);
    }
}
let newFolder = new FallBack((superior: Map<any, any>, key: any) => {
    let map = new Map<any, any>();
    map.superior = superior;
    map.key = key;
    return map;
});

Map.prototype.setF = function<K, T>(key: K, value: T): void {
    if (value == undefined) {
        this.delete(key);
        if (this.size == 0) {
            this.superior?.write(this.key, undefined);
        }
    }
    else {
        this.set(key, value);
    }
}

Map.prototype.view = function<K, T>(keys: K[], FallBackM?: FallBack, FallBackF?: FallBack): T {
    if (keys.length == 0) return this;
    let key = keys[0];
    keys = keys.slice(0);
    let result = this.get(key);
    if (result == undefined) {
        if (keys.length == 0) {
            result = FallBackF?.execute(this, key);
        }
        else {
            result = FallBackM?.execute(this, key);
        }
        if (result == undefined) {
            return undefined;
        }
        this.set(key, result);
    }
    if (keys.length == 0) {
        return result;
    }
    else {
        if (!(result instanceof Map)) {
            return undefined;
        }
        else {
            return result.view(keys, FallBackM, FallBackF);
        }
    }
}

Map.prototype.write = function<K, V>(keys: K[], value: V) {
    if (keys.length == 0) {
        return;
    }
    let key = keys[keys.length - 1];
    keys = keys.slice(0, -1);
    let result = this.view(key, newFolder, newFolder);
    if (result instanceof Map) {
        result.setF(key, value);
    }
}