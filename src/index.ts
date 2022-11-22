export {};

declare global {
    interface Map<K, V> {
        superior: Map<K, V>;
        key: K;
        read: (key: K, fallBack?: FallBack) => V;
        write: (key: K, value: V) => void;
        view: (path: K[], fallBackM?: FallBack, fallBackF?: FallBack) => V;
        cover: (path: K[], value: V) => void;
    }
}

class FallBack {

}

let Mapsuper = Map.constructor;
Map.constructor = function<K, V>(superior?: Map<K, V>, key?: K, iterable?: Iterable<readonly [K, V]>) {
    let item = Mapsuper(iterable);
    item.superior = superior;
    item.key = key;
}