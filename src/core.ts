namespace bc_core {
    export class FallBack<K, V>{
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
}