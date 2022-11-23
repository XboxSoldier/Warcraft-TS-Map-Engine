/// <reference path="./core.ts" />

declare global {
    interface Map<K, V> {
        superior: Map<K, V> | undefined;
        key: K | undefined;
        read: (key: K, fallBack?: bc_core.FallBack<K, V>) => V;
        write: (key: K, value: V) => void;
        view: (path: K[], fallBackM?: bc_core.FallBack<K, V>, fallBackF?: bc_core.FallBack<K, V>) => V;
        cover: (path: K[], value: V) => void;
        setProperty(key: string, value: V): void;
    }
    interface Set<T> {
        setProperty(key: string, value: T): void;
    }
}

Map.prototype.read = function<K, V> (key: K, fallBack?: bc_core.FallBack<K, V>): V | Map<K, V> | undefined {
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

Map.prototype.view = function<K, V> (path: K[], fallBackM?: bc_core.FallBack<K, V>, fallBackF?: bc_core.FallBack<K, V>): V | Map<K, V> | undefined {
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
    let next = this.view(path, bc_core.FallBack.map);
    if (next instanceof Map) {
        next.write(key, value);
    }
}

Map.prototype.setProperty = function<K, V> (key: string, value: any): void {
    if (key.length == 0 || key[0] == '$' || key[0] == '_') {
        return;
    }
    if (Map.prototype[key] != undefined) {
        return;
    }
    this[key] = value;
}

Set.prototype.setProperty = function<T> (key: string, value: any): void {
    if (key.length == 0 || key[0] == '$' || key[0] == '_') {
        return;
    }
    if (Set.prototype[key] != undefined) {
        return;
    }
    this[key] = value;
}

export {};
