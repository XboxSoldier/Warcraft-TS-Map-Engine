class FallBack<K, V>{
    public static map = new FallBack<any, any>((superior?: Map<any, any>, key?: any) => {
        let map = new Map();
        map.superior = superior;
        map.key = key;
        return map;
    });
    public func: (superior?: Map<K, V>, key?: K) => V;
    constructor(func: (superior?: Map<K, V>, key?: K) => V) {
        this.func = func;
    }
    public execute(superior?: Map<K, V>, key?: K): V {
        return this.func(superior, key);
    }
}

declare global {
    interface Map<K, V> {
        superior: Map<K, V>;
        key: K;
        read: (key: K, fallBack?: FallBack<K, V>) => V;
        write: (key: K, value: V) => void;
        view: (path: K[], fallBackM?: FallBack<K, V>, fallBackF?: FallBack<K, V>) => V;
        cover: (path: K[], value: V) => void;
    }
}

Map.prototype.read = function<K, V> (key: K, fallBack?: FallBack<K, V>): V {
    if (this.has(key)) {
        return this.get(key);
    }
    else if (fallBack) {
        let result = fallBack.execute(this, key);
        this.set(key, result);
        return result;
    }
}

Map.prototype.write = function<K, V> (key: K, value: V): void {
    if (value != undefined) {
        this.set(key, value);
    }
    else {
        this.delete(key);
        if (this.size == 0 && this.superior != undefined) {
            this.superior.delete(this.key);
        }
    }
}

Map.prototype.view = function<K, V> (path: K[], fallBackM?: FallBack<K, V>, fallBackF?: FallBack<K, V>): V {
    if (path.length == 0) {
        return this;
    }
    let key = path[0];
    path = path.slice(1);
    let next = this.read(key, (path.length > 0)? fallBackM: fallBackF);
    if (path.length == 0) {
        return next;
    }
    else if (next instanceof Map) {
        return next.view(path, fallBackM, fallBackF);
    }
    return undefined;
}

Map.prototype.cover = function<K, V> (path: K[], value: V): void {
    if (path.length == 0) {
        return;
    }
    let key = path[path.length - 1];
    path = path.slice(0, -1);
    let next = this.view(path, FallBack.map);
    if (next instanceof Map) {
        next.write(key, value);
    }
}

export {FallBack};