/*
    w3ts使用说明
    以Lua实现的Typescript具有以下特点：
        1.不区分null、undefined，且对所有false、null、undefined以外的值进行布尔判断时均视为true
        2.不区分let和var，且转译器只允许使用let
*/

/*
    以下函数在BCStorage.getThrough方法中充当fallBack参数
*/
function newMap() { // 创建一个键值对
    return new Map<any, any>();
}

function newSet() { // 创建一个键值对
    return new Set<any>();
}

function newFolder() { // 无意义，标志要创建一个元素集
    return;
}

let BCFunc = { // 便其他库文件使用
    newMap: newMap,
    newFolder: newFolder,
    newSet: newSet,
}

let BCApp = { // 管理在系统初始化时执行的效果
    initialization: new Set<Function>(),
    loading: new Set<Function>(),
    init: (func: Function) => { // 最先执行，时间在库文件加载之前
        BCApp.initialization.add(func);
    },
    load: (func: Function) => { // 最后执行，时间在库文件加载之后
        BCApp.loading.add(func);
    },
    initExecute: () => {
        BCApp.initialization.forEach(value => {
            value();
        });
    },
    loadExecute: () => {
        BCApp.loading.forEach(value => {
            value();
        });
    },
}

/*
    数据集：特殊的键值对数据类型，额外记录了其在游戏全局数据中的位置
    数据集会在所有元素被删除后自我销毁
*/
class BCFolder extends Map<any, any> {
    private parent: BCFolder;
    private fromKey: any;
    constructor(parent: BCFolder, fromKey: any, args?: [any, any][]) {
        super(args);
        this.parent = parent;
        this.fromKey = fromKey;
    }
    public write(key: any, value: any): void { // 删除元素时，与delete方法不同，会在删除最后一个元素时自我销毁
        if (value === undefined) { // 删除元素
            this.delete(key);
            if (this.size == 0 && this.parent) {
                this.parent.write(this.fromKey, undefined); // 调用上一级数据集方法进行自我销毁
            }
        }
        else {
            this.set(key, value);
        }
    }
    /*
        读取指定键的值
        fill设置为真时，会在获取数据时，自动在不存在的路径节点创建数据集
        fallBack不为undefine时，会在路径终点数据不存在时执行该函数，并且将函数的执行结果置于该路径作为返回值
        特殊地，fallBack设置为newFolder时，会创建新数据集
    */
    public getThrough(fill: boolean, fallBack: Function, path: any[], position: number): any {
        if (path.length == 0) { // 直接获取此数据集本身
            return this;
        }
        let next = this.get(path[position]);
        if (!next) {
            if (position == path.length - 1) {
                if (fallBack) {
                    if (fallBack == newFolder) {
                        next = new BCFolder(this, path[position]);
                        this.set(path[position], next);
                        return next;
                    }
                    next = fallBack();
                    this.set(path[position], next);
                    return next;
                }
                return undefined;
            }
            if (fill) {
                next = new BCFolder(this, path[position]);
                this.set(path[position], next);
                return next.getThrough(fill, fallBack, path, position + 1);
            }
            return undefined;
        }
        if (position == path.length - 1) {
            return next;
        }
        if (!(next instanceof BCFolder)) {
            return undefined;
        }
        return next.getThrough(fill, fallBack, path, position + 1);
    }
}

/*
    全局数据：包含需要访问和修改的所有数据内容，如单位行为、积分、事件效果等
    一般不需要直接对全局数据进行操作
*/
class BCStorage {
    private static mainFolder = new BCFolder(undefined, undefined);
    /*
        读取指定路径下的数据
        fill设置为真时，会在获取数据时，自动在不存在的路径节点创建数据集
        fallBack不为undefine时，会在路径终点数据不存在时执行该函数，并且将函数的执行结果置于该路径作为返回值
        特殊地，fallBack设置为newFolder时，会创建新数据集
    */
    public static aquire(fill: boolean, fallBack: Function, path: any[]): any {
        return BCStorage.mainFolder.getThrough(fill, fallBack, path, 0);
    }
    public static write(path: any[], value: any): void { // 在全局数据的指定路径写入数据，会自动在不存在的路径节点创建数据集
        if (path.length < 0) {
            return;
        }
        let key = path[path.length - 1];
        path = path.slice(0, path.length - 1);
        let storage = BCStorage.aquire(true, undefined, path);
        if (storage instanceof BCFolder) {
            storage.write(key, value);
        }
    }
}

/*
    事件：记录一个事件相关数据的键值对
    一些重要数据直接存储为事件的元素，事件的名称、来源和目标必须存在
*/
class BCEvent extends Map<string, any> {
    public source: unit;
    public target: unit;
    public value: number;
    public item: any;
    public name: string;
    constructor(name: string, source: unit, target: unit, item?: any, value?: any, args?: [string, any][]) {
        super(args);
        this.name = name;
        this.source = source;
        this.target = target;
        this.item = item;
        this.value = value;
    }
}

/*
    验证器：判断事件是否满足某些条件
*/
class BCValiador {
    private static array = new Map<string, BCValiador>();
    public name?: string;
    public func: Function;
    constructor(func: Function, name?: string) {
        this.name = name;
        this.func = func;
        if (name) {
            BCValiador.array.set(name, this);
        }
    }
    public execute(thisEvent: BCEvent): boolean {
        if (this.func(thisEvent)) {
            return true;
        }
        return false;
    }
}

/*
    验证器组合：包含了0至多个验证器的集合
    包含0个验证器的验证器组合，在进行验证时，将会通过验证
*/
class BCValiadorGroup extends Set<BCValiador> {
    constructor(iterable?: Iterable<BCValiador>) {
        super(iterable);
    }
    public execute(thisEvent: BCEvent): boolean {
        /*
            在单个验证器验证失败时抛出true，立即返回false并终止循环
        */
        try {
            this.forEach(value => {
                if (!value.execute(thisEvent)) {
                    throw(true);
                }
            });
        }
        catch (result) {
            if (result) {
                return false;
            }
        }
        return true;
    }
}

/*
    效果：在验证器验证通过的前提下，根据事件数据执行某些操作
*/
class BCEffect {
    private static array = new Map<string, BCEffect>();
    public name?: string;
    public func: Function;
    public valiadors: BCValiadorGroup;
    constructor(func: Function, name?: string) {
        this.name = name;
        this.func = func;
        this.valiadors = new BCValiadorGroup();
        if (name) {
            BCEffect.array.set(name, this);
        }
    }
    public execute(thisEvent: BCEvent): void {
        if (this.valiadors.execute(thisEvent)) {
            this.func(thisEvent);
        }
    }
    public addValiador(valiador: BCValiador): void {
        this.valiadors.add(valiador);
    }
}

/*
    效果组合：包含了0至多个效果的集合
    执行时，某个效果独立进行验证和执行
*/
class BCEffectGroup extends Set<BCEffect> {
    constructor(iterable?: Iterable<BCEffect>) {
        super(iterable);
    }
    public execute(thisEvent: BCEvent): void {
        this.forEach(value => {
            value.execute(thisEvent);
        });
    }
}

/*
    积分：针对某一个实体，进行积分，以此作为其他操作的参考，用于事件效果的注册等
*/
let BCScore = {
    /*
        获取指定积分，其在全局数据中的路径为parent/namespace/target
        若目标积分不存在，返回默认值0
    */
    aquire: (parent: any, namespace: any, target: any) => {
        let storage = BCStorage.aquire(false, undefined, [parent, namespace]);
        if (!(storage instanceof BCFolder)) {
            return 0;
        }
        if (!storage.has(target)) {
            return 0;
        }
        let num = storage.get(target);
        if (typeof num == 'number') {
            return num;
        }
        return undefined;
    },
    /*
        设置指定积分，其在全局数据中的路径为parent/namespace/target
    */
    set: (parent: any, namespace: any, target: any, value: number) => {
        let storage = BCStorage.aquire(true, newFolder, [parent, namespace]);
        if (!(storage instanceof BCFolder)) {
            return;
        }
        if (value == 0) {
            storage.set(target, undefined);
        }
        else {
            storage.set(target, value);
        }
    },
    /*
        在指定积分上加算value，其在全局数据中的路径为parent/namespace/target
        返回新的积分值
    */
    change: (parent: any, namespace: any, target: any, value: number) => {
        let storage = BCStorage.aquire(true, newFolder, [parent, namespace]);
        if (!(storage instanceof BCFolder)) {
            return;
        }
        let num = storage.get(target);
        if (typeof num != 'number') {
            return;
        }
        num += value;
        if (num == 0) {
            storage.set(target, undefined);
        }
        else {
            storage.set(target, num);
        }
        return num;
    },
}

/*
    集合集：针对某一个实体，将一定的内容存储在一个空间内以供读取
    会在最后一个元素被移除时自我销毁
*/
let BCSet = {
    /*
        获取指定集合集，其在全局数据中的路径为parent/namespace/target
    */
    aquire: (parent: any, namespace: any, target: any) => {
        let storage = BCStorage.aquire(false, undefined, [parent, namespace]);
        if (!(storage instanceof BCFolder)) {
            return;
        }
        let set = storage.get(target);
        if (set instanceof Set) {
            return set;
        }
        return undefined;
    },
    /*
        在指定集合集中加入value元素，其在全局数据中的路径为parent/namespace/target
        若目标集合集不存在，自动创建该集合集
        若目标路径存在元素但不是集合集，不会执行效果
    */
    add: (parent: any, namespace: any, target: any, value: any) => {
        let storage = BCStorage.aquire(true, newFolder, [parent, namespace]);
        if (!(storage instanceof BCFolder)) {
            return;
        }
        let set = storage.get(target);
        if (!set) {
            set = new Set();
            storage.set(target, set);
        }
        if (set instanceof Set) {
            set.add(value);
            return set;
        }
        return undefined;
    },
    /*
        从指定集合集删除value元素，其在全局数据中的路径为parent/namespace/target
        若目标路径存在元素但不是集合集，不会执行效果
        删除集合集元素后，若其没有元素，则会自毁
    */
    delete: (parent: any, namespace: any, target: any, value: any) => {
        let storage = BCStorage.aquire(false, undefined, [parent, namespace]);
        if (!(storage instanceof BCFolder)) {
            return;
        }
        let set = storage.get(target);
        if (set instanceof Set) {
            set.delete(value);
            if (set.size == 0) {
                storage.write(target, undefined);
            }
            else {
                return set;
            }
        }
        return undefined;
    },
    /*
        清除并销毁指定集合集
    */
    clear: (parent: any, namespace: any, target: any) => {
        let storage = BCStorage.aquire(true, newFolder, [parent, namespace]);
        if (!(storage instanceof BCFolder)) {
            return;
        }
        let set = storage.get(target);
        if (set instanceof Set) {
            storage.write(target, undefined);
        }
    },
}

/*
    区间：用于将数字限定于某一区间
    全部为闭区间
*/
class BCRange {
    public static noRange = new BCRange(-Infinity, Infinity); // 默认区间[-∞,+∞]
    private min: number;
    private max: number;
    constructor(min: number, max: number) {
        this.min = min;
        this.max = max;
    }
    public calculate(num: number): number { // 将输入的数字限定在区间范围内
        return math.max(math.min(this.max, num), this.min);
    }
}

/*
    属性：针对某一单位的自定义属性
    在属性变化时执行某些效果
*/
class BCAttribute {
    public static array = new Map<string, BCAttribute>();
    public name: string;
    public range: BCRange;
    public initEffects: BCEffectGroup;
    public changeEffects: BCEffectGroup;
    public removeEffects: BCEffectGroup;
    constructor(name: string, range?: [number, number]) {
        this.name = name;
        BCAttribute.array.set(this.name, this);
        if (range) {
            this.range = new BCRange(range[0], range[1]);
        }
        else {
            this.range = BCRange.noRange;
        }
        this.initEffects = new BCEffectGroup();
        this.changeEffects = new BCEffectGroup();
        this.removeEffects = new BCEffectGroup();
    }
    public addEffect(type: string, effect: BCEffect): void {
        switch (type) {
            case 'init': { // 当属性由0变为其他值时执行的效果
                this.initEffects.add(effect);
                break;
            }
            case 'change': { // 当属性发生任何变化时执行的效果
                this.changeEffects.add(effect);
                break;
            }
            case 'remove': { // 当属性由其他值变为0时执行的效果
                this.removeEffects.add(effect);
                break;
            }
        }
    }
    public aquire(parent: unit): number {
        return BCScore.aquire(parent, 'attribute', this);
    }
    public set(parent: unit, value: number): void { // 设置属性值，并根据设置的属性值执行效果
        let storage = BCStorage.aquire(true, newFolder, [parent, 'attribute']);
        if (!(storage instanceof BCFolder)) {
            return;
        }
        let num = storage.get(this);
        if (!num) {
            num = 0;
        }
        if (typeof num != 'number') {
            return;
        }
        value = this.range.calculate(value);
        let change = value - num;
        if (change == 0) return;
        if (value == 0) {
            storage.set(this, undefined);
        }
        else {
            storage.set(this, value);
        }
        let event = new BCEvent('attributeChange', parent, parent, this, change, [
            ['oldValue', num],
            ['newValue', value],
        ]);
        if (num == 0) {
            this.initEffects.execute(event);
        }
        this.changeEffects.execute(event);
        if (value == 0) {
            this.removeEffects.execute(event);
        }
    }
    public change(parent: unit, value: number): number { // 在现有属性值的基础上进行加成，执行效果并返回新的属性值
        let storage = BCStorage.aquire(true, newFolder, [parent, 'attribute']);
        if (!(storage instanceof BCFolder)) {
            return;
        }
        let num = storage.get(this);
        if (!num) {
            num = 0;
        }
        if (typeof num != 'number') {
            return;
        }
        if (value == 0) {
            return num;
        }
        let newValue = this.range.calculate(num + value);
        value = newValue - num;
        if (value == 0) return;
        if (newValue == 0) {
            storage.set(this, undefined);
        }
        else {
            storage.set(this, newValue);
        }
        let event = new BCEvent('attributeChange', parent, parent, this, value, [
            ['oldValue', num],
            ['newValue', newValue],
        ]);
        if (num == 0) {
            this.initEffects.execute(event);
        }
        this.changeEffects.execute(event);
        if (newValue == 0) {
            this.removeEffects.execute(event);
        }
    }
}

/*
    触发事件：在某一事件时，为该事件主体执行预先注册的效果
    可以通过为事件主体所有者或“global”注册事件效果的方式，使大量不确定事件主体进行事件效果
*/
class BCTrigger {
    public static array = new Map<string, BCTrigger>();
    public name: string;
    constructor(name: string) {
        this.name = name;
        BCTrigger.array.set(name, this);
    }
    public register(parent: any, effect: BCEffect, count: number): number { // 为一个主体在指定触发事件下注册指定效果，同一效果在一个触发事件内只会执行一次，不管多少主体注册了这个效果
        let storage = BCStorage.aquire(true, newFolder, [parent, this]);
        if (!(storage instanceof BCFolder)) {
            return undefined;
        }
        let num = storage.get(effect);
        if (!num) {
            num = 0;
        }
        if (typeof num != 'number') {
            return undefined;
        }
        let newValue = num + count;
        if (newValue == 0) {
            storage.set(effect, undefined);
        }
        else {
            storage.set(effect, newValue);
        }
        let judge = num * newValue;
        if (judge <= 0) {
            if (newValue > 0) {
                BCSet.add(parent, 'trigger', this, effect);
            }
            else {
                BCSet.delete(parent, 'trigger', this, effect);
            }
        }
        return newValue;
    }
    public execute(parents: any[], thisEvent: BCEvent): void { // 为指定主体执行触发事件的效果，对于单位一般是全局、单位所有者、单位本身
        parents = ['global'].concat(parents);
        let effects = new BCEffectGroup();
        for (let i = 0; i < parents.length; i ++) {
            let storage = BCSet.aquire(parents[i], 'trigger', this);
            if (!(storage instanceof Set)) {
                continue;
            }
            storage.forEach(value => {
                effects.add(value);
            });
        }
        effects.execute(thisEvent);
    }
}

/*
    触发事件生成器：根据一定的规则生成单位触发事件
    生成触发事件名称为“前缀+后缀”
*/
class BCTriggerGenerator {
    public static array = new Map<string, BCTriggerGenerator>();
    public trigger: trigger;
    public prefix: string;
    public eventData: playerunitevent;
    public subTriggers: Set<string>;
    public eventName: string;
    public eventSource: Function;
    public eventTarget: Function;
    public eventItem: Function;
    public eventValue: Function;
    public eventArgs: Map<string, Function>;
    public subTriggerParentMain: Map<string, Function>;
    public subTriggerParents: Map<string, Set<Function>>;
    public subTriggersResults: Map<string, BCTrigger>;
    constructor(prefix: string, pEvent: playerunitevent) { // 以指定前缀创建触发事件生成器
        this.prefix = prefix;
        BCTriggerGenerator.array.set(this.prefix, this);
        this.eventData = pEvent;
        this.subTriggers = new Set();
        this.eventArgs = new Map();
        this.subTriggerParentMain = new Map();
        this.subTriggerParents = new Map();
        this.subTriggersResults = new Map();
    }
    public initializeEventArgs(name: string, source: Function, target: Function, item?: Function, value?: Function, others?: Map<string, Function>): void { // 规定生成事件参数的规则，所有函数不得有参数
        this.eventName = name;
        this.eventSource = source;
        this.eventTarget = target;
        this.eventItem = item;
        this.eventValue = value;
        this.eventArgs = others;
    }
    public active(): void { // 激活事件生成器并生成事件，必须包含至少一个后缀，并且指定了事件参数的生成规则
        if (this.eventName && this.subTriggers.size > 0) {
            this.trigger = CreateTrigger();
            TriggerRegisterAnyUnitEventBJ(this.trigger, this.eventData);
            TriggerAddCondition(this.trigger, Filter(() => {
                let args = [];
                this.eventArgs.forEach((value, key) => {
                    args.push([key, value()]);
                });
                let event = new BCEvent(this.eventName, this.eventSource(), this.eventTarget(), this.eventItem(), this.eventValue(), args);
                this.subTriggers.forEach(subTrigger => {
                    let parents = [this.subTriggerParentMain.get(subTrigger)];
                    this.subTriggerParents.get(subTrigger).forEach(value => {
                        parents.push(value(parents[0]));
                    });
                    this.subTriggersResults.get(subTrigger).execute(parents, event);
                });
                return false;
            }));
        }
    }
    public addSubTrigger(postfix: string, parentMain: Function, parents: Function[]): void { // 为事件生成器添加后缀，这会创建一个新的事件。parents中的函数会以parentMain的返回值作为参数以获取其他主体
        this.subTriggers.add(postfix);
        this.subTriggerParentMain.set(postfix, parentMain);
        this.subTriggerParents.set(postfix, new Set(parents));
        this.subTriggersResults.set(postfix, new BCTrigger(this.prefix + postfix));
    }
}

/*
    增益链接：用于为行为绑定增益效果，增益效果为行为提供显示效果
*/
class BCBuffLink {
    buff: number;
    ability: number;
    level: number;
    order: string;
    hardLink: boolean; // 当视觉效果的增益效果被移除后如何反应，true即会摧毁行为，false则会重新添加增益效果
    constructor(hardLink: boolean, buff: number, ability: number, level: number, order: string) {
        this.hardLink = hardLink;
        this.buff = buff;
        this.ability = ability;
        this.level = level;
        this.order = order;
    }
    public applyOn(parent: unit): void {
        BCDummy.castOn(parent, this.ability, this.order, this.level);
    }
    public updateGraphical(parent: unit): void {
        if (BCScore.aquire(parent, 'buff', this) <= 0) {
            UnitRemoveBuffBJ(this.buff, parent);
        }
    }
    public checkAvailability(parent: unit): boolean {
        if (!UnitHasBuffBJ(parent, this.buff)) {
            if (this.hardLink) {
                return false;
            }
            this.applyOn(parent);
            return true;
        }
    }
}

/*
    行为原型：以行为原型为模板生成行为
    避免生成大量重复行为，便于行为的创建、读取
*/
class BCBehaviorPrototype {
    public static array = new Map<string, BCBehaviorPrototype>();
    public name: string;
    public link: BCBuffLink;
    public duration: number;
    public period: number;
    public onExpire: BCEffectGroup;
    public onPeriod: BCEffectGroup;
    public onApply: BCEffectGroup;
    public valiadors: BCValiadorGroup; // 验证失败时摧毁行为
    public sourceUnique: boolean; // 对同一个附加者来说只能存在一个该行为，可以用于限定行为数量，也可以单纯用于提高运行效率
    public targetUnique: boolean; // 对同一个被附加者来说只能存在一个该行为，可以用于限定行为数量，也可以单纯用于提高运行效率
    constructor(name: string, sourceUnique: boolean, targetUnique: boolean) {
        this.name = name;
        BCBehaviorPrototype.array.set(this.name, this);
        this.onExpire = new BCEffectGroup();
        this.onPeriod = new BCEffectGroup();
        this.onApply = new BCEffectGroup();
        this.valiadors = new BCValiadorGroup();
        this.sourceUnique = sourceUnique;
        this.targetUnique = targetUnique;
    }
    public linkBuff(hardLink: boolean, buff: number, ability: number, level: number, order: string): void {
        this.link = new BCBuffLink(hardLink, buff, ability, level, order);
    }
    public expireEffect(effect: BCEffect): void {
        this.onExpire.add(effect);
    }
    public periodEffect(effect: BCEffect): void {
        this.onPeriod.add(effect);
    }
    public applyEffect(effect: BCEffect): void {
        this.onApply.add(effect);
    }
    public addValiador(valiador: BCValiador): void {
        this.valiadors.add(valiador);
    }
}

/*
    行为：标记单位状态，为单位附加持续性效果
*/
class BCBehavior extends Map<string, any> {
    public static array = new Set<BCBehavior>();
    public static dustBin = new Set<BCBehavior>();
    public prototype: BCBehaviorPrototype;
    get name(): string {
        return this.prototype.name;
    }
    get link(): BCBuffLink {
        return this.prototype.link;
    }
    get duration(): number {
        return this.prototype.duration;
    }
    get period(): number {
        return this.prototype.period;
    }
    get onExpire(): BCEffectGroup {
        return this.prototype.onExpire;
    }
    get onPeriod(): BCEffectGroup {
        return this.prototype.onPeriod;
    }
    get onApply(): BCEffectGroup {
        return this.prototype.onApply;
    }
    get valiadors(): BCValiadorGroup {
        return this.prototype.valiadors;
    }
    get sourceUnique(): boolean {
        return this.prototype.sourceUnique
    }
    get targetUnique(): boolean {
        return this.prototype.targetUnique
    }
    public source: unit;
    public target: unit;
    public expired: number;
    public periodExpired: number;
    public flags: Set<string>;
    public value: number;
    constructor(prototype: BCBehaviorPrototype, source: unit, target: unit) {
        super();
        // Configuration
        this.prototype = prototype;
        this.source = source;
        this.target = target;
        this.value = 0;

        if (this.prototype.period) {
            this.periodExpired = 0;
        }
        if (this.prototype.duration) {
            this.expired = 0;
        }
        this.flags = new Set();

        // Add to storage
        BCBehavior.array.add(this);
        BCSet.add(this.source, 'behavior', 'source', this);
        BCSet.add(this.target, 'behavior', 'target', this);
        if (this.sourceUnique) {
            let behavior = BCStorage.aquire(false, undefined, [this.source, 'behavior', 'sourceUnique', this.prototype]);
            if (behavior) {
                behavior.finish();
            }
            BCStorage.write([this.source, 'behavior', 'sourceUnique', this.prototype], this);
        }
        if (this.targetUnique) {
            let behavior = BCStorage.aquire(false, undefined, [this.target, 'behavior', 'targetUnique', this.prototype]);
            if (behavior) {
                behavior.finish();
            }
            BCStorage.write([this.target, 'behavior', 'targetUnique', this.prototype], this);
        }

        // Apply Events
        if (this.prototype.link) {
            this.link.applyOn(this.target);
        }
        let event = new BCEvent('behaviorApply', this.source, this.target, this);
        this.onApply.execute(event);
    }
    public finish(): void {
        this.flags.add('destroying');
        BCBehavior.dustBin.add(this);
    }
    public destroy(): void {
        if (this.flags.has('destroyed')) {
            return;
        }
        this.flags.add('destroyed')
        BCSet.delete(this.source, 'behavior', 'source', this);
        BCSet.delete(this.target, 'behavior', 'target', this);
        if (this.sourceUnique) {
            let behavior = BCStorage.aquire(false, undefined, [this.source, 'behavior', 'sourceUnique', this.prototype]);
            if (behavior === this) {
                BCStorage.write([this.source, 'behavior', 'sourceUnique', this.prototype], undefined);
            }
        }
        if (this.targetUnique) {
            let behavior = BCStorage.aquire(false, undefined, [this.target, 'behavior', 'targetUnique', this.prototype]);
            if (behavior === this) {
                BCStorage.write([this.target, 'behavior', 'targetUnique', this.prototype], undefined);
            }
        }
        BCBehavior.array.delete(this);
        if (this.prototype.link) {
            this.link.updateGraphical(this.target);
        }
        let event = new BCEvent('behaviorDestroy', this.source, this.target, this);
        this.onExpire.execute(event);
    }
    public tick(): void {
        // Availability
        if (this.flags.has('destroying')) {
            return;
        }
        if (this.prototype.link) {
            if (!this.link.checkAvailability(this.target)) {
                this.finish();
                return;
            }
        }
        let event = new BCEvent('behaviorTick', this.source, this.target, this);
        if (!this.valiadors.execute(event)) {
            this.finish();
            return;
        }
        // Ticking
        if (this.period) {
            this.periodExpired += BCConstants.tick;
            if (this.periodExpired >= this.period) {
                this.onPeriod.execute(event);
                this.periodExpired = 0;
            }
        }
        if (this.duration) {
            this.expired += BCConstants.tick;
            if (this.expired >= this.duration) {
                this.finish();
                return;
            }
        }
        // Check Again
        if (this.prototype.link) {
            if (!this.link.checkAvailability(this.target)) {
                this.finish();
                return;
            }
        }
        if (!this.valiadors.execute(event)) {
            this.finish();
        }
    }
    /*
        查找指定原型的行为，默认查找被附加者为target的行为
        若source设定为true，则改为查找附加者为target的行为
        使用该方法查找原型具有对应唯一性的行为，效率更高
    */
    public static search(prototype: BCBehaviorPrototype, target: unit, source?: boolean): BCBehavior {
        if (!source) {
            if (prototype.targetUnique) {
                return BCStorage.aquire(false, undefined, [target, 'behavior', 'targetUnique', this.prototype]);
            }
            let storage = BCSet.aquire(target, 'behavior', 'target');
            storage.forEach(value => {
                if (value.prototype === prototype) {
                    return value;
                }
            });
            return undefined;
        }
        else {
            if (prototype.sourceUnique) {
                return BCStorage.aquire(false, undefined, [target, 'behavior', 'sourceUnique', this.prototype]);
            }
            let storage = BCSet.aquire(target, 'behavior', 'source');
            storage.forEach(value => {
                if (value.prototype === prototype) {
                    return value;
                }
            });
            return undefined;
        }
    }
    /*
        循环查找所有被标记为待摧毁的行为，将它们摧毁
        循环30次，或摧毁流程中没有产生新的待摧毁行为后，结束循环
    */
    public static recycle(): void {
        let control = 0;
        while (control < 30) {
            let array = [...BCBehavior.dustBin.values()]
            BCBehavior.dustBin.clear();
            for (let i = 0; i < array.length; i ++) {
                array[i].destroy();
            }
            if (BCBehavior.dustBin.size == 0) {
                control = 30;
            }
            control += 1;
        }
    }
}
BCApp.init(function() {
    let timer = CreateTimer();
    TimerStart(timer, BCConstants.tick, true, () => {
        BCBehavior.recycle();
        BCBehavior.array.forEach(value => {
            value.tick();
        });
        BCBehavior.recycle();
    });
});

/*
    世界信息：包括可用地图（map）和整个地图（world），记录地图大小及有关信息
*/
class BCWorld {
    public region: region;
    public rect: rect;
    public minX: number;
    public minY: number;
    public maxX: number;
    public maxY: number;
    public centerX: number;
    public centerY: number;
    public getRandomX(): number {
        return GetRandomReal(this.minX, this.maxX);
    }
    public getRandomY(): number {
        return GetRandomReal(this.minY, this.maxY);
    }
    public getBoundedValue(value: number, minV: string, maxV: string, margin: number): number {
        let min = this[minV] + margin;
        let max = this[maxV] - margin;
        return math.max(math.min(max, value), min);
    }
    public getBoundedX(x: number, margin: number): number {
        return this.getBoundedValue(x, "minX", "maxX", margin);
    }
    public getBoundedY(y: number, margin: number): number {
        return this.getBoundedValue(y, "minY", "maxY", margin);
    }
    public containsX(x: number): boolean {
        return this.getBoundedX(x, 0) == x;
    }
    public containsY(y: number): boolean {
        return this.getBoundedX(y, 0) == y;
    }
    constructor(rect: rect) {
        this.rect = rect;
        this.region = CreateRegion();
        this.minX = GetRectMinX(this.rect);
        this.minY = GetRectMinY(this.rect);
        this.maxX = GetRectMaxX(this.rect);
        this.maxY = GetRectMaxY(this.rect);
        this.centerX = (this.minX + this.maxX) / 2.00;
        this.centerY = (this.minY + this.maxY) / 2.00;
        RegionAddRect(this.region, this.rect);
    }
}
BCApp.init(function() {
    BCConstants.map = new BCWorld(bj_mapInitialPlayableArea);
    BCConstants.world = new BCWorld(GetWorldBounds());
});

/*
    假人：用于对单位施放无来源法术
    假人数据已经在示例地图中提供；所施放的法术必须无施法时间和法力消耗，施法范围为无限，且冷却时间为0.875秒（防止ai自动施法）
*/
let BCDummy = {
    pool: [],
    create: () => {
        let unit = CreateUnit(BCConstants.neutral, BCConstants.dummy, BCConstants.world.maxX, BCConstants.world.maxY, 0);
        BlzPauseUnitEx(unit, true);
        ShowUnit(unit, false);
        let timer = CreateTimer();
        TimerStart(timer, 0, false, () => {
            BCDummy.pool.push(unit);
            PauseTimer(timer);
            DestroyTimer(timer);
        });
    },
    recycle: (unit:unit) => {
        SetUnitX(unit, BCConstants.world.maxX);
        SetUnitY(unit, BCConstants.world.maxY);
        SetUnitOwner(unit, BCConstants.neutral, false);
        ShowUnit(unit, false);
        BlzPauseUnitEx(unit, true);
        let timer = CreateTimer();
        TimerStart(timer, 1, false, () => {
            BCDummy.pool.push(unit);
            PauseTimer(timer);
            DestroyTimer(timer);
        });
    },
    retrieve: (owner: player, x: number, y: number, z: number, face: number) => {
        if (BCDummy.pool.length > 0) {
            let unit = BCDummy.pool.shift();
            BlzPauseUnitEx(unit, false);
            ShowUnit(unit, true);
            SetUnitX(unit, x);
            SetUnitY(unit, y);
            SetUnitFlyHeight(unit, z, 0);
            BlzSetUnitFacingEx(unit, face * bj_RADTODEG);
            SetUnitOwner(unit, owner, false);
            return unit;
        }
        let unit = CreateUnit(owner, BCConstants.dummy, x, y, face * bj_RADTODEG);
        SetUnitFlyHeight(unit, z, 0);
        return unit;
    },
    castOn: (unit: unit, ability: number, order: string, level: number) => {
        let dummy = BCDummy.retrieve(GetOwningPlayer(unit), 0, 0, 0, 0);
        UnitAddAbility(dummy, ability);
        SetUnitAbilityLevel(dummy, ability, level);
        IssueTargetOrder(dummy, order, unit);
        UnitRemoveAbility(dummy, ability);
    },
}
BCApp.init(function() {
    let timer = CreateTimer();
    TimerStart(timer, 0, false, () => {
        for (let i = 0; i < 20; i ++) {
            BCDummy.create();
        }
    });
});

/*
    弹跳文字：生成弹跳的漂浮文字
*/
class BCPopup {
    public static array = new Set<BCPopup>();
    public static minSize = 0.016;
    public static bonSize = 0.008;
    public static timeLife = 0.75;
    public static timeFade = 0.5;
    public static zOffset = 50;
    public static bonZOffset = 50;
    public static velocity = 2.0;
    public duration: number;
    public fadePoint: number;
    public x: number;
    public y: number;
    public string: string;
    public sin: number;
    public cos: number;
    public height: number;
    public sizeMin: number;
    public sizeBonus: number;
    public tag: texttag;
    constructor(string: string, unit: unit, minSize: number = BCPopup.minSize, sizeBonus: number = BCPopup.bonSize, duration: number = BCPopup.timeLife,
    fadePoint: number = BCPopup.timeFade) {
        this.duration = duration;
        this.fadePoint = fadePoint;
        this.x = GetUnitX(unit);
        this.y = GetUnitY(unit);
        this.string = string;
        let angle = GetRandomReal(0, 2 * bj_PI);
        this.sin = Sin(angle) * BCPopup.velocity;
        this.cos = Cos(angle) * BCPopup.velocity;
        this.height = 0;
        this.sizeMin = minSize;
        this.sizeBonus = sizeBonus;
        if (IsUnitVisible(unit, GetLocalPlayer())) {
            this.tag = CreateTextTag();
            SetTextTagText(this.tag, string, this.sizeMin);
            SetTextTagPermanent(this.tag, true);
            SetTextTagLifespan(this.tag, this.duration);
            SetTextTagFadepoint(this.tag, this.fadePoint);
            SetTextTagPos(this.tag, this.x, this.y, BCPopup.zOffset);
        }
        BCPopup.array.add(this);
    }
    public tick(): void {
        let p = Sin(bj_PI * this.duration)
        this.duration -= BCConstants.tick;
        this.x += this.cos;
        this.y += this.sin;
        if (this.tag) {
            SetTextTagPos(this.tag, this.x, this.y, BCPopup.zOffset + BCPopup.bonZOffset * p);
            SetTextTagText(this.tag, this.string, this.sizeMin + this.sizeBonus * p);
        }
        if (this.duration <= 0.00) {
            if (this.tag) {
                DestroyTextTagBJ(this.tag);
            }
            BCPopup.array.delete(this);
        }
    }
}
BCApp.init(function() {
    let timer = CreateTimer();
    TimerStart(timer, BCConstants.tick, true, () => {
        let tags = [...BCPopup.array.values()];
        for (let i = 0; i < tags.length; i ++) {
            tags[i].tick();
        }
    });
});

/*
    伤害：造成和修改伤害
*/
class BCDamage extends BCEvent {
    public static attackTypeConsts: number[][] = [[1.00, 1.00, 1.00, 1.00, 1.00, 0.75, 0.05, 1.00], [1.00, 1.50, 1.00, 0.70, 1.00, 1.00, 0.05, 1.00],
    [2.00, 0.75, 1.00, 0.35, 1.00, 0.50, 0.05, 1.50], [1.00, 0.50, 1.00, 1.50, 1.00, 0.50, 0.05, 1.50], [1.25, 0.75, 2.00, 0.35, 1.00, 0.50, 0.05, 1.00],
    [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00], [1.00, 1.00, 1.00, 0.50, 1.00, 1.00, 0.05, 1.00]];
    public static ethernalConsts: number[] = [0, 0, 0, 1.66, 0, 1.66, 0];
    public static attackTypeIndexes = new Map<attacktype, number>([
        [ATTACK_TYPE_NORMAL, 0],
        [ATTACK_TYPE_MELEE, 0],
        [ATTACK_TYPE_PIERCE, 0],
        [ATTACK_TYPE_SIEGE, 0],
        [ATTACK_TYPE_MAGIC, 0],
        [ATTACK_TYPE_CHAOS, 0],
        [ATTACK_TYPE_HERO, 0],
    ]);
    public static damageCategories = new Map<damagetype, string>([ // 每种伤害类型对应的属性。属性包括：物理、冰霜、火焰、自然、奥术、神圣、暗影、混乱、无属性
        [DAMAGE_TYPE_NORMAL, 'physical'],
        [DAMAGE_TYPE_ENHANCED, 'physical'],
        [DAMAGE_TYPE_FIRE, 'fire'],
        [DAMAGE_TYPE_COLD, 'frost'],
        [DAMAGE_TYPE_LIGHTNING, 'natural'],
        [DAMAGE_TYPE_POISON, 'natural'],
        [DAMAGE_TYPE_DISEASE, 'natural'],
        [DAMAGE_TYPE_DIVINE, 'holy'],
        [DAMAGE_TYPE_MAGIC, 'arcane'],
        [DAMAGE_TYPE_SONIC, 'physical'],
        [DAMAGE_TYPE_ACID, 'natural'],
        [DAMAGE_TYPE_FORCE, 'physical'],
        [DAMAGE_TYPE_DEATH, 'shadow'],
        [DAMAGE_TYPE_MIND, 'shadow'],
        [DAMAGE_TYPE_PLANT, 'natural'],
        [DAMAGE_TYPE_DEFENSIVE, 'physical'],
        [DAMAGE_TYPE_DEMOLITION, 'physical'],
        [DAMAGE_TYPE_SLOW_POISON, 'natural'],
        [DAMAGE_TYPE_SPIRIT_LINK, 'universal'],
        [DAMAGE_TYPE_SHADOW_STRIKE, 'natural'],
        [DAMAGE_TYPE_UNIVERSAL, 'natural'],
    ]);
    public static damagePopupBase = 80.00;
    public static damagePopupSize = 0.020;
    public static event1a = new BCTrigger('unitDamagingStart');
    public static event1b = new BCTrigger('unitDamagedStart');
    public static event2a = new BCTrigger('unitDamagingModifier');
    public static event2b = new BCTrigger('unitDamagedModifier');
    public static event3a = new BCTrigger('unitDamagingFactor');
    public static event3b = new BCTrigger('unitDamagedFactor');
    public static event4a = new BCTrigger('unitDamagingLimit');
    public static event4b = new BCTrigger('unitDamagedLimit');
    public static event5a = new BCTrigger('unitDamagingFinal');
    public static event5b = new BCTrigger('unitDamagedFinal');
    public static event6a = new BCTrigger('unitDamagingAfter');
    public static event6b = new BCTrigger('unitDamagedAfter');
    constructor(source: unit, target: unit, value: number, attackType: attacktype, damagetype: damagetype, flags: Set<string>) {
        super('damage', source, target, undefined, value, [
            ['flags', flags],
            ['attackType', attackType],
            ['damageType', damagetype],
        ]);
        
        BCDamage.event1a.execute([GetOwningPlayer(this.source), this.source], this);
        BCDamage.event1b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        if (this.get('flags').has('attack') && BCConstants.flatDefense && !this.get('flags').has('ignoreDefense')) {
            this.value -= BlzGetUnitArmor(this.target);
        }
        BCDamage.event2a.execute([GetOwningPlayer(this.source), this.source], this);
        BCDamage.event2b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        if (this.get('flags').has('attack') && !BCConstants.flatDefense && !this.get('flags').has('ignoreDefense')) {
            let armor = BlzGetUnitArmor(this.target);
            if (armor >= 0) {
                armor *= 0.06;
                this.value *= 1.00 - armor / (1 + armor);
            }
            else {
                this.value *= 2 - Pow(0.94, -armor);
            }
        }
        if (!this.get('flags').has('ignoreArmor')) {
            this.value *= BCDamage.attackTypeConsts[BCDamage.attackTypeIndexes.get(this.get('attackType'))][BlzGetUnitIntegerField(this.target, UNIT_IF_DEFENSE_TYPE)];;
        }
        if (IsUnitType(this.target, UNIT_TYPE_ETHEREAL) && !this.get('flags').has('ignoreEthereal')) {
            this.value *= BCDamage.ethernalConsts[BCDamage.attackTypeIndexes.get(this.get('attackType'))];
        }
        BCDamage.event3a.execute([GetOwningPlayer(this.source), this.source], this);
        BCDamage.event3b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        BCDamage.event4a.execute([GetOwningPlayer(this.source), this.source], this);
        BCDamage.event4b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        BCDamage.event5a.execute([GetOwningPlayer(this.source), this.source], this);
        BCDamage.event5b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        if (BCConstants.popupValue) {
            let size = BCDamage.damagePopupSize;
            let fac = this.value / BCDamage.damagePopupBase;
    
            if (fac < 1 ) {
                size *= Pow(1.25, fac) - 0.25;
            }
            else {
                size *= 1.5 - 0.5 / fac;
            }

            if (this.get('flags').has('attack')) {
                new BCPopup('|cffff0000' + I2S(R2I(this.value)) + '|r', this.target, size, size * 0.50);
            }
            else {
                new BCPopup('|cffff00ff' + I2S(R2I(this.value)) + '|r', this.target, size, size * 0.50);
            }
        }

        UnitDamageTarget(this.source, this.target, this.value, false, false, ATTACK_TYPE_CHAOS, DAMAGE_TYPE_UNKNOWN, WEAPON_TYPE_WHOKNOWS);

        BCDamage.event6a.execute([GetOwningPlayer(this.source), this.source], this);
        BCDamage.event6b.execute([GetOwningPlayer(this.target), this.target], this);
    }
    public static response(): void {
        let damage = GetEventDamage();
        let damageType = BlzGetEventDamageType();
        if (damage == 0 || damageType == DAMAGE_TYPE_UNKNOWN) {
            return;
        }
        if (damage < 0.001) {
            BlzSetEventDamage(0.00);
            return;
        }
        let flags = new Set<string>();
        let attackType = BlzGetEventAttackType()
        if (attackType == ATTACK_TYPE_NORMAL) {
            flags.add('spell');
        }
        else {
            flags.add('attack');
        }
        flags.add(BCDamage.damageCategories.get(damageType));
        new BCDamage(GetEventDamageSource(), GetTriggerUnit(), damage, attackType, damageType, flags);
        BlzSetEventDamage(0.00);
    }
}
BCApp.init(function() {
    let trigger = CreateTrigger();
    TriggerRegisterAnyUnitEventBJ(trigger, EVENT_PLAYER_UNIT_DAMAGED);
    TriggerAddCondition(trigger, Filter(() => {
        BCDamage.response();
        return false;
    }));
});

/*
    恢复：为单位恢复生命值或法力值
    也可以自行定义其他恢复类型
*/
class BCRestore extends BCEvent {
    public static ethernalConst = 1.66;
    public static damagePopupBase = 160.00;
    public static damagePopupSize = 0.020;
    public static event1a = new BCTrigger('unitRestoringStart');
    public static event1b = new BCTrigger('unitRestoredStart');
    public static event2a = new BCTrigger('unitRestoringModifier');
    public static event2b = new BCTrigger('unitRestoredModifier');
    public static event3a = new BCTrigger('unitRestoringFactor');
    public static event3b = new BCTrigger('unitRestoredFactor');
    public static event4a = new BCTrigger('unitRestoringLimit');
    public static event4b = new BCTrigger('unitRestoredLimit');
    public static event5a = new BCTrigger('unitRestoringFinal');
    public static event5b = new BCTrigger('unitRestoredFinal');
    public static event6a = new BCTrigger('unitRestoringAfter');
    public static event6b = new BCTrigger('unitRestoredAfter');
    constructor(source: unit, target: unit, value: number, type: string, flags: Set<string>) {
        super('restore', source, target, undefined, value, [
            ['type', type],
            ['flags', flags],
        ]);

        BCRestore.event1a.execute([GetOwningPlayer(this.source), this.source], this);
        BCRestore.event1b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        BCRestore.event2a.execute([GetOwningPlayer(this.source), this.source], this);
        BCRestore.event2b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        if (IsUnitType(this.target, UNIT_TYPE_ETHEREAL) && !this.get('flags').has('ignoreEthereal')) {
            this.value *= BCRestore.ethernalConst;
        }
        BCRestore.event3a.execute([GetOwningPlayer(this.source), this.source], this);
        BCRestore.event3b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        BCRestore.event4a.execute([GetOwningPlayer(this.source), this.source], this);
        BCRestore.event4b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        BCRestore.event5a.execute([GetOwningPlayer(this.source), this.source], this);
        BCRestore.event5b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;

        if (BCConstants.popupValue) {
            let size = BCRestore.damagePopupSize;
            let fac = this.value / BCRestore.damagePopupBase;
    
            if (fac < 1 ) {
                size *= Pow(1.25, fac) - 0.25;
            }
            else {
                size *= 1.5 - 0.5 / fac;
            }
            
            if (this.get('type') == 'health') {
                new BCPopup('|cff00ff00' + I2S(R2I(this.value)) + '|r', this.target, size, size * 0.50);
            }
            else if (this.get('type') == 'mana') {
                new BCPopup('|cff00ffff' + I2S(R2I(this.value)) + '|r', this.target, size, size * 0.50);
            }
        }

        if (this.get('type') == 'health') {
            SetUnitLifeBJ(this.target, GetUnitState(this.target, UNIT_STATE_LIFE) + this.value);
        }
        else if (this.get('type') == 'mana') {
            SetUnitManaBJ(this.target, GetUnitState(this.target, UNIT_STATE_MANA) + this.value);
        }

        BCRestore.event6a.execute([GetOwningPlayer(this.source), this.source], this);
        BCRestore.event6b.execute([GetOwningPlayer(this.target), this.target], this);
        if (this.value < 0) return;
    }
}

/*
    单位管理：单位创建、死亡、移除时执行某些效果
    单位死亡后3秒（召唤单位）、28秒（建筑）、88秒（单位）后执行移除操作，1秒后删除该单位的数据并进行移除，如果修改了腐化时间，请将这些数字修改为对应单位类型的腐化时间减去2
    不建议对已经开始移除操作准备的单位做任何动作，尤其是带有持续时间的动作
    请在所有持续性效果（尤其是行为）的验证器中验证单位是否被移除，判断方法为BCUnit.array.has(单位)，这些效果必须在单位移除操作完成前执行完毕，否则会造成脚本执行中止
    假人单位不受单位管理的影响
*/
let BCUnit = {
    array: new Set<unit>(),
    initEvent: new BCTrigger('unitInit'),
    killEvent: new BCTrigger('unitKill'),
    deathEvent: new BCTrigger('unitDeath'),
    clearEvent: new BCTrigger('unitDecay'),
}
BCApp.init(function() {
    let triggerOne = CreateTrigger();
    TriggerRegisterEnterRectSimple(triggerOne, GetWorldBounds());
    TriggerAddCondition(triggerOne, Filter(() => {
        let unit = GetTriggerUnit()
        if (GetUnitTypeId(unit) == BCConstants.dummy) {
            return false;
        }
        if (BCUnit.array.has(unit)) {
            return false;
        }
        BCUnit.array.add(unit);
        let event = new BCEvent('initUnit', unit, unit);
        BCUnit.initEvent.execute([GetOwningPlayer(unit), unit], event);
        return false;
    }));
    let triggerTwo = CreateTrigger();
    TriggerRegisterAnyUnitEventBJ(triggerTwo, EVENT_PLAYER_UNIT_DEATH);
    TriggerAddCondition(triggerTwo, Filter(() => {
        let unit = GetTriggerUnit();
        let killer = GetKillingUnit();
        if (!killer) {
            killer = unit;
        }
        let event = new BCEvent('unitKilled', killer, unit);
        BCUnit.killEvent.execute([GetOwningPlayer(killer), killer], event);
        BCUnit.deathEvent.execute([GetOwningPlayer(unit), unit], event);
        if (IsUnitType(unit, UNIT_TYPE_HERO)) {
            return false;
        }
        if (BCUnit.array.has(unit)) {
            BCUnit.array.delete(unit);
            if (IsUnitType(unit, UNIT_TYPE_SUMMONED)) {
                let timer = CreateTimer();
                TimerStart(timer, 3.00, false, () => {
                    let event = new BCEvent('unitDecay', unit, unit);
                    BCUnit.clearEvent.execute([GetOwningPlayer(unit), unit], event);
                    let timer2 = CreateTimer();
                    TimerStart(timer2, 1.00, false, () => {
                        BCStorage.write([unit], undefined);
                        RemoveUnit(this.target);
                        PauseTimer(timer2);
                        DestroyTimer(timer2);
                    });
                    ShowUnit(unit, false);
                    PauseTimer(timer);
                    DestroyTimer(timer);
                });
            }
            else if (IsUnitType(unit, UNIT_TYPE_STRUCTURE)) {
                let timer = CreateTimer();
                TimerStart(timer, 28.00, false, () => {
                    let event = new BCEvent('unitDecay', unit, unit);
                    BCUnit.clearEvent.execute([GetOwningPlayer(unit), unit], event);
                    let timer2 = CreateTimer();
                    TimerStart(timer2, 1.00, false, () => {
                        BCStorage.write([unit], undefined);
                        RemoveUnit(this.target);
                        PauseTimer(timer2);
                        DestroyTimer(timer2);
                    });
                    ShowUnit(unit, false);
                    PauseTimer(timer);
                    DestroyTimer(timer);
                });
            }
            else {
                let timer = CreateTimer();
                TimerStart(timer, 88.00, false, () => {
                    let event = new BCEvent('unitDecay', unit, unit);
                    BCUnit.clearEvent.execute([GetOwningPlayer(unit), unit], event);
                    let timer2 = CreateTimer();
                    TimerStart(timer2, 1.00, false, () => {
                        BCStorage.write([unit], undefined);
                        RemoveUnit(this.target);
                        PauseTimer(timer2);
                        DestroyTimer(timer2);
                    });
                    ShowUnit(unit, false);
                    PauseTimer(timer);
                    DestroyTimer(timer);
                });
            }
        }
        return false;
    }));
});
BCApp.load(function() {
    let group = CreateGroup();
    GroupEnumUnitsInRect(group, GetWorldBounds(), Filter(() => true));
    for (let i = 0; i < BlzGroupGetSize(group); i ++) {
        let unit = BlzGroupUnitAt(group, i);
        if (GetUnitTypeId(unit) == BCConstants.dummy) {
            continue;
        }
        if (BCUnit.array.has(unit)) {
            continue;
        }
        BCUnit.array.add(unit);
        let event = new BCEvent('initUnit', unit, unit);
        BCUnit.initEvent.execute([GetOwningPlayer(unit), unit], event);
    }
});

/*
    投射物系统
    详见missile.lua，使用时将该库复制到触发器中作为自定义脚本
*/
let RelativisticMissiles = {
    setProperty: (missile: missile, property: string, value: any[]) => {
        _setMissileProperty(missile, property, value);
    },
    triggerMethod: (missile: missile, method: string, ...args: any[]) => _triggerMissileMethod(missile, method, ...args),
    create: (x: number, y: number, z: number, toX: number, toY: number, toZ: number) => _createMissile(x, y, z, toX, toY, toZ),
}


let BCConstants = {
    tick: 0.031250000, // 每隔多长时间系统进行一次计算
    dummy: FourCC('e000'),
    neutral: Player(PLAYER_NEUTRAL_PASSIVE),
    world: undefined,
    map: undefined,
    flatDefense: false, // 若设置为true，则防御值将转而直接对伤害值进行减成，其效果类似星际争霸中的护甲
    popupValue: true, // 若设置为false，则伤害值和恢复值不会再以弹跳文字的形式显示
    valiadors: {
        exist: new BCValiador(function(this: any, thisEvent: BCEvent) {
            return thisEvent.source && thisEvent.target;
        }, 'exist'),
        sourceAlive: new BCValiador(function(this: any, thisEvent: BCEvent) {
            return UnitAlive(thisEvent.source);
        }, 'sourceAlive'),
        targetAlive: new BCValiador(function(this: any, thisEvent: BCEvent) {
            return UnitAlive(thisEvent.target);
        }, 'targetAlive'),
        isAlly: new BCValiador(function(this: any, thisEvent: BCEvent) {
            return IsUnitAlly(thisEvent.source, GetOwningPlayer(thisEvent.target));
        }, 'isAlly'),
        isEnemy: new BCValiador(function(this: any, thisEvent: BCEvent) {
            return IsUnitEnemy(thisEvent.source, GetOwningPlayer(thisEvent.target));
        }, 'isEnemy'),
    },
}

export {BCFunc, BCConstants, BCApp, BCFolder, BCStorage, BCEvent, BCValiador, BCValiadorGroup, BCEffect, BCEffectGroup, BCScore, BCSet, BCRange,
BCAttribute, BCTrigger, BCTriggerGenerator, BCBuffLink, BCBehaviorPrototype, BCBehavior, BCWorld, BCDummy, BCPopup, BCDamage, BCRestore, BCUnit,
RelativisticMissiles};
/* Modules: BCFunc, BCConstants, BCApp, BCFolder, BCStorage, BCEvent, BCValiador, BCValiadorGroup, BCEffect, BCEffectGroup, BCScore, BCSet, BCRange,
BCAttribute, BCTrigger, BCTriggerGenerator, BCBehaviorPrototype, BCBuffLink, BCBehavior, BCDamage, BCRestore, BCDummy, BCUnit, BCWorld, RelativisticMissiles
BCPopup... */