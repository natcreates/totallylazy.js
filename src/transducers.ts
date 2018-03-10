if (typeof Symbol.asyncIterator == 'undefined') {
    (Symbol as any).asyncIterator = Symbol.for("Symbol.asyncIterator");
}

export interface Contract<A> {
    map<B>(mapper: Mapper<A, B>): Contract<B>;

    filter(predicate: Predicate<A>): Contract<A>;

    find(predicate: Predicate<A>): Contract<A>;

    first(): Contract<A>;

    last(): Contract<A>;

    take(count: number): Contract<A>;

    takeWhile(predicate: Predicate<A>): Contract<A>;

    scan<B>(reducer: Reducer<A, B>): Contract<B>;

    reduce<B>(reducer: Reducer<A, B>): Contract<B>;
}

export abstract class Transducer<A, B> implements Contract<B> {
    abstract async_(iterable: AsyncIterable<A>): AsyncIterable<B>;

    abstract sync(iterable: Iterable<A>): Iterable<B>;

    compose<C>(other: Transducer<B, C>): Transducer<A, C> {
        return compose(other, this);
    }

    decompose(): Transducer<any, any>[] {
        return decompose(this);
    }

    map<C>(mapper: Mapper<B, C>): Transducer<A, C> {
        return map(mapper, this);
    }

    filter(predicate: Predicate<B>): Transducer<A, B> {
        return filter(predicate, this);
    }

    find(predicate: Predicate<B>): Transducer<A, B> {
        return find(predicate, this);
    }

    first(): Transducer<A, B> {
        return first(this);
    }

    last(): Transducer<A, B> {
        return last(this);
    }

    take(count: number): Transducer<A, B> {
        return take(count, this);
    }

    takeWhile(predicate: Predicate<B>): Transducer<A, B> {
        return takeWhile(predicate, this);
    }

    scan<C>(reducer: Reducer<B, C>): Transducer<A, C> {
        return scan(reducer, this);
    }

    reduce<C>(reducer: Reducer<B, C>): Transducer<A, C> {
        return reduce(reducer, this);
    }
}

export class IdentityTransducer<A> extends Transducer<A, A> {
    async_(iterable: AsyncIterable<A>): AsyncIterable<A> {
        return iterable;
    }

    sync(iterable: Iterable<A>): Iterable<A> {
        return iterable;
    }
}

export function identity<A>(): IdentityTransducer<A> {
    return new IdentityTransducer()
}

// alias
export function transducer<A>(): IdentityTransducer<A> {
    return identity()
}

export class FirstTransducer<A> extends Transducer<A, A> {
    async * async_(iterable: AsyncIterable<A>): AsyncIterable<A> {
        for await (const a of iterable) {
            yield a;
            return;
        }
    }

    * sync(iterable: Iterable<A>): Iterable<A> {
        for (const a of iterable) {
            yield a;
            return;
        }
    }
}

export function first<A, B>(transducer: Transducer<A, B>): Transducer<A, B> {
    return compose(new FirstTransducer(), transducer);
}

export class LastTransducer<A> extends Transducer<A, A> {
    async * async_(iterable: AsyncIterable<A>): AsyncIterable<A> {
        let last;
        for await (last of iterable);
        if (last !== undefined) yield last;
    }

    * sync(iterable: Iterable<A>): Iterable<A> {
        let last;
        for (last of iterable);
        if (last !== undefined) yield last;
    }
}

export function last<A, B>(transducer: Transducer<A, B>): Transducer<A, B> {
    return compose(new LastTransducer(), transducer);
}

export type Mapper<A, B> = (a: A) => B;

export class MapTransducer<A, B> extends Transducer<A, B> {
    constructor(public mapper: Mapper<A, B>) {
        super();
    }

    async * async_(iterable: AsyncIterable<A>): AsyncIterable<B> {
        for await (const a of iterable) {
            yield this.mapper(a);
        }
    }

    * sync(iterable: Iterable<A>): Iterable<B> {
        for (const a of iterable) {
            yield this.mapper(a);
        }
    }
}

export function map<A, B, C>(mapper: Mapper<B, C>, transducer: Transducer<A, B>): Transducer<A, C> {
    return compose(new MapTransducer(mapper), transducer);
}

export type Predicate<A> = (a: A) => boolean;

export class FilterTransducer<A> extends Transducer<A, A> {
    constructor(public predicate: Predicate<A>) {
        super();
    }

    async * async_(iterable: AsyncIterable<A>): AsyncIterable<A> {
        for await (const a of iterable) {
            if (this.predicate(a)) yield a;
        }
    }

    * sync(iterable: Iterable<A>): Iterable<A> {
        for (const a of iterable) {
            if (this.predicate(a)) yield a;
        }
    }
}

export function filter<A, B>(predicate: Predicate<B>, transducer: Transducer<A, B>): Transducer<A, B> {
    return compose(new FilterTransducer(predicate), transducer);
}

export function find<A, B>(predicate: Predicate<B>, transducer: Transducer<A, B>): Transducer<A, B> {
    return first(filter(predicate, transducer));
}

export class CompositeTransducer<A, B, C> extends Transducer<A, C> {
    constructor(public a: Transducer<A, B>, public b: Transducer<B, C>) {
        super();
    }

    async_(iterator: AsyncIterable<A>): AsyncIterable<C> {
        return this.b.async_(this.a.async_(iterator));
    }

    sync(iterator: Iterable<A>): Iterable<C> {
        return this.b.sync(this.a.sync(iterator));
    }
}

export function compose<A, B, C>(b: Transducer<B, C>, a: Transducer<A, B>): CompositeTransducer<A, B, C> {
    return new CompositeTransducer(a, b);
}

export function decompose(transducer: Transducer<any, any>): Transducer<any, any>[] {
    if (transducer instanceof CompositeTransducer) {
        const compositeTransducer = transducer as CompositeTransducer<any, any, any>;
        return [...decompose(compositeTransducer.a), ...decompose(compositeTransducer.b)];
    }
    return [transducer];
}

export interface Reducer<A, B> {
    call(accumilator: B, instance: A): B;

    identity(): B;
}

export class ScanTransducer<A, B> extends Transducer<A, B> {
    constructor(public reducer: Reducer<A, B>, public accumilator: B = reducer.identity()) {
        super();
    }

    async * async_(iterable: AsyncIterable<A>): AsyncIterable<B> {
        for await (const a of iterable) {
            yield this.accumilator = this.reducer.call(this.accumilator, a);
        }
    }

    * sync(iterable: Iterable<A>): Iterable<B> {
        for (const a of iterable) {
            yield this.accumilator = this.reducer.call(this.accumilator, a);
        }
    }
}

export function scan<A, B, C>(reducer: Reducer<B, C>, transducer: Transducer<A, B>): Transducer<A, C> {
    return compose(new ScanTransducer(reducer), transducer);
}

export function reduce<A, B, C>(reducer: Reducer<B, C>, transducer: Transducer<A, B>): Transducer<A, C> {
    return last(scan(reducer, transducer));
}

export class TakeTransducer<A> extends Transducer<A, A> {
    constructor(public count: number) {
        super();
    }

    async * async_(iterable: AsyncIterable<A>): AsyncIterable<A> {
        if (this.count == 0) return;
        for await (const a of iterable) {
            yield a;
            if ((--this.count) == 0) return;
        }
    }

    * sync(iterable: Iterable<A>): Iterable<A> {
        if (this.count == 0) return;
        for (const a of iterable) {
            yield a;
            if ((--this.count) == 0) return;
        }
    }
}

export function take<A, B>(count: number, transducer: Transducer<A, B>): Transducer<A, B> {
    return compose(new TakeTransducer(count), transducer);
}


export class TakeWhileTransducer<A> extends Transducer<A, A> {
    constructor(public predicate: Predicate<A>) {
        super();
    }

    async * async_(iterable: AsyncIterable<A>): AsyncIterable<A> {
        for await (const a of iterable) {
            if (this.predicate(a)) yield a;
            else return;
        }
    }

    * sync(iterable: Iterable<A>): Iterable<A> {
        for (const a of iterable) {
            if (this.predicate(a)) yield a;
            else return;
        }
    }
}

export function takeWhile<A, B>(predicate: Predicate<B>, transducer: Transducer<A, B>): Transducer<A, B> {
    return compose(new TakeWhileTransducer(predicate), transducer);
}

export class Sum implements Reducer<number, number> {
    call(a: number, b: number): number {
        return a + b;
    }

    identity(): number {
        return 0;
    }
}

export const sum = new Sum();

export function* iterable<T>(...t: T[]): IterableIterator<T> {
    yield* t;
}

export async function asyncArray<T>(iterable: AsyncIterable<T>): Promise<T[]> {
    const result: T[] = [];
    for await (const value of iterable) result.push(value);
    return result;
}

export function syncArray<T>(iterable: Iterable<T>): T[] {
    return [...iterable];
}


export function iterate<T>(generator: (t: T) => T, value: T): Sequence<T> {
    return sequence(function* () {
        while (true) {
            yield value;
            value = generator(value);
        }
    })
}

export function repeat<T>(generator: () => T): Sequence<T> {
    return sequence(function* () {
        while (true) {
            yield generator();
        }
    });
}

export function increment(a: number): number {
    return a + 1;
}

export function add(a: number): (b: number) => number;
export function add(a: number, b: number): number;
export function add(a: number, b?: number) {
    if (b === undefined) return (b: number) => a + b;
    else return a + b;
}

export function subtract(a: number): (b: number) => number;
export function subtract(a: number, b: number): number;
export function subtract(a: number, b?: number) {
    if (b === undefined) return (b: number) => b - a;
    else return a - b;
}

export function range(start: number, end?: number, step: number = 1): Sequence<number> {
    return sequence(function* () {
        if (end === undefined) yield* iterate(increment, start);
        else {
            const absoluteStep = Math.abs(step);
            if (end < start) yield* iterate(subtract(absoluteStep), start).takeWhile(n => n >= end);
            else yield* iterate(add(absoluteStep), start).takeWhile(n => n <= end);
        }
    });
}

export class Sequence<A> implements Iterable<A>, Contract<A> {
    private constructor(public iterable: Iterable<any>, public transducer: Transducer<any, A> = identity()) {
    }

    static of<A>(iterable: Iterable<A>): Sequence<A>;
    static of<B, A>(iterable: Iterable<B>, transducer: Transducer<B, A>): Sequence<A>;
    static of<B, A>(iterable: Iterable<B>, transducer?: Transducer<B, A>) {
        return new Sequence<A>(iterable, transducer);
    }

    [Symbol.iterator](): Iterator<A> {
        return this.transducer.sync(this.iterable)[Symbol.iterator]()
    }

    map<B>(mapper: Mapper<A, B>): Sequence<B> {
        return sequence(this.iterable, this.transducer.map(mapper));
    }

    filter(predicate: Predicate<A>): Sequence<A> {
        return sequence(this.iterable, this.transducer.filter(predicate));
    }

    find(predicate: Predicate<A>): Sequence<A> {
        return sequence(this.iterable, this.transducer.find(predicate));
    }

    first(): Sequence<A> {
        return sequence(this.iterable, this.transducer.first());
    }

    last(): Sequence<A> {
        return sequence(this.iterable, this.transducer.first());
    }

    take(count: number): Sequence<A> {
        return sequence(this.iterable, this.transducer.take(count));
    }

    takeWhile(predicate: Predicate<A>): Sequence<A> {
        return sequence(this.iterable, this.transducer.takeWhile(predicate));
    }

    scan<B>(reducer: Reducer<A, B>): Sequence<B> {
        return sequence(this.iterable, this.transducer.scan(reducer));
    }

    reduce<B>(reducer: Reducer<A, B>): Sequence<B> {
        return sequence(this.iterable, this.transducer.reduce(reducer));
    }
}

export class AsyncSequence<A> implements AsyncIterable<A>, Contract<A> {
    private constructor(public iterable: AsyncIterable<any>, public transducer: Transducer<any, A> = identity()) {
    }

    static of<A>(iterable: AsyncIterable<A>): AsyncSequence<A>;
    static of<B, A>(iterable: AsyncIterable<B>, transducer: Transducer<B, A>): AsyncSequence<A>;
    static of<B, A>(iterable: AsyncIterable<B>, transducer?: Transducer<B, A>) {
        return new AsyncSequence<A>(iterable, transducer);
    }

    [Symbol.asyncIterator](): AsyncIterator<A> {
        return this.transducer.async_(this.iterable)[Symbol.asyncIterator]()
    }

    map<B>(mapper: Mapper<A, B>): AsyncSequence<B> {
        return sequence(this.iterable, this.transducer.map(mapper));
    }

    filter(predicate: Predicate<A>): AsyncSequence<A> {
        return sequence(this.iterable, this.transducer.filter(predicate));
    }

    find(predicate: Predicate<A>): AsyncSequence<A> {
        return sequence(this.iterable, this.transducer.find(predicate));
    }

    first(): AsyncSequence<A> {
        return sequence(this.iterable, this.transducer.first());
    }

    last(): AsyncSequence<A> {
        return sequence(this.iterable, this.transducer.last());
    }

    take(count: number): AsyncSequence<A> {
        return sequence(this.iterable, this.transducer.take(count));
    }

    takeWhile(predicate: Predicate<A>): AsyncSequence<A> {
        return sequence(this.iterable, this.transducer.takeWhile(predicate));
    }

    scan<B>(reducer: Reducer<A, B>): AsyncSequence<B> {
        return sequence(this.iterable, this.transducer.scan(reducer));
    }

    reduce<B>(reducer: Reducer<A, B>): AsyncSequence<B> {
        return sequence(this.iterable, this.transducer.reduce(reducer));
    }
}

type IterableGenerator<A> = () => IterableIterator<A>;
type AsyncIterableGenerator<A> = () => AsyncIterableIterator<A>;
type Source<A> = Iterable<A> | AsyncIterable<A> | IterableGenerator<A> | AsyncIterableGenerator<A>;

export function sequence<A>(iterable: IterableGenerator<A>): Sequence<A>;
export function sequence<A>(iterable: AsyncIterableGenerator<A>): AsyncSequence<A>;
export function sequence<A>(iterable: Iterable<A>): Sequence<A>;
export function sequence<A>(iterable: AsyncIterable<A>): AsyncSequence<A>;
export function sequence<A, B>(iterable: Iterable<B>, transducer: Transducer<B, A>): Sequence<A>;
export function sequence<A, B>(iterable: AsyncIterable<B>, transducer: Transducer<B, A>): AsyncSequence<A>;
export function sequence(iterable: Source<any>, transducer?: Transducer<any, any>) {
    if (typeof iterable == 'function') iterable = iterable();
    if (typeof transducer == 'undefined') {
        if (isIterable(iterable)) return Sequence.of(iterable);
        if (isAsyncIterable(iterable)) return AsyncSequence.of(iterable);
    } else {
        if (isIterable(iterable)) return Sequence.of(iterable, transducer);
        if (isAsyncIterable(iterable)) return AsyncSequence.of(iterable, transducer);
    }
}

function isIterable(instance: any): instance is Iterable<any> {
    return (<Iterable<any>>instance)[Symbol.iterator] !== undefined;
}

function isAsyncIterable(instance: any): instance is AsyncIterable<any> {
    return (<AsyncIterable<any>>instance)[Symbol.asyncIterator] !== undefined;
}

