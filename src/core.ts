namespace BC {
    export class FallBack<K, V>{
        public static map = new FallBack<any, any>((superior?: Map<any, any>, key?: any) => {
            let map = new Map();
            map.superior = superior;
            map.key = key;
            return map;
        });
        public func: (this: void, superior?: Map<K, V>, key?: K) => V;
        constructor(func: (this: void, superior?: Map<K, V>, key?: K) => V) {
            this.func = func;
        }
        public execute(superior?: Map<K, V>, key?: K): V {
            return this.func(superior, key);
        }
    }

    export let Core = {
        FallBacks: {
            map: new FallBack<any, any>((superior?: Map<any, any>, key?: any) => {
                let map = new Map();
                map.superior = superior;
                map.key = key;
                return map;
            }),
            set: new FallBack<any, any>((superior?: Map<any, any>, key?: any) => {
                return new Set();
            }),
            zero: new FallBack<any, any>((superior?: Map<any, any>, key?: any) => {
                return 0;
            }),
        },
    }

    export class RootFolder extends Map<any, any> {
        public readPath(path: string, fallBack?: FallBack<any, any>): any {
            let keys = path.split('/');
            return this.read(keys, fallBack);
        }

        public writePath(path: string, value: any): void {
            let keys = path.split('/');
            this.write(keys, value);
        }

        public viewPath(path: string, fallBackM?: FallBack<any, any>, fallBackF?: FallBack<any, any>): any | Map<any, any> | undefined {
            let keys = path.split('/');
            return this.view(keys, fallBackM, fallBackF);
        }

        public coverPath(path: string, value: any): void {
            let keys = path.split('/');
            this.cover(keys, value);
        }

        constructor() {
            super();
        }
    }

    export let Root = new RootFolder();

    export let Init = new Set<(this: void) => void>();

    export let Load = new Set<(this: void) => void>();

    export let App = {
        init: () => {
            Init.forEach((func) => {
                func();
            });
        },
        load: () => {
            Load.forEach((func) => {
                func();
            });
        },
    }

    export interface Event {
        name: string;
        source: unit;
        target: unit;
    }

    export interface Validator {
        (this:void, event: Event): boolean;
        label: string;
    }
}