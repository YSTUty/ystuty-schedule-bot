export {};

declare global {
  type Mutable<T> = { -readonly [P in keyof T]: T[P] };

  type DeepMutable<T> = T extends object
    ? Mutable<T> & { [P in keyof T]: DeepMutable<T[P]> }
    : T;

  type DeepPartial<T> = T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T;

  /**
   * Construct a type with the properties of T except for those in type K.
   */
  type OmitT<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

  type Optional<T, K extends keyof T> = OmitT<T, K> & Partial<Pick<T, K>>;
  type NullableAll<T> = { [P in keyof T]: T[P] | null };
  type Nullable<T, K extends keyof T> = OmitT<T, K> & { [P in K]: T[P] | null };

  type Defined<T> = { [K in keyof T]: undefined extends T[K] ? never : T[K] };
  type DefinedValues<T> = Pick<T, keyof Defined<T>>;

  interface ObjectConstructor {
    keys<T extends object>(o: T): (keyof T)[];
  }

  type Any = {} | undefined | null;

  type Expand<T> = T extends object
    ? T extends infer O
      ? { [K in keyof O]: O[K] }
      : never
    : T;

  type MaybeArray<T> = T | T[];
  type MaybePromise<T> = T | Promise<T>;
  type NonemptyReadonlyArray<T> = readonly [T, ...T[]];

  // prettier-ignore
  type ExclusiveKeys<A extends object, B extends object> = keyof Omit<A, keyof B>;
}
