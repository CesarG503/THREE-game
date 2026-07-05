
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model GameMap
 * 
 */
export type GameMap = $Result.DefaultSelection<Prisma.$GameMapPayload>
/**
 * Model RawEvent
 * 
 */
export type RawEvent = $Result.DefaultSelection<Prisma.$RawEventPayload>
/**
 * Model PlayerFeatures
 * 
 */
export type PlayerFeatures = $Result.DefaultSelection<Prisma.$PlayerFeaturesPayload>
/**
 * Model MapFeatures
 * 
 */
export type MapFeatures = $Result.DefaultSelection<Prisma.$MapFeaturesPayload>
/**
 * Model SocialAffinity
 * 
 */
export type SocialAffinity = $Result.DefaultSelection<Prisma.$SocialAffinityPayload>
/**
 * Model FatiguedMap
 * 
 */
export type FatiguedMap = $Result.DefaultSelection<Prisma.$FatiguedMapPayload>
/**
 * Model DataQuarantine
 * 
 */
export type DataQuarantine = $Result.DefaultSelection<Prisma.$DataQuarantinePayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.gameMap`: Exposes CRUD operations for the **GameMap** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more GameMaps
    * const gameMaps = await prisma.gameMap.findMany()
    * ```
    */
  get gameMap(): Prisma.GameMapDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.rawEvent`: Exposes CRUD operations for the **RawEvent** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RawEvents
    * const rawEvents = await prisma.rawEvent.findMany()
    * ```
    */
  get rawEvent(): Prisma.RawEventDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.playerFeatures`: Exposes CRUD operations for the **PlayerFeatures** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PlayerFeatures
    * const playerFeatures = await prisma.playerFeatures.findMany()
    * ```
    */
  get playerFeatures(): Prisma.PlayerFeaturesDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.mapFeatures`: Exposes CRUD operations for the **MapFeatures** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more MapFeatures
    * const mapFeatures = await prisma.mapFeatures.findMany()
    * ```
    */
  get mapFeatures(): Prisma.MapFeaturesDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.socialAffinity`: Exposes CRUD operations for the **SocialAffinity** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SocialAffinities
    * const socialAffinities = await prisma.socialAffinity.findMany()
    * ```
    */
  get socialAffinity(): Prisma.SocialAffinityDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.fatiguedMap`: Exposes CRUD operations for the **FatiguedMap** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more FatiguedMaps
    * const fatiguedMaps = await prisma.fatiguedMap.findMany()
    * ```
    */
  get fatiguedMap(): Prisma.FatiguedMapDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.dataQuarantine`: Exposes CRUD operations for the **DataQuarantine** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more DataQuarantines
    * const dataQuarantines = await prisma.dataQuarantine.findMany()
    * ```
    */
  get dataQuarantine(): Prisma.DataQuarantineDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.8.0
   * Query Engine version: 3c6e192761c0362d496ed980de936e2f3cebcd3a
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    GameMap: 'GameMap',
    RawEvent: 'RawEvent',
    PlayerFeatures: 'PlayerFeatures',
    MapFeatures: 'MapFeatures',
    SocialAffinity: 'SocialAffinity',
    FatiguedMap: 'FatiguedMap',
    DataQuarantine: 'DataQuarantine'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "gameMap" | "rawEvent" | "playerFeatures" | "mapFeatures" | "socialAffinity" | "fatiguedMap" | "dataQuarantine"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      GameMap: {
        payload: Prisma.$GameMapPayload<ExtArgs>
        fields: Prisma.GameMapFieldRefs
        operations: {
          findUnique: {
            args: Prisma.GameMapFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.GameMapFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload>
          }
          findFirst: {
            args: Prisma.GameMapFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.GameMapFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload>
          }
          findMany: {
            args: Prisma.GameMapFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload>[]
          }
          create: {
            args: Prisma.GameMapCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload>
          }
          createMany: {
            args: Prisma.GameMapCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.GameMapCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload>[]
          }
          delete: {
            args: Prisma.GameMapDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload>
          }
          update: {
            args: Prisma.GameMapUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload>
          }
          deleteMany: {
            args: Prisma.GameMapDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.GameMapUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.GameMapUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload>[]
          }
          upsert: {
            args: Prisma.GameMapUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$GameMapPayload>
          }
          aggregate: {
            args: Prisma.GameMapAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGameMap>
          }
          groupBy: {
            args: Prisma.GameMapGroupByArgs<ExtArgs>
            result: $Utils.Optional<GameMapGroupByOutputType>[]
          }
          count: {
            args: Prisma.GameMapCountArgs<ExtArgs>
            result: $Utils.Optional<GameMapCountAggregateOutputType> | number
          }
        }
      }
      RawEvent: {
        payload: Prisma.$RawEventPayload<ExtArgs>
        fields: Prisma.RawEventFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RawEventFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RawEventFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload>
          }
          findFirst: {
            args: Prisma.RawEventFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RawEventFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload>
          }
          findMany: {
            args: Prisma.RawEventFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload>[]
          }
          create: {
            args: Prisma.RawEventCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload>
          }
          createMany: {
            args: Prisma.RawEventCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RawEventCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload>[]
          }
          delete: {
            args: Prisma.RawEventDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload>
          }
          update: {
            args: Prisma.RawEventUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload>
          }
          deleteMany: {
            args: Prisma.RawEventDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RawEventUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.RawEventUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload>[]
          }
          upsert: {
            args: Prisma.RawEventUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RawEventPayload>
          }
          aggregate: {
            args: Prisma.RawEventAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRawEvent>
          }
          groupBy: {
            args: Prisma.RawEventGroupByArgs<ExtArgs>
            result: $Utils.Optional<RawEventGroupByOutputType>[]
          }
          count: {
            args: Prisma.RawEventCountArgs<ExtArgs>
            result: $Utils.Optional<RawEventCountAggregateOutputType> | number
          }
        }
      }
      PlayerFeatures: {
        payload: Prisma.$PlayerFeaturesPayload<ExtArgs>
        fields: Prisma.PlayerFeaturesFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PlayerFeaturesFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PlayerFeaturesFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload>
          }
          findFirst: {
            args: Prisma.PlayerFeaturesFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PlayerFeaturesFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload>
          }
          findMany: {
            args: Prisma.PlayerFeaturesFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload>[]
          }
          create: {
            args: Prisma.PlayerFeaturesCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload>
          }
          createMany: {
            args: Prisma.PlayerFeaturesCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PlayerFeaturesCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload>[]
          }
          delete: {
            args: Prisma.PlayerFeaturesDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload>
          }
          update: {
            args: Prisma.PlayerFeaturesUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload>
          }
          deleteMany: {
            args: Prisma.PlayerFeaturesDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PlayerFeaturesUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PlayerFeaturesUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload>[]
          }
          upsert: {
            args: Prisma.PlayerFeaturesUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlayerFeaturesPayload>
          }
          aggregate: {
            args: Prisma.PlayerFeaturesAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePlayerFeatures>
          }
          groupBy: {
            args: Prisma.PlayerFeaturesGroupByArgs<ExtArgs>
            result: $Utils.Optional<PlayerFeaturesGroupByOutputType>[]
          }
          count: {
            args: Prisma.PlayerFeaturesCountArgs<ExtArgs>
            result: $Utils.Optional<PlayerFeaturesCountAggregateOutputType> | number
          }
        }
      }
      MapFeatures: {
        payload: Prisma.$MapFeaturesPayload<ExtArgs>
        fields: Prisma.MapFeaturesFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MapFeaturesFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MapFeaturesFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload>
          }
          findFirst: {
            args: Prisma.MapFeaturesFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MapFeaturesFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload>
          }
          findMany: {
            args: Prisma.MapFeaturesFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload>[]
          }
          create: {
            args: Prisma.MapFeaturesCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload>
          }
          createMany: {
            args: Prisma.MapFeaturesCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MapFeaturesCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload>[]
          }
          delete: {
            args: Prisma.MapFeaturesDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload>
          }
          update: {
            args: Prisma.MapFeaturesUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload>
          }
          deleteMany: {
            args: Prisma.MapFeaturesDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MapFeaturesUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MapFeaturesUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload>[]
          }
          upsert: {
            args: Prisma.MapFeaturesUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MapFeaturesPayload>
          }
          aggregate: {
            args: Prisma.MapFeaturesAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMapFeatures>
          }
          groupBy: {
            args: Prisma.MapFeaturesGroupByArgs<ExtArgs>
            result: $Utils.Optional<MapFeaturesGroupByOutputType>[]
          }
          count: {
            args: Prisma.MapFeaturesCountArgs<ExtArgs>
            result: $Utils.Optional<MapFeaturesCountAggregateOutputType> | number
          }
        }
      }
      SocialAffinity: {
        payload: Prisma.$SocialAffinityPayload<ExtArgs>
        fields: Prisma.SocialAffinityFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SocialAffinityFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SocialAffinityFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload>
          }
          findFirst: {
            args: Prisma.SocialAffinityFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SocialAffinityFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload>
          }
          findMany: {
            args: Prisma.SocialAffinityFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload>[]
          }
          create: {
            args: Prisma.SocialAffinityCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload>
          }
          createMany: {
            args: Prisma.SocialAffinityCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SocialAffinityCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload>[]
          }
          delete: {
            args: Prisma.SocialAffinityDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload>
          }
          update: {
            args: Prisma.SocialAffinityUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload>
          }
          deleteMany: {
            args: Prisma.SocialAffinityDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SocialAffinityUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SocialAffinityUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload>[]
          }
          upsert: {
            args: Prisma.SocialAffinityUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SocialAffinityPayload>
          }
          aggregate: {
            args: Prisma.SocialAffinityAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSocialAffinity>
          }
          groupBy: {
            args: Prisma.SocialAffinityGroupByArgs<ExtArgs>
            result: $Utils.Optional<SocialAffinityGroupByOutputType>[]
          }
          count: {
            args: Prisma.SocialAffinityCountArgs<ExtArgs>
            result: $Utils.Optional<SocialAffinityCountAggregateOutputType> | number
          }
        }
      }
      FatiguedMap: {
        payload: Prisma.$FatiguedMapPayload<ExtArgs>
        fields: Prisma.FatiguedMapFieldRefs
        operations: {
          findUnique: {
            args: Prisma.FatiguedMapFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.FatiguedMapFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload>
          }
          findFirst: {
            args: Prisma.FatiguedMapFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.FatiguedMapFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload>
          }
          findMany: {
            args: Prisma.FatiguedMapFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload>[]
          }
          create: {
            args: Prisma.FatiguedMapCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload>
          }
          createMany: {
            args: Prisma.FatiguedMapCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.FatiguedMapCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload>[]
          }
          delete: {
            args: Prisma.FatiguedMapDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload>
          }
          update: {
            args: Prisma.FatiguedMapUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload>
          }
          deleteMany: {
            args: Prisma.FatiguedMapDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.FatiguedMapUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.FatiguedMapUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload>[]
          }
          upsert: {
            args: Prisma.FatiguedMapUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$FatiguedMapPayload>
          }
          aggregate: {
            args: Prisma.FatiguedMapAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateFatiguedMap>
          }
          groupBy: {
            args: Prisma.FatiguedMapGroupByArgs<ExtArgs>
            result: $Utils.Optional<FatiguedMapGroupByOutputType>[]
          }
          count: {
            args: Prisma.FatiguedMapCountArgs<ExtArgs>
            result: $Utils.Optional<FatiguedMapCountAggregateOutputType> | number
          }
        }
      }
      DataQuarantine: {
        payload: Prisma.$DataQuarantinePayload<ExtArgs>
        fields: Prisma.DataQuarantineFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DataQuarantineFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DataQuarantineFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload>
          }
          findFirst: {
            args: Prisma.DataQuarantineFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DataQuarantineFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload>
          }
          findMany: {
            args: Prisma.DataQuarantineFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload>[]
          }
          create: {
            args: Prisma.DataQuarantineCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload>
          }
          createMany: {
            args: Prisma.DataQuarantineCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DataQuarantineCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload>[]
          }
          delete: {
            args: Prisma.DataQuarantineDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload>
          }
          update: {
            args: Prisma.DataQuarantineUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload>
          }
          deleteMany: {
            args: Prisma.DataQuarantineDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DataQuarantineUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.DataQuarantineUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload>[]
          }
          upsert: {
            args: Prisma.DataQuarantineUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DataQuarantinePayload>
          }
          aggregate: {
            args: Prisma.DataQuarantineAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDataQuarantine>
          }
          groupBy: {
            args: Prisma.DataQuarantineGroupByArgs<ExtArgs>
            result: $Utils.Optional<DataQuarantineGroupByOutputType>[]
          }
          count: {
            args: Prisma.DataQuarantineCountArgs<ExtArgs>
            result: $Utils.Optional<DataQuarantineCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    gameMap?: GameMapOmit
    rawEvent?: RawEventOmit
    playerFeatures?: PlayerFeaturesOmit
    mapFeatures?: MapFeaturesOmit
    socialAffinity?: SocialAffinityOmit
    fatiguedMap?: FatiguedMapOmit
    dataQuarantine?: DataQuarantineOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    events: number
    socialAffinity1: number
    socialAffinity2: number
    fatiguedMaps: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    events?: boolean | UserCountOutputTypeCountEventsArgs
    socialAffinity1?: boolean | UserCountOutputTypeCountSocialAffinity1Args
    socialAffinity2?: boolean | UserCountOutputTypeCountSocialAffinity2Args
    fatiguedMaps?: boolean | UserCountOutputTypeCountFatiguedMapsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountEventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RawEventWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSocialAffinity1Args<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SocialAffinityWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSocialAffinity2Args<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SocialAffinityWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountFatiguedMapsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FatiguedMapWhereInput
  }


  /**
   * Count Type GameMapCountOutputType
   */

  export type GameMapCountOutputType = {
    fatiguedPlayers: number
  }

  export type GameMapCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    fatiguedPlayers?: boolean | GameMapCountOutputTypeCountFatiguedPlayersArgs
  }

  // Custom InputTypes
  /**
   * GameMapCountOutputType without action
   */
  export type GameMapCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMapCountOutputType
     */
    select?: GameMapCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * GameMapCountOutputType without action
   */
  export type GameMapCountOutputTypeCountFatiguedPlayersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FatiguedMapWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    email: string | null
    username: string | null
    displayName: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    username: string | null
    displayName: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    username: number
    displayName: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    username?: true
    displayName?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    username?: true
    displayName?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    username?: true
    displayName?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    email: string
    username: string
    displayName: string | null
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    username?: boolean
    displayName?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    events?: boolean | User$eventsArgs<ExtArgs>
    playerFeatures?: boolean | User$playerFeaturesArgs<ExtArgs>
    socialAffinity1?: boolean | User$socialAffinity1Args<ExtArgs>
    socialAffinity2?: boolean | User$socialAffinity2Args<ExtArgs>
    fatiguedMaps?: boolean | User$fatiguedMapsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    username?: boolean
    displayName?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    username?: boolean
    displayName?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    username?: boolean
    displayName?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "username" | "displayName" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    events?: boolean | User$eventsArgs<ExtArgs>
    playerFeatures?: boolean | User$playerFeaturesArgs<ExtArgs>
    socialAffinity1?: boolean | User$socialAffinity1Args<ExtArgs>
    socialAffinity2?: boolean | User$socialAffinity2Args<ExtArgs>
    fatiguedMaps?: boolean | User$fatiguedMapsArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      events: Prisma.$RawEventPayload<ExtArgs>[]
      playerFeatures: Prisma.$PlayerFeaturesPayload<ExtArgs> | null
      socialAffinity1: Prisma.$SocialAffinityPayload<ExtArgs>[]
      socialAffinity2: Prisma.$SocialAffinityPayload<ExtArgs>[]
      fatiguedMaps: Prisma.$FatiguedMapPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string
      username: string
      displayName: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    events<T extends User$eventsArgs<ExtArgs> = {}>(args?: Subset<T, User$eventsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    playerFeatures<T extends User$playerFeaturesArgs<ExtArgs> = {}>(args?: Subset<T, User$playerFeaturesArgs<ExtArgs>>): Prisma__PlayerFeaturesClient<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    socialAffinity1<T extends User$socialAffinity1Args<ExtArgs> = {}>(args?: Subset<T, User$socialAffinity1Args<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    socialAffinity2<T extends User$socialAffinity2Args<ExtArgs> = {}>(args?: Subset<T, User$socialAffinity2Args<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    fatiguedMaps<T extends User$fatiguedMapsArgs<ExtArgs> = {}>(args?: Subset<T, User$fatiguedMapsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly username: FieldRef<"User", 'String'>
    readonly displayName: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.events
   */
  export type User$eventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    where?: RawEventWhereInput
    orderBy?: RawEventOrderByWithRelationInput | RawEventOrderByWithRelationInput[]
    cursor?: RawEventWhereUniqueInput
    take?: number
    skip?: number
    distinct?: RawEventScalarFieldEnum | RawEventScalarFieldEnum[]
  }

  /**
   * User.playerFeatures
   */
  export type User$playerFeaturesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    where?: PlayerFeaturesWhereInput
  }

  /**
   * User.socialAffinity1
   */
  export type User$socialAffinity1Args<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    where?: SocialAffinityWhereInput
    orderBy?: SocialAffinityOrderByWithRelationInput | SocialAffinityOrderByWithRelationInput[]
    cursor?: SocialAffinityWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SocialAffinityScalarFieldEnum | SocialAffinityScalarFieldEnum[]
  }

  /**
   * User.socialAffinity2
   */
  export type User$socialAffinity2Args<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    where?: SocialAffinityWhereInput
    orderBy?: SocialAffinityOrderByWithRelationInput | SocialAffinityOrderByWithRelationInput[]
    cursor?: SocialAffinityWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SocialAffinityScalarFieldEnum | SocialAffinityScalarFieldEnum[]
  }

  /**
   * User.fatiguedMaps
   */
  export type User$fatiguedMapsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    where?: FatiguedMapWhereInput
    orderBy?: FatiguedMapOrderByWithRelationInput | FatiguedMapOrderByWithRelationInput[]
    cursor?: FatiguedMapWhereUniqueInput
    take?: number
    skip?: number
    distinct?: FatiguedMapScalarFieldEnum | FatiguedMapScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model GameMap
   */

  export type AggregateGameMap = {
    _count: GameMapCountAggregateOutputType | null
    _min: GameMapMinAggregateOutputType | null
    _max: GameMapMaxAggregateOutputType | null
  }

  export type GameMapMinAggregateOutputType = {
    id: string | null
    slug: string | null
    name: string | null
    ownerId: string | null
    isPublished: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GameMapMaxAggregateOutputType = {
    id: string | null
    slug: string | null
    name: string | null
    ownerId: string | null
    isPublished: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type GameMapCountAggregateOutputType = {
    id: number
    slug: number
    name: number
    ownerId: number
    isPublished: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type GameMapMinAggregateInputType = {
    id?: true
    slug?: true
    name?: true
    ownerId?: true
    isPublished?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GameMapMaxAggregateInputType = {
    id?: true
    slug?: true
    name?: true
    ownerId?: true
    isPublished?: true
    createdAt?: true
    updatedAt?: true
  }

  export type GameMapCountAggregateInputType = {
    id?: true
    slug?: true
    name?: true
    ownerId?: true
    isPublished?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type GameMapAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GameMap to aggregate.
     */
    where?: GameMapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GameMaps to fetch.
     */
    orderBy?: GameMapOrderByWithRelationInput | GameMapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: GameMapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GameMaps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GameMaps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned GameMaps
    **/
    _count?: true | GameMapCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: GameMapMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: GameMapMaxAggregateInputType
  }

  export type GetGameMapAggregateType<T extends GameMapAggregateArgs> = {
        [P in keyof T & keyof AggregateGameMap]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGameMap[P]>
      : GetScalarType<T[P], AggregateGameMap[P]>
  }




  export type GameMapGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: GameMapWhereInput
    orderBy?: GameMapOrderByWithAggregationInput | GameMapOrderByWithAggregationInput[]
    by: GameMapScalarFieldEnum[] | GameMapScalarFieldEnum
    having?: GameMapScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: GameMapCountAggregateInputType | true
    _min?: GameMapMinAggregateInputType
    _max?: GameMapMaxAggregateInputType
  }

  export type GameMapGroupByOutputType = {
    id: string
    slug: string
    name: string
    ownerId: string | null
    isPublished: boolean
    createdAt: Date
    updatedAt: Date
    _count: GameMapCountAggregateOutputType | null
    _min: GameMapMinAggregateOutputType | null
    _max: GameMapMaxAggregateOutputType | null
  }

  type GetGameMapGroupByPayload<T extends GameMapGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<GameMapGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof GameMapGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], GameMapGroupByOutputType[P]>
            : GetScalarType<T[P], GameMapGroupByOutputType[P]>
        }
      >
    >


  export type GameMapSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    slug?: boolean
    name?: boolean
    ownerId?: boolean
    isPublished?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    mapFeatures?: boolean | GameMap$mapFeaturesArgs<ExtArgs>
    fatiguedPlayers?: boolean | GameMap$fatiguedPlayersArgs<ExtArgs>
    _count?: boolean | GameMapCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["gameMap"]>

  export type GameMapSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    slug?: boolean
    name?: boolean
    ownerId?: boolean
    isPublished?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["gameMap"]>

  export type GameMapSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    slug?: boolean
    name?: boolean
    ownerId?: boolean
    isPublished?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["gameMap"]>

  export type GameMapSelectScalar = {
    id?: boolean
    slug?: boolean
    name?: boolean
    ownerId?: boolean
    isPublished?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type GameMapOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "slug" | "name" | "ownerId" | "isPublished" | "createdAt" | "updatedAt", ExtArgs["result"]["gameMap"]>
  export type GameMapInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    mapFeatures?: boolean | GameMap$mapFeaturesArgs<ExtArgs>
    fatiguedPlayers?: boolean | GameMap$fatiguedPlayersArgs<ExtArgs>
    _count?: boolean | GameMapCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type GameMapIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type GameMapIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $GameMapPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "GameMap"
    objects: {
      mapFeatures: Prisma.$MapFeaturesPayload<ExtArgs> | null
      fatiguedPlayers: Prisma.$FatiguedMapPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      slug: string
      name: string
      ownerId: string | null
      isPublished: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["gameMap"]>
    composites: {}
  }

  type GameMapGetPayload<S extends boolean | null | undefined | GameMapDefaultArgs> = $Result.GetResult<Prisma.$GameMapPayload, S>

  type GameMapCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<GameMapFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: GameMapCountAggregateInputType | true
    }

  export interface GameMapDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['GameMap'], meta: { name: 'GameMap' } }
    /**
     * Find zero or one GameMap that matches the filter.
     * @param {GameMapFindUniqueArgs} args - Arguments to find a GameMap
     * @example
     * // Get one GameMap
     * const gameMap = await prisma.gameMap.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends GameMapFindUniqueArgs>(args: SelectSubset<T, GameMapFindUniqueArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one GameMap that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {GameMapFindUniqueOrThrowArgs} args - Arguments to find a GameMap
     * @example
     * // Get one GameMap
     * const gameMap = await prisma.gameMap.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends GameMapFindUniqueOrThrowArgs>(args: SelectSubset<T, GameMapFindUniqueOrThrowArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GameMap that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GameMapFindFirstArgs} args - Arguments to find a GameMap
     * @example
     * // Get one GameMap
     * const gameMap = await prisma.gameMap.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends GameMapFindFirstArgs>(args?: SelectSubset<T, GameMapFindFirstArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first GameMap that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GameMapFindFirstOrThrowArgs} args - Arguments to find a GameMap
     * @example
     * // Get one GameMap
     * const gameMap = await prisma.gameMap.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends GameMapFindFirstOrThrowArgs>(args?: SelectSubset<T, GameMapFindFirstOrThrowArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more GameMaps that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GameMapFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all GameMaps
     * const gameMaps = await prisma.gameMap.findMany()
     * 
     * // Get first 10 GameMaps
     * const gameMaps = await prisma.gameMap.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const gameMapWithIdOnly = await prisma.gameMap.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends GameMapFindManyArgs>(args?: SelectSubset<T, GameMapFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a GameMap.
     * @param {GameMapCreateArgs} args - Arguments to create a GameMap.
     * @example
     * // Create one GameMap
     * const GameMap = await prisma.gameMap.create({
     *   data: {
     *     // ... data to create a GameMap
     *   }
     * })
     * 
     */
    create<T extends GameMapCreateArgs>(args: SelectSubset<T, GameMapCreateArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many GameMaps.
     * @param {GameMapCreateManyArgs} args - Arguments to create many GameMaps.
     * @example
     * // Create many GameMaps
     * const gameMap = await prisma.gameMap.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends GameMapCreateManyArgs>(args?: SelectSubset<T, GameMapCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many GameMaps and returns the data saved in the database.
     * @param {GameMapCreateManyAndReturnArgs} args - Arguments to create many GameMaps.
     * @example
     * // Create many GameMaps
     * const gameMap = await prisma.gameMap.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many GameMaps and only return the `id`
     * const gameMapWithIdOnly = await prisma.gameMap.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends GameMapCreateManyAndReturnArgs>(args?: SelectSubset<T, GameMapCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a GameMap.
     * @param {GameMapDeleteArgs} args - Arguments to delete one GameMap.
     * @example
     * // Delete one GameMap
     * const GameMap = await prisma.gameMap.delete({
     *   where: {
     *     // ... filter to delete one GameMap
     *   }
     * })
     * 
     */
    delete<T extends GameMapDeleteArgs>(args: SelectSubset<T, GameMapDeleteArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one GameMap.
     * @param {GameMapUpdateArgs} args - Arguments to update one GameMap.
     * @example
     * // Update one GameMap
     * const gameMap = await prisma.gameMap.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends GameMapUpdateArgs>(args: SelectSubset<T, GameMapUpdateArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more GameMaps.
     * @param {GameMapDeleteManyArgs} args - Arguments to filter GameMaps to delete.
     * @example
     * // Delete a few GameMaps
     * const { count } = await prisma.gameMap.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends GameMapDeleteManyArgs>(args?: SelectSubset<T, GameMapDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GameMaps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GameMapUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many GameMaps
     * const gameMap = await prisma.gameMap.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends GameMapUpdateManyArgs>(args: SelectSubset<T, GameMapUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more GameMaps and returns the data updated in the database.
     * @param {GameMapUpdateManyAndReturnArgs} args - Arguments to update many GameMaps.
     * @example
     * // Update many GameMaps
     * const gameMap = await prisma.gameMap.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more GameMaps and only return the `id`
     * const gameMapWithIdOnly = await prisma.gameMap.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends GameMapUpdateManyAndReturnArgs>(args: SelectSubset<T, GameMapUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one GameMap.
     * @param {GameMapUpsertArgs} args - Arguments to update or create a GameMap.
     * @example
     * // Update or create a GameMap
     * const gameMap = await prisma.gameMap.upsert({
     *   create: {
     *     // ... data to create a GameMap
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the GameMap we want to update
     *   }
     * })
     */
    upsert<T extends GameMapUpsertArgs>(args: SelectSubset<T, GameMapUpsertArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of GameMaps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GameMapCountArgs} args - Arguments to filter GameMaps to count.
     * @example
     * // Count the number of GameMaps
     * const count = await prisma.gameMap.count({
     *   where: {
     *     // ... the filter for the GameMaps we want to count
     *   }
     * })
    **/
    count<T extends GameMapCountArgs>(
      args?: Subset<T, GameMapCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], GameMapCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a GameMap.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GameMapAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends GameMapAggregateArgs>(args: Subset<T, GameMapAggregateArgs>): Prisma.PrismaPromise<GetGameMapAggregateType<T>>

    /**
     * Group by GameMap.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GameMapGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends GameMapGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: GameMapGroupByArgs['orderBy'] }
        : { orderBy?: GameMapGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, GameMapGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGameMapGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the GameMap model
   */
  readonly fields: GameMapFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for GameMap.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__GameMapClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    mapFeatures<T extends GameMap$mapFeaturesArgs<ExtArgs> = {}>(args?: Subset<T, GameMap$mapFeaturesArgs<ExtArgs>>): Prisma__MapFeaturesClient<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    fatiguedPlayers<T extends GameMap$fatiguedPlayersArgs<ExtArgs> = {}>(args?: Subset<T, GameMap$fatiguedPlayersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the GameMap model
   */
  interface GameMapFieldRefs {
    readonly id: FieldRef<"GameMap", 'String'>
    readonly slug: FieldRef<"GameMap", 'String'>
    readonly name: FieldRef<"GameMap", 'String'>
    readonly ownerId: FieldRef<"GameMap", 'String'>
    readonly isPublished: FieldRef<"GameMap", 'Boolean'>
    readonly createdAt: FieldRef<"GameMap", 'DateTime'>
    readonly updatedAt: FieldRef<"GameMap", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * GameMap findUnique
   */
  export type GameMapFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
    /**
     * Filter, which GameMap to fetch.
     */
    where: GameMapWhereUniqueInput
  }

  /**
   * GameMap findUniqueOrThrow
   */
  export type GameMapFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
    /**
     * Filter, which GameMap to fetch.
     */
    where: GameMapWhereUniqueInput
  }

  /**
   * GameMap findFirst
   */
  export type GameMapFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
    /**
     * Filter, which GameMap to fetch.
     */
    where?: GameMapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GameMaps to fetch.
     */
    orderBy?: GameMapOrderByWithRelationInput | GameMapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GameMaps.
     */
    cursor?: GameMapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GameMaps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GameMaps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GameMaps.
     */
    distinct?: GameMapScalarFieldEnum | GameMapScalarFieldEnum[]
  }

  /**
   * GameMap findFirstOrThrow
   */
  export type GameMapFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
    /**
     * Filter, which GameMap to fetch.
     */
    where?: GameMapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GameMaps to fetch.
     */
    orderBy?: GameMapOrderByWithRelationInput | GameMapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for GameMaps.
     */
    cursor?: GameMapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GameMaps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GameMaps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GameMaps.
     */
    distinct?: GameMapScalarFieldEnum | GameMapScalarFieldEnum[]
  }

  /**
   * GameMap findMany
   */
  export type GameMapFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
    /**
     * Filter, which GameMaps to fetch.
     */
    where?: GameMapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of GameMaps to fetch.
     */
    orderBy?: GameMapOrderByWithRelationInput | GameMapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing GameMaps.
     */
    cursor?: GameMapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` GameMaps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` GameMaps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of GameMaps.
     */
    distinct?: GameMapScalarFieldEnum | GameMapScalarFieldEnum[]
  }

  /**
   * GameMap create
   */
  export type GameMapCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
    /**
     * The data needed to create a GameMap.
     */
    data: XOR<GameMapCreateInput, GameMapUncheckedCreateInput>
  }

  /**
   * GameMap createMany
   */
  export type GameMapCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many GameMaps.
     */
    data: GameMapCreateManyInput | GameMapCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * GameMap createManyAndReturn
   */
  export type GameMapCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * The data used to create many GameMaps.
     */
    data: GameMapCreateManyInput | GameMapCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * GameMap update
   */
  export type GameMapUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
    /**
     * The data needed to update a GameMap.
     */
    data: XOR<GameMapUpdateInput, GameMapUncheckedUpdateInput>
    /**
     * Choose, which GameMap to update.
     */
    where: GameMapWhereUniqueInput
  }

  /**
   * GameMap updateMany
   */
  export type GameMapUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update GameMaps.
     */
    data: XOR<GameMapUpdateManyMutationInput, GameMapUncheckedUpdateManyInput>
    /**
     * Filter which GameMaps to update
     */
    where?: GameMapWhereInput
    /**
     * Limit how many GameMaps to update.
     */
    limit?: number
  }

  /**
   * GameMap updateManyAndReturn
   */
  export type GameMapUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * The data used to update GameMaps.
     */
    data: XOR<GameMapUpdateManyMutationInput, GameMapUncheckedUpdateManyInput>
    /**
     * Filter which GameMaps to update
     */
    where?: GameMapWhereInput
    /**
     * Limit how many GameMaps to update.
     */
    limit?: number
  }

  /**
   * GameMap upsert
   */
  export type GameMapUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
    /**
     * The filter to search for the GameMap to update in case it exists.
     */
    where: GameMapWhereUniqueInput
    /**
     * In case the GameMap found by the `where` argument doesn't exist, create a new GameMap with this data.
     */
    create: XOR<GameMapCreateInput, GameMapUncheckedCreateInput>
    /**
     * In case the GameMap was found with the provided `where` argument, update it with this data.
     */
    update: XOR<GameMapUpdateInput, GameMapUncheckedUpdateInput>
  }

  /**
   * GameMap delete
   */
  export type GameMapDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
    /**
     * Filter which GameMap to delete.
     */
    where: GameMapWhereUniqueInput
  }

  /**
   * GameMap deleteMany
   */
  export type GameMapDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which GameMaps to delete
     */
    where?: GameMapWhereInput
    /**
     * Limit how many GameMaps to delete.
     */
    limit?: number
  }

  /**
   * GameMap.mapFeatures
   */
  export type GameMap$mapFeaturesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    where?: MapFeaturesWhereInput
  }

  /**
   * GameMap.fatiguedPlayers
   */
  export type GameMap$fatiguedPlayersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    where?: FatiguedMapWhereInput
    orderBy?: FatiguedMapOrderByWithRelationInput | FatiguedMapOrderByWithRelationInput[]
    cursor?: FatiguedMapWhereUniqueInput
    take?: number
    skip?: number
    distinct?: FatiguedMapScalarFieldEnum | FatiguedMapScalarFieldEnum[]
  }

  /**
   * GameMap without action
   */
  export type GameMapDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the GameMap
     */
    select?: GameMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the GameMap
     */
    omit?: GameMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: GameMapInclude<ExtArgs> | null
  }


  /**
   * Model RawEvent
   */

  export type AggregateRawEvent = {
    _count: RawEventCountAggregateOutputType | null
    _min: RawEventMinAggregateOutputType | null
    _max: RawEventMaxAggregateOutputType | null
  }

  export type RawEventMinAggregateOutputType = {
    id: string | null
    eventType: string | null
    userId: string | null
    timestamp: Date | null
  }

  export type RawEventMaxAggregateOutputType = {
    id: string | null
    eventType: string | null
    userId: string | null
    timestamp: Date | null
  }

  export type RawEventCountAggregateOutputType = {
    id: number
    eventType: number
    userId: number
    timestamp: number
    payload: number
    _all: number
  }


  export type RawEventMinAggregateInputType = {
    id?: true
    eventType?: true
    userId?: true
    timestamp?: true
  }

  export type RawEventMaxAggregateInputType = {
    id?: true
    eventType?: true
    userId?: true
    timestamp?: true
  }

  export type RawEventCountAggregateInputType = {
    id?: true
    eventType?: true
    userId?: true
    timestamp?: true
    payload?: true
    _all?: true
  }

  export type RawEventAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RawEvent to aggregate.
     */
    where?: RawEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RawEvents to fetch.
     */
    orderBy?: RawEventOrderByWithRelationInput | RawEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RawEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RawEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RawEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RawEvents
    **/
    _count?: true | RawEventCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RawEventMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RawEventMaxAggregateInputType
  }

  export type GetRawEventAggregateType<T extends RawEventAggregateArgs> = {
        [P in keyof T & keyof AggregateRawEvent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRawEvent[P]>
      : GetScalarType<T[P], AggregateRawEvent[P]>
  }




  export type RawEventGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RawEventWhereInput
    orderBy?: RawEventOrderByWithAggregationInput | RawEventOrderByWithAggregationInput[]
    by: RawEventScalarFieldEnum[] | RawEventScalarFieldEnum
    having?: RawEventScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RawEventCountAggregateInputType | true
    _min?: RawEventMinAggregateInputType
    _max?: RawEventMaxAggregateInputType
  }

  export type RawEventGroupByOutputType = {
    id: string
    eventType: string
    userId: string | null
    timestamp: Date
    payload: JsonValue
    _count: RawEventCountAggregateOutputType | null
    _min: RawEventMinAggregateOutputType | null
    _max: RawEventMaxAggregateOutputType | null
  }

  type GetRawEventGroupByPayload<T extends RawEventGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RawEventGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RawEventGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RawEventGroupByOutputType[P]>
            : GetScalarType<T[P], RawEventGroupByOutputType[P]>
        }
      >
    >


  export type RawEventSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    eventType?: boolean
    userId?: boolean
    timestamp?: boolean
    payload?: boolean
    user?: boolean | RawEvent$userArgs<ExtArgs>
  }, ExtArgs["result"]["rawEvent"]>

  export type RawEventSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    eventType?: boolean
    userId?: boolean
    timestamp?: boolean
    payload?: boolean
    user?: boolean | RawEvent$userArgs<ExtArgs>
  }, ExtArgs["result"]["rawEvent"]>

  export type RawEventSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    eventType?: boolean
    userId?: boolean
    timestamp?: boolean
    payload?: boolean
    user?: boolean | RawEvent$userArgs<ExtArgs>
  }, ExtArgs["result"]["rawEvent"]>

  export type RawEventSelectScalar = {
    id?: boolean
    eventType?: boolean
    userId?: boolean
    timestamp?: boolean
    payload?: boolean
  }

  export type RawEventOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "eventType" | "userId" | "timestamp" | "payload", ExtArgs["result"]["rawEvent"]>
  export type RawEventInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | RawEvent$userArgs<ExtArgs>
  }
  export type RawEventIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | RawEvent$userArgs<ExtArgs>
  }
  export type RawEventIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | RawEvent$userArgs<ExtArgs>
  }

  export type $RawEventPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RawEvent"
    objects: {
      user: Prisma.$UserPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      eventType: string
      userId: string | null
      timestamp: Date
      payload: Prisma.JsonValue
    }, ExtArgs["result"]["rawEvent"]>
    composites: {}
  }

  type RawEventGetPayload<S extends boolean | null | undefined | RawEventDefaultArgs> = $Result.GetResult<Prisma.$RawEventPayload, S>

  type RawEventCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<RawEventFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RawEventCountAggregateInputType | true
    }

  export interface RawEventDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RawEvent'], meta: { name: 'RawEvent' } }
    /**
     * Find zero or one RawEvent that matches the filter.
     * @param {RawEventFindUniqueArgs} args - Arguments to find a RawEvent
     * @example
     * // Get one RawEvent
     * const rawEvent = await prisma.rawEvent.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RawEventFindUniqueArgs>(args: SelectSubset<T, RawEventFindUniqueArgs<ExtArgs>>): Prisma__RawEventClient<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one RawEvent that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RawEventFindUniqueOrThrowArgs} args - Arguments to find a RawEvent
     * @example
     * // Get one RawEvent
     * const rawEvent = await prisma.rawEvent.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RawEventFindUniqueOrThrowArgs>(args: SelectSubset<T, RawEventFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RawEventClient<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RawEvent that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RawEventFindFirstArgs} args - Arguments to find a RawEvent
     * @example
     * // Get one RawEvent
     * const rawEvent = await prisma.rawEvent.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RawEventFindFirstArgs>(args?: SelectSubset<T, RawEventFindFirstArgs<ExtArgs>>): Prisma__RawEventClient<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RawEvent that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RawEventFindFirstOrThrowArgs} args - Arguments to find a RawEvent
     * @example
     * // Get one RawEvent
     * const rawEvent = await prisma.rawEvent.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RawEventFindFirstOrThrowArgs>(args?: SelectSubset<T, RawEventFindFirstOrThrowArgs<ExtArgs>>): Prisma__RawEventClient<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more RawEvents that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RawEventFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RawEvents
     * const rawEvents = await prisma.rawEvent.findMany()
     * 
     * // Get first 10 RawEvents
     * const rawEvents = await prisma.rawEvent.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const rawEventWithIdOnly = await prisma.rawEvent.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RawEventFindManyArgs>(args?: SelectSubset<T, RawEventFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a RawEvent.
     * @param {RawEventCreateArgs} args - Arguments to create a RawEvent.
     * @example
     * // Create one RawEvent
     * const RawEvent = await prisma.rawEvent.create({
     *   data: {
     *     // ... data to create a RawEvent
     *   }
     * })
     * 
     */
    create<T extends RawEventCreateArgs>(args: SelectSubset<T, RawEventCreateArgs<ExtArgs>>): Prisma__RawEventClient<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many RawEvents.
     * @param {RawEventCreateManyArgs} args - Arguments to create many RawEvents.
     * @example
     * // Create many RawEvents
     * const rawEvent = await prisma.rawEvent.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RawEventCreateManyArgs>(args?: SelectSubset<T, RawEventCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RawEvents and returns the data saved in the database.
     * @param {RawEventCreateManyAndReturnArgs} args - Arguments to create many RawEvents.
     * @example
     * // Create many RawEvents
     * const rawEvent = await prisma.rawEvent.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RawEvents and only return the `id`
     * const rawEventWithIdOnly = await prisma.rawEvent.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RawEventCreateManyAndReturnArgs>(args?: SelectSubset<T, RawEventCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a RawEvent.
     * @param {RawEventDeleteArgs} args - Arguments to delete one RawEvent.
     * @example
     * // Delete one RawEvent
     * const RawEvent = await prisma.rawEvent.delete({
     *   where: {
     *     // ... filter to delete one RawEvent
     *   }
     * })
     * 
     */
    delete<T extends RawEventDeleteArgs>(args: SelectSubset<T, RawEventDeleteArgs<ExtArgs>>): Prisma__RawEventClient<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one RawEvent.
     * @param {RawEventUpdateArgs} args - Arguments to update one RawEvent.
     * @example
     * // Update one RawEvent
     * const rawEvent = await prisma.rawEvent.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RawEventUpdateArgs>(args: SelectSubset<T, RawEventUpdateArgs<ExtArgs>>): Prisma__RawEventClient<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more RawEvents.
     * @param {RawEventDeleteManyArgs} args - Arguments to filter RawEvents to delete.
     * @example
     * // Delete a few RawEvents
     * const { count } = await prisma.rawEvent.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RawEventDeleteManyArgs>(args?: SelectSubset<T, RawEventDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RawEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RawEventUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RawEvents
     * const rawEvent = await prisma.rawEvent.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RawEventUpdateManyArgs>(args: SelectSubset<T, RawEventUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RawEvents and returns the data updated in the database.
     * @param {RawEventUpdateManyAndReturnArgs} args - Arguments to update many RawEvents.
     * @example
     * // Update many RawEvents
     * const rawEvent = await prisma.rawEvent.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more RawEvents and only return the `id`
     * const rawEventWithIdOnly = await prisma.rawEvent.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends RawEventUpdateManyAndReturnArgs>(args: SelectSubset<T, RawEventUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one RawEvent.
     * @param {RawEventUpsertArgs} args - Arguments to update or create a RawEvent.
     * @example
     * // Update or create a RawEvent
     * const rawEvent = await prisma.rawEvent.upsert({
     *   create: {
     *     // ... data to create a RawEvent
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RawEvent we want to update
     *   }
     * })
     */
    upsert<T extends RawEventUpsertArgs>(args: SelectSubset<T, RawEventUpsertArgs<ExtArgs>>): Prisma__RawEventClient<$Result.GetResult<Prisma.$RawEventPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of RawEvents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RawEventCountArgs} args - Arguments to filter RawEvents to count.
     * @example
     * // Count the number of RawEvents
     * const count = await prisma.rawEvent.count({
     *   where: {
     *     // ... the filter for the RawEvents we want to count
     *   }
     * })
    **/
    count<T extends RawEventCountArgs>(
      args?: Subset<T, RawEventCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RawEventCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RawEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RawEventAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RawEventAggregateArgs>(args: Subset<T, RawEventAggregateArgs>): Prisma.PrismaPromise<GetRawEventAggregateType<T>>

    /**
     * Group by RawEvent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RawEventGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RawEventGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RawEventGroupByArgs['orderBy'] }
        : { orderBy?: RawEventGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RawEventGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRawEventGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RawEvent model
   */
  readonly fields: RawEventFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RawEvent.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RawEventClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends RawEvent$userArgs<ExtArgs> = {}>(args?: Subset<T, RawEvent$userArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RawEvent model
   */
  interface RawEventFieldRefs {
    readonly id: FieldRef<"RawEvent", 'String'>
    readonly eventType: FieldRef<"RawEvent", 'String'>
    readonly userId: FieldRef<"RawEvent", 'String'>
    readonly timestamp: FieldRef<"RawEvent", 'DateTime'>
    readonly payload: FieldRef<"RawEvent", 'Json'>
  }
    

  // Custom InputTypes
  /**
   * RawEvent findUnique
   */
  export type RawEventFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    /**
     * Filter, which RawEvent to fetch.
     */
    where: RawEventWhereUniqueInput
  }

  /**
   * RawEvent findUniqueOrThrow
   */
  export type RawEventFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    /**
     * Filter, which RawEvent to fetch.
     */
    where: RawEventWhereUniqueInput
  }

  /**
   * RawEvent findFirst
   */
  export type RawEventFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    /**
     * Filter, which RawEvent to fetch.
     */
    where?: RawEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RawEvents to fetch.
     */
    orderBy?: RawEventOrderByWithRelationInput | RawEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RawEvents.
     */
    cursor?: RawEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RawEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RawEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RawEvents.
     */
    distinct?: RawEventScalarFieldEnum | RawEventScalarFieldEnum[]
  }

  /**
   * RawEvent findFirstOrThrow
   */
  export type RawEventFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    /**
     * Filter, which RawEvent to fetch.
     */
    where?: RawEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RawEvents to fetch.
     */
    orderBy?: RawEventOrderByWithRelationInput | RawEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RawEvents.
     */
    cursor?: RawEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RawEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RawEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RawEvents.
     */
    distinct?: RawEventScalarFieldEnum | RawEventScalarFieldEnum[]
  }

  /**
   * RawEvent findMany
   */
  export type RawEventFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    /**
     * Filter, which RawEvents to fetch.
     */
    where?: RawEventWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RawEvents to fetch.
     */
    orderBy?: RawEventOrderByWithRelationInput | RawEventOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RawEvents.
     */
    cursor?: RawEventWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RawEvents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RawEvents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RawEvents.
     */
    distinct?: RawEventScalarFieldEnum | RawEventScalarFieldEnum[]
  }

  /**
   * RawEvent create
   */
  export type RawEventCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    /**
     * The data needed to create a RawEvent.
     */
    data: XOR<RawEventCreateInput, RawEventUncheckedCreateInput>
  }

  /**
   * RawEvent createMany
   */
  export type RawEventCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RawEvents.
     */
    data: RawEventCreateManyInput | RawEventCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RawEvent createManyAndReturn
   */
  export type RawEventCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * The data used to create many RawEvents.
     */
    data: RawEventCreateManyInput | RawEventCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * RawEvent update
   */
  export type RawEventUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    /**
     * The data needed to update a RawEvent.
     */
    data: XOR<RawEventUpdateInput, RawEventUncheckedUpdateInput>
    /**
     * Choose, which RawEvent to update.
     */
    where: RawEventWhereUniqueInput
  }

  /**
   * RawEvent updateMany
   */
  export type RawEventUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RawEvents.
     */
    data: XOR<RawEventUpdateManyMutationInput, RawEventUncheckedUpdateManyInput>
    /**
     * Filter which RawEvents to update
     */
    where?: RawEventWhereInput
    /**
     * Limit how many RawEvents to update.
     */
    limit?: number
  }

  /**
   * RawEvent updateManyAndReturn
   */
  export type RawEventUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * The data used to update RawEvents.
     */
    data: XOR<RawEventUpdateManyMutationInput, RawEventUncheckedUpdateManyInput>
    /**
     * Filter which RawEvents to update
     */
    where?: RawEventWhereInput
    /**
     * Limit how many RawEvents to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * RawEvent upsert
   */
  export type RawEventUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    /**
     * The filter to search for the RawEvent to update in case it exists.
     */
    where: RawEventWhereUniqueInput
    /**
     * In case the RawEvent found by the `where` argument doesn't exist, create a new RawEvent with this data.
     */
    create: XOR<RawEventCreateInput, RawEventUncheckedCreateInput>
    /**
     * In case the RawEvent was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RawEventUpdateInput, RawEventUncheckedUpdateInput>
  }

  /**
   * RawEvent delete
   */
  export type RawEventDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
    /**
     * Filter which RawEvent to delete.
     */
    where: RawEventWhereUniqueInput
  }

  /**
   * RawEvent deleteMany
   */
  export type RawEventDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RawEvents to delete
     */
    where?: RawEventWhereInput
    /**
     * Limit how many RawEvents to delete.
     */
    limit?: number
  }

  /**
   * RawEvent.user
   */
  export type RawEvent$userArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * RawEvent without action
   */
  export type RawEventDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RawEvent
     */
    select?: RawEventSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RawEvent
     */
    omit?: RawEventOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RawEventInclude<ExtArgs> | null
  }


  /**
   * Model PlayerFeatures
   */

  export type AggregatePlayerFeatures = {
    _count: PlayerFeaturesCountAggregateOutputType | null
    _avg: PlayerFeaturesAvgAggregateOutputType | null
    _sum: PlayerFeaturesSumAggregateOutputType | null
    _min: PlayerFeaturesMinAggregateOutputType | null
    _max: PlayerFeaturesMaxAggregateOutputType | null
  }

  export type PlayerFeaturesAvgAggregateOutputType = {
    totalPlayTime: number | null
    matchesPlayed: number | null
    explorerRatio: number | null
    popularitySensitivity: number | null
    returnIntent: number | null
  }

  export type PlayerFeaturesSumAggregateOutputType = {
    totalPlayTime: number | null
    matchesPlayed: number | null
    explorerRatio: number | null
    popularitySensitivity: number | null
    returnIntent: number | null
  }

  export type PlayerFeaturesMinAggregateOutputType = {
    userId: string | null
    lastActive: Date | null
    totalPlayTime: number | null
    matchesPlayed: number | null
    preferredLanguage: string | null
    explorerRatio: number | null
    playerProfile: string | null
    popularitySensitivity: number | null
    returnIntent: number | null
  }

  export type PlayerFeaturesMaxAggregateOutputType = {
    userId: string | null
    lastActive: Date | null
    totalPlayTime: number | null
    matchesPlayed: number | null
    preferredLanguage: string | null
    explorerRatio: number | null
    playerProfile: string | null
    popularitySensitivity: number | null
    returnIntent: number | null
  }

  export type PlayerFeaturesCountAggregateOutputType = {
    userId: number
    lastActive: number
    totalPlayTime: number
    matchesPlayed: number
    preferredLanguage: number
    explorerRatio: number
    playerProfile: number
    popularitySensitivity: number
    returnIntent: number
    scheduleProfile: number
    _all: number
  }


  export type PlayerFeaturesAvgAggregateInputType = {
    totalPlayTime?: true
    matchesPlayed?: true
    explorerRatio?: true
    popularitySensitivity?: true
    returnIntent?: true
  }

  export type PlayerFeaturesSumAggregateInputType = {
    totalPlayTime?: true
    matchesPlayed?: true
    explorerRatio?: true
    popularitySensitivity?: true
    returnIntent?: true
  }

  export type PlayerFeaturesMinAggregateInputType = {
    userId?: true
    lastActive?: true
    totalPlayTime?: true
    matchesPlayed?: true
    preferredLanguage?: true
    explorerRatio?: true
    playerProfile?: true
    popularitySensitivity?: true
    returnIntent?: true
  }

  export type PlayerFeaturesMaxAggregateInputType = {
    userId?: true
    lastActive?: true
    totalPlayTime?: true
    matchesPlayed?: true
    preferredLanguage?: true
    explorerRatio?: true
    playerProfile?: true
    popularitySensitivity?: true
    returnIntent?: true
  }

  export type PlayerFeaturesCountAggregateInputType = {
    userId?: true
    lastActive?: true
    totalPlayTime?: true
    matchesPlayed?: true
    preferredLanguage?: true
    explorerRatio?: true
    playerProfile?: true
    popularitySensitivity?: true
    returnIntent?: true
    scheduleProfile?: true
    _all?: true
  }

  export type PlayerFeaturesAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PlayerFeatures to aggregate.
     */
    where?: PlayerFeaturesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PlayerFeatures to fetch.
     */
    orderBy?: PlayerFeaturesOrderByWithRelationInput | PlayerFeaturesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PlayerFeaturesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PlayerFeatures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PlayerFeatures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PlayerFeatures
    **/
    _count?: true | PlayerFeaturesCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PlayerFeaturesAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PlayerFeaturesSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PlayerFeaturesMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PlayerFeaturesMaxAggregateInputType
  }

  export type GetPlayerFeaturesAggregateType<T extends PlayerFeaturesAggregateArgs> = {
        [P in keyof T & keyof AggregatePlayerFeatures]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePlayerFeatures[P]>
      : GetScalarType<T[P], AggregatePlayerFeatures[P]>
  }




  export type PlayerFeaturesGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PlayerFeaturesWhereInput
    orderBy?: PlayerFeaturesOrderByWithAggregationInput | PlayerFeaturesOrderByWithAggregationInput[]
    by: PlayerFeaturesScalarFieldEnum[] | PlayerFeaturesScalarFieldEnum
    having?: PlayerFeaturesScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PlayerFeaturesCountAggregateInputType | true
    _avg?: PlayerFeaturesAvgAggregateInputType
    _sum?: PlayerFeaturesSumAggregateInputType
    _min?: PlayerFeaturesMinAggregateInputType
    _max?: PlayerFeaturesMaxAggregateInputType
  }

  export type PlayerFeaturesGroupByOutputType = {
    userId: string
    lastActive: Date
    totalPlayTime: number
    matchesPlayed: number
    preferredLanguage: string
    explorerRatio: number | null
    playerProfile: string | null
    popularitySensitivity: number | null
    returnIntent: number | null
    scheduleProfile: JsonValue | null
    _count: PlayerFeaturesCountAggregateOutputType | null
    _avg: PlayerFeaturesAvgAggregateOutputType | null
    _sum: PlayerFeaturesSumAggregateOutputType | null
    _min: PlayerFeaturesMinAggregateOutputType | null
    _max: PlayerFeaturesMaxAggregateOutputType | null
  }

  type GetPlayerFeaturesGroupByPayload<T extends PlayerFeaturesGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PlayerFeaturesGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PlayerFeaturesGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PlayerFeaturesGroupByOutputType[P]>
            : GetScalarType<T[P], PlayerFeaturesGroupByOutputType[P]>
        }
      >
    >


  export type PlayerFeaturesSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    lastActive?: boolean
    totalPlayTime?: boolean
    matchesPlayed?: boolean
    preferredLanguage?: boolean
    explorerRatio?: boolean
    playerProfile?: boolean
    popularitySensitivity?: boolean
    returnIntent?: boolean
    scheduleProfile?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["playerFeatures"]>

  export type PlayerFeaturesSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    lastActive?: boolean
    totalPlayTime?: boolean
    matchesPlayed?: boolean
    preferredLanguage?: boolean
    explorerRatio?: boolean
    playerProfile?: boolean
    popularitySensitivity?: boolean
    returnIntent?: boolean
    scheduleProfile?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["playerFeatures"]>

  export type PlayerFeaturesSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    lastActive?: boolean
    totalPlayTime?: boolean
    matchesPlayed?: boolean
    preferredLanguage?: boolean
    explorerRatio?: boolean
    playerProfile?: boolean
    popularitySensitivity?: boolean
    returnIntent?: boolean
    scheduleProfile?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["playerFeatures"]>

  export type PlayerFeaturesSelectScalar = {
    userId?: boolean
    lastActive?: boolean
    totalPlayTime?: boolean
    matchesPlayed?: boolean
    preferredLanguage?: boolean
    explorerRatio?: boolean
    playerProfile?: boolean
    popularitySensitivity?: boolean
    returnIntent?: boolean
    scheduleProfile?: boolean
  }

  export type PlayerFeaturesOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"userId" | "lastActive" | "totalPlayTime" | "matchesPlayed" | "preferredLanguage" | "explorerRatio" | "playerProfile" | "popularitySensitivity" | "returnIntent" | "scheduleProfile", ExtArgs["result"]["playerFeatures"]>
  export type PlayerFeaturesInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type PlayerFeaturesIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type PlayerFeaturesIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $PlayerFeaturesPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PlayerFeatures"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      userId: string
      lastActive: Date
      totalPlayTime: number
      matchesPlayed: number
      preferredLanguage: string
      explorerRatio: number | null
      playerProfile: string | null
      popularitySensitivity: number | null
      returnIntent: number | null
      scheduleProfile: Prisma.JsonValue | null
    }, ExtArgs["result"]["playerFeatures"]>
    composites: {}
  }

  type PlayerFeaturesGetPayload<S extends boolean | null | undefined | PlayerFeaturesDefaultArgs> = $Result.GetResult<Prisma.$PlayerFeaturesPayload, S>

  type PlayerFeaturesCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PlayerFeaturesFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PlayerFeaturesCountAggregateInputType | true
    }

  export interface PlayerFeaturesDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PlayerFeatures'], meta: { name: 'PlayerFeatures' } }
    /**
     * Find zero or one PlayerFeatures that matches the filter.
     * @param {PlayerFeaturesFindUniqueArgs} args - Arguments to find a PlayerFeatures
     * @example
     * // Get one PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PlayerFeaturesFindUniqueArgs>(args: SelectSubset<T, PlayerFeaturesFindUniqueArgs<ExtArgs>>): Prisma__PlayerFeaturesClient<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PlayerFeatures that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PlayerFeaturesFindUniqueOrThrowArgs} args - Arguments to find a PlayerFeatures
     * @example
     * // Get one PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PlayerFeaturesFindUniqueOrThrowArgs>(args: SelectSubset<T, PlayerFeaturesFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PlayerFeaturesClient<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PlayerFeatures that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFeaturesFindFirstArgs} args - Arguments to find a PlayerFeatures
     * @example
     * // Get one PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PlayerFeaturesFindFirstArgs>(args?: SelectSubset<T, PlayerFeaturesFindFirstArgs<ExtArgs>>): Prisma__PlayerFeaturesClient<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PlayerFeatures that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFeaturesFindFirstOrThrowArgs} args - Arguments to find a PlayerFeatures
     * @example
     * // Get one PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PlayerFeaturesFindFirstOrThrowArgs>(args?: SelectSubset<T, PlayerFeaturesFindFirstOrThrowArgs<ExtArgs>>): Prisma__PlayerFeaturesClient<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PlayerFeatures that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFeaturesFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.findMany()
     * 
     * // Get first 10 PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.findMany({ take: 10 })
     * 
     * // Only select the `userId`
     * const playerFeaturesWithUserIdOnly = await prisma.playerFeatures.findMany({ select: { userId: true } })
     * 
     */
    findMany<T extends PlayerFeaturesFindManyArgs>(args?: SelectSubset<T, PlayerFeaturesFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PlayerFeatures.
     * @param {PlayerFeaturesCreateArgs} args - Arguments to create a PlayerFeatures.
     * @example
     * // Create one PlayerFeatures
     * const PlayerFeatures = await prisma.playerFeatures.create({
     *   data: {
     *     // ... data to create a PlayerFeatures
     *   }
     * })
     * 
     */
    create<T extends PlayerFeaturesCreateArgs>(args: SelectSubset<T, PlayerFeaturesCreateArgs<ExtArgs>>): Prisma__PlayerFeaturesClient<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PlayerFeatures.
     * @param {PlayerFeaturesCreateManyArgs} args - Arguments to create many PlayerFeatures.
     * @example
     * // Create many PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PlayerFeaturesCreateManyArgs>(args?: SelectSubset<T, PlayerFeaturesCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PlayerFeatures and returns the data saved in the database.
     * @param {PlayerFeaturesCreateManyAndReturnArgs} args - Arguments to create many PlayerFeatures.
     * @example
     * // Create many PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PlayerFeatures and only return the `userId`
     * const playerFeaturesWithUserIdOnly = await prisma.playerFeatures.createManyAndReturn({
     *   select: { userId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PlayerFeaturesCreateManyAndReturnArgs>(args?: SelectSubset<T, PlayerFeaturesCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PlayerFeatures.
     * @param {PlayerFeaturesDeleteArgs} args - Arguments to delete one PlayerFeatures.
     * @example
     * // Delete one PlayerFeatures
     * const PlayerFeatures = await prisma.playerFeatures.delete({
     *   where: {
     *     // ... filter to delete one PlayerFeatures
     *   }
     * })
     * 
     */
    delete<T extends PlayerFeaturesDeleteArgs>(args: SelectSubset<T, PlayerFeaturesDeleteArgs<ExtArgs>>): Prisma__PlayerFeaturesClient<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PlayerFeatures.
     * @param {PlayerFeaturesUpdateArgs} args - Arguments to update one PlayerFeatures.
     * @example
     * // Update one PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PlayerFeaturesUpdateArgs>(args: SelectSubset<T, PlayerFeaturesUpdateArgs<ExtArgs>>): Prisma__PlayerFeaturesClient<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PlayerFeatures.
     * @param {PlayerFeaturesDeleteManyArgs} args - Arguments to filter PlayerFeatures to delete.
     * @example
     * // Delete a few PlayerFeatures
     * const { count } = await prisma.playerFeatures.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PlayerFeaturesDeleteManyArgs>(args?: SelectSubset<T, PlayerFeaturesDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PlayerFeatures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFeaturesUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PlayerFeaturesUpdateManyArgs>(args: SelectSubset<T, PlayerFeaturesUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PlayerFeatures and returns the data updated in the database.
     * @param {PlayerFeaturesUpdateManyAndReturnArgs} args - Arguments to update many PlayerFeatures.
     * @example
     * // Update many PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PlayerFeatures and only return the `userId`
     * const playerFeaturesWithUserIdOnly = await prisma.playerFeatures.updateManyAndReturn({
     *   select: { userId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PlayerFeaturesUpdateManyAndReturnArgs>(args: SelectSubset<T, PlayerFeaturesUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PlayerFeatures.
     * @param {PlayerFeaturesUpsertArgs} args - Arguments to update or create a PlayerFeatures.
     * @example
     * // Update or create a PlayerFeatures
     * const playerFeatures = await prisma.playerFeatures.upsert({
     *   create: {
     *     // ... data to create a PlayerFeatures
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PlayerFeatures we want to update
     *   }
     * })
     */
    upsert<T extends PlayerFeaturesUpsertArgs>(args: SelectSubset<T, PlayerFeaturesUpsertArgs<ExtArgs>>): Prisma__PlayerFeaturesClient<$Result.GetResult<Prisma.$PlayerFeaturesPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PlayerFeatures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFeaturesCountArgs} args - Arguments to filter PlayerFeatures to count.
     * @example
     * // Count the number of PlayerFeatures
     * const count = await prisma.playerFeatures.count({
     *   where: {
     *     // ... the filter for the PlayerFeatures we want to count
     *   }
     * })
    **/
    count<T extends PlayerFeaturesCountArgs>(
      args?: Subset<T, PlayerFeaturesCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PlayerFeaturesCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PlayerFeatures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFeaturesAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PlayerFeaturesAggregateArgs>(args: Subset<T, PlayerFeaturesAggregateArgs>): Prisma.PrismaPromise<GetPlayerFeaturesAggregateType<T>>

    /**
     * Group by PlayerFeatures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlayerFeaturesGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PlayerFeaturesGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PlayerFeaturesGroupByArgs['orderBy'] }
        : { orderBy?: PlayerFeaturesGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PlayerFeaturesGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPlayerFeaturesGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PlayerFeatures model
   */
  readonly fields: PlayerFeaturesFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PlayerFeatures.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PlayerFeaturesClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PlayerFeatures model
   */
  interface PlayerFeaturesFieldRefs {
    readonly userId: FieldRef<"PlayerFeatures", 'String'>
    readonly lastActive: FieldRef<"PlayerFeatures", 'DateTime'>
    readonly totalPlayTime: FieldRef<"PlayerFeatures", 'Float'>
    readonly matchesPlayed: FieldRef<"PlayerFeatures", 'Int'>
    readonly preferredLanguage: FieldRef<"PlayerFeatures", 'String'>
    readonly explorerRatio: FieldRef<"PlayerFeatures", 'Float'>
    readonly playerProfile: FieldRef<"PlayerFeatures", 'String'>
    readonly popularitySensitivity: FieldRef<"PlayerFeatures", 'Float'>
    readonly returnIntent: FieldRef<"PlayerFeatures", 'Float'>
    readonly scheduleProfile: FieldRef<"PlayerFeatures", 'Json'>
  }
    

  // Custom InputTypes
  /**
   * PlayerFeatures findUnique
   */
  export type PlayerFeaturesFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which PlayerFeatures to fetch.
     */
    where: PlayerFeaturesWhereUniqueInput
  }

  /**
   * PlayerFeatures findUniqueOrThrow
   */
  export type PlayerFeaturesFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which PlayerFeatures to fetch.
     */
    where: PlayerFeaturesWhereUniqueInput
  }

  /**
   * PlayerFeatures findFirst
   */
  export type PlayerFeaturesFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which PlayerFeatures to fetch.
     */
    where?: PlayerFeaturesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PlayerFeatures to fetch.
     */
    orderBy?: PlayerFeaturesOrderByWithRelationInput | PlayerFeaturesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PlayerFeatures.
     */
    cursor?: PlayerFeaturesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PlayerFeatures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PlayerFeatures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PlayerFeatures.
     */
    distinct?: PlayerFeaturesScalarFieldEnum | PlayerFeaturesScalarFieldEnum[]
  }

  /**
   * PlayerFeatures findFirstOrThrow
   */
  export type PlayerFeaturesFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which PlayerFeatures to fetch.
     */
    where?: PlayerFeaturesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PlayerFeatures to fetch.
     */
    orderBy?: PlayerFeaturesOrderByWithRelationInput | PlayerFeaturesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PlayerFeatures.
     */
    cursor?: PlayerFeaturesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PlayerFeatures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PlayerFeatures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PlayerFeatures.
     */
    distinct?: PlayerFeaturesScalarFieldEnum | PlayerFeaturesScalarFieldEnum[]
  }

  /**
   * PlayerFeatures findMany
   */
  export type PlayerFeaturesFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which PlayerFeatures to fetch.
     */
    where?: PlayerFeaturesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PlayerFeatures to fetch.
     */
    orderBy?: PlayerFeaturesOrderByWithRelationInput | PlayerFeaturesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PlayerFeatures.
     */
    cursor?: PlayerFeaturesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PlayerFeatures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PlayerFeatures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PlayerFeatures.
     */
    distinct?: PlayerFeaturesScalarFieldEnum | PlayerFeaturesScalarFieldEnum[]
  }

  /**
   * PlayerFeatures create
   */
  export type PlayerFeaturesCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    /**
     * The data needed to create a PlayerFeatures.
     */
    data: XOR<PlayerFeaturesCreateInput, PlayerFeaturesUncheckedCreateInput>
  }

  /**
   * PlayerFeatures createMany
   */
  export type PlayerFeaturesCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PlayerFeatures.
     */
    data: PlayerFeaturesCreateManyInput | PlayerFeaturesCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PlayerFeatures createManyAndReturn
   */
  export type PlayerFeaturesCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * The data used to create many PlayerFeatures.
     */
    data: PlayerFeaturesCreateManyInput | PlayerFeaturesCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PlayerFeatures update
   */
  export type PlayerFeaturesUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    /**
     * The data needed to update a PlayerFeatures.
     */
    data: XOR<PlayerFeaturesUpdateInput, PlayerFeaturesUncheckedUpdateInput>
    /**
     * Choose, which PlayerFeatures to update.
     */
    where: PlayerFeaturesWhereUniqueInput
  }

  /**
   * PlayerFeatures updateMany
   */
  export type PlayerFeaturesUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PlayerFeatures.
     */
    data: XOR<PlayerFeaturesUpdateManyMutationInput, PlayerFeaturesUncheckedUpdateManyInput>
    /**
     * Filter which PlayerFeatures to update
     */
    where?: PlayerFeaturesWhereInput
    /**
     * Limit how many PlayerFeatures to update.
     */
    limit?: number
  }

  /**
   * PlayerFeatures updateManyAndReturn
   */
  export type PlayerFeaturesUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * The data used to update PlayerFeatures.
     */
    data: XOR<PlayerFeaturesUpdateManyMutationInput, PlayerFeaturesUncheckedUpdateManyInput>
    /**
     * Filter which PlayerFeatures to update
     */
    where?: PlayerFeaturesWhereInput
    /**
     * Limit how many PlayerFeatures to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PlayerFeatures upsert
   */
  export type PlayerFeaturesUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    /**
     * The filter to search for the PlayerFeatures to update in case it exists.
     */
    where: PlayerFeaturesWhereUniqueInput
    /**
     * In case the PlayerFeatures found by the `where` argument doesn't exist, create a new PlayerFeatures with this data.
     */
    create: XOR<PlayerFeaturesCreateInput, PlayerFeaturesUncheckedCreateInput>
    /**
     * In case the PlayerFeatures was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PlayerFeaturesUpdateInput, PlayerFeaturesUncheckedUpdateInput>
  }

  /**
   * PlayerFeatures delete
   */
  export type PlayerFeaturesDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
    /**
     * Filter which PlayerFeatures to delete.
     */
    where: PlayerFeaturesWhereUniqueInput
  }

  /**
   * PlayerFeatures deleteMany
   */
  export type PlayerFeaturesDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PlayerFeatures to delete
     */
    where?: PlayerFeaturesWhereInput
    /**
     * Limit how many PlayerFeatures to delete.
     */
    limit?: number
  }

  /**
   * PlayerFeatures without action
   */
  export type PlayerFeaturesDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlayerFeatures
     */
    select?: PlayerFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlayerFeatures
     */
    omit?: PlayerFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlayerFeaturesInclude<ExtArgs> | null
  }


  /**
   * Model MapFeatures
   */

  export type AggregateMapFeatures = {
    _count: MapFeaturesCountAggregateOutputType | null
    _avg: MapFeaturesAvgAggregateOutputType | null
    _sum: MapFeaturesSumAggregateOutputType | null
    _min: MapFeaturesMinAggregateOutputType | null
    _max: MapFeaturesMaxAggregateOutputType | null
  }

  export type MapFeaturesAvgAggregateOutputType = {
    totalJoins: number | null
    totalLeaves: number | null
    bounceCount: number | null
    averageDuration: number | null
    bounceRate: number | null
    medianPlaytime: number | null
    completionRate: number | null
    difficultyScore: number | null
    paceScore: number | null
    earlyAbandonRate: number | null
    stickyFactor: number | null
    viralityFactor: number | null
  }

  export type MapFeaturesSumAggregateOutputType = {
    totalJoins: number | null
    totalLeaves: number | null
    bounceCount: number | null
    averageDuration: number | null
    bounceRate: number | null
    medianPlaytime: number | null
    completionRate: number | null
    difficultyScore: number | null
    paceScore: number | null
    earlyAbandonRate: number | null
    stickyFactor: number | null
    viralityFactor: number | null
  }

  export type MapFeaturesMinAggregateOutputType = {
    mapId: string | null
    totalJoins: number | null
    totalLeaves: number | null
    bounceCount: number | null
    averageDuration: number | null
    bounceRate: number | null
    medianPlaytime: number | null
    completionRate: number | null
    difficultyScore: number | null
    difficultyLabel: string | null
    paceScore: number | null
    paceLabel: string | null
    earlyAbandonRate: number | null
    stickyFactor: number | null
    viralityFactor: number | null
  }

  export type MapFeaturesMaxAggregateOutputType = {
    mapId: string | null
    totalJoins: number | null
    totalLeaves: number | null
    bounceCount: number | null
    averageDuration: number | null
    bounceRate: number | null
    medianPlaytime: number | null
    completionRate: number | null
    difficultyScore: number | null
    difficultyLabel: string | null
    paceScore: number | null
    paceLabel: string | null
    earlyAbandonRate: number | null
    stickyFactor: number | null
    viralityFactor: number | null
  }

  export type MapFeaturesCountAggregateOutputType = {
    mapId: number
    totalJoins: number
    totalLeaves: number
    bounceCount: number
    averageDuration: number
    bounceRate: number
    medianPlaytime: number
    completionRate: number
    retentionCurve: number
    difficultyScore: number
    difficultyLabel: number
    paceScore: number
    paceLabel: number
    earlyAbandonRate: number
    stickyFactor: number
    viralityFactor: number
    _all: number
  }


  export type MapFeaturesAvgAggregateInputType = {
    totalJoins?: true
    totalLeaves?: true
    bounceCount?: true
    averageDuration?: true
    bounceRate?: true
    medianPlaytime?: true
    completionRate?: true
    difficultyScore?: true
    paceScore?: true
    earlyAbandonRate?: true
    stickyFactor?: true
    viralityFactor?: true
  }

  export type MapFeaturesSumAggregateInputType = {
    totalJoins?: true
    totalLeaves?: true
    bounceCount?: true
    averageDuration?: true
    bounceRate?: true
    medianPlaytime?: true
    completionRate?: true
    difficultyScore?: true
    paceScore?: true
    earlyAbandonRate?: true
    stickyFactor?: true
    viralityFactor?: true
  }

  export type MapFeaturesMinAggregateInputType = {
    mapId?: true
    totalJoins?: true
    totalLeaves?: true
    bounceCount?: true
    averageDuration?: true
    bounceRate?: true
    medianPlaytime?: true
    completionRate?: true
    difficultyScore?: true
    difficultyLabel?: true
    paceScore?: true
    paceLabel?: true
    earlyAbandonRate?: true
    stickyFactor?: true
    viralityFactor?: true
  }

  export type MapFeaturesMaxAggregateInputType = {
    mapId?: true
    totalJoins?: true
    totalLeaves?: true
    bounceCount?: true
    averageDuration?: true
    bounceRate?: true
    medianPlaytime?: true
    completionRate?: true
    difficultyScore?: true
    difficultyLabel?: true
    paceScore?: true
    paceLabel?: true
    earlyAbandonRate?: true
    stickyFactor?: true
    viralityFactor?: true
  }

  export type MapFeaturesCountAggregateInputType = {
    mapId?: true
    totalJoins?: true
    totalLeaves?: true
    bounceCount?: true
    averageDuration?: true
    bounceRate?: true
    medianPlaytime?: true
    completionRate?: true
    retentionCurve?: true
    difficultyScore?: true
    difficultyLabel?: true
    paceScore?: true
    paceLabel?: true
    earlyAbandonRate?: true
    stickyFactor?: true
    viralityFactor?: true
    _all?: true
  }

  export type MapFeaturesAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MapFeatures to aggregate.
     */
    where?: MapFeaturesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MapFeatures to fetch.
     */
    orderBy?: MapFeaturesOrderByWithRelationInput | MapFeaturesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MapFeaturesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MapFeatures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MapFeatures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned MapFeatures
    **/
    _count?: true | MapFeaturesCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: MapFeaturesAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: MapFeaturesSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MapFeaturesMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MapFeaturesMaxAggregateInputType
  }

  export type GetMapFeaturesAggregateType<T extends MapFeaturesAggregateArgs> = {
        [P in keyof T & keyof AggregateMapFeatures]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMapFeatures[P]>
      : GetScalarType<T[P], AggregateMapFeatures[P]>
  }




  export type MapFeaturesGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MapFeaturesWhereInput
    orderBy?: MapFeaturesOrderByWithAggregationInput | MapFeaturesOrderByWithAggregationInput[]
    by: MapFeaturesScalarFieldEnum[] | MapFeaturesScalarFieldEnum
    having?: MapFeaturesScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MapFeaturesCountAggregateInputType | true
    _avg?: MapFeaturesAvgAggregateInputType
    _sum?: MapFeaturesSumAggregateInputType
    _min?: MapFeaturesMinAggregateInputType
    _max?: MapFeaturesMaxAggregateInputType
  }

  export type MapFeaturesGroupByOutputType = {
    mapId: string
    totalJoins: number
    totalLeaves: number
    bounceCount: number
    averageDuration: number
    bounceRate: number
    medianPlaytime: number | null
    completionRate: number | null
    retentionCurve: JsonValue | null
    difficultyScore: number | null
    difficultyLabel: string | null
    paceScore: number | null
    paceLabel: string | null
    earlyAbandonRate: number | null
    stickyFactor: number | null
    viralityFactor: number | null
    _count: MapFeaturesCountAggregateOutputType | null
    _avg: MapFeaturesAvgAggregateOutputType | null
    _sum: MapFeaturesSumAggregateOutputType | null
    _min: MapFeaturesMinAggregateOutputType | null
    _max: MapFeaturesMaxAggregateOutputType | null
  }

  type GetMapFeaturesGroupByPayload<T extends MapFeaturesGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MapFeaturesGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MapFeaturesGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MapFeaturesGroupByOutputType[P]>
            : GetScalarType<T[P], MapFeaturesGroupByOutputType[P]>
        }
      >
    >


  export type MapFeaturesSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    mapId?: boolean
    totalJoins?: boolean
    totalLeaves?: boolean
    bounceCount?: boolean
    averageDuration?: boolean
    bounceRate?: boolean
    medianPlaytime?: boolean
    completionRate?: boolean
    retentionCurve?: boolean
    difficultyScore?: boolean
    difficultyLabel?: boolean
    paceScore?: boolean
    paceLabel?: boolean
    earlyAbandonRate?: boolean
    stickyFactor?: boolean
    viralityFactor?: boolean
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["mapFeatures"]>

  export type MapFeaturesSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    mapId?: boolean
    totalJoins?: boolean
    totalLeaves?: boolean
    bounceCount?: boolean
    averageDuration?: boolean
    bounceRate?: boolean
    medianPlaytime?: boolean
    completionRate?: boolean
    retentionCurve?: boolean
    difficultyScore?: boolean
    difficultyLabel?: boolean
    paceScore?: boolean
    paceLabel?: boolean
    earlyAbandonRate?: boolean
    stickyFactor?: boolean
    viralityFactor?: boolean
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["mapFeatures"]>

  export type MapFeaturesSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    mapId?: boolean
    totalJoins?: boolean
    totalLeaves?: boolean
    bounceCount?: boolean
    averageDuration?: boolean
    bounceRate?: boolean
    medianPlaytime?: boolean
    completionRate?: boolean
    retentionCurve?: boolean
    difficultyScore?: boolean
    difficultyLabel?: boolean
    paceScore?: boolean
    paceLabel?: boolean
    earlyAbandonRate?: boolean
    stickyFactor?: boolean
    viralityFactor?: boolean
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["mapFeatures"]>

  export type MapFeaturesSelectScalar = {
    mapId?: boolean
    totalJoins?: boolean
    totalLeaves?: boolean
    bounceCount?: boolean
    averageDuration?: boolean
    bounceRate?: boolean
    medianPlaytime?: boolean
    completionRate?: boolean
    retentionCurve?: boolean
    difficultyScore?: boolean
    difficultyLabel?: boolean
    paceScore?: boolean
    paceLabel?: boolean
    earlyAbandonRate?: boolean
    stickyFactor?: boolean
    viralityFactor?: boolean
  }

  export type MapFeaturesOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"mapId" | "totalJoins" | "totalLeaves" | "bounceCount" | "averageDuration" | "bounceRate" | "medianPlaytime" | "completionRate" | "retentionCurve" | "difficultyScore" | "difficultyLabel" | "paceScore" | "paceLabel" | "earlyAbandonRate" | "stickyFactor" | "viralityFactor", ExtArgs["result"]["mapFeatures"]>
  export type MapFeaturesInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }
  export type MapFeaturesIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }
  export type MapFeaturesIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }

  export type $MapFeaturesPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "MapFeatures"
    objects: {
      map: Prisma.$GameMapPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      mapId: string
      totalJoins: number
      totalLeaves: number
      bounceCount: number
      averageDuration: number
      bounceRate: number
      medianPlaytime: number | null
      completionRate: number | null
      retentionCurve: Prisma.JsonValue | null
      difficultyScore: number | null
      difficultyLabel: string | null
      paceScore: number | null
      paceLabel: string | null
      earlyAbandonRate: number | null
      stickyFactor: number | null
      viralityFactor: number | null
    }, ExtArgs["result"]["mapFeatures"]>
    composites: {}
  }

  type MapFeaturesGetPayload<S extends boolean | null | undefined | MapFeaturesDefaultArgs> = $Result.GetResult<Prisma.$MapFeaturesPayload, S>

  type MapFeaturesCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MapFeaturesFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MapFeaturesCountAggregateInputType | true
    }

  export interface MapFeaturesDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['MapFeatures'], meta: { name: 'MapFeatures' } }
    /**
     * Find zero or one MapFeatures that matches the filter.
     * @param {MapFeaturesFindUniqueArgs} args - Arguments to find a MapFeatures
     * @example
     * // Get one MapFeatures
     * const mapFeatures = await prisma.mapFeatures.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MapFeaturesFindUniqueArgs>(args: SelectSubset<T, MapFeaturesFindUniqueArgs<ExtArgs>>): Prisma__MapFeaturesClient<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one MapFeatures that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MapFeaturesFindUniqueOrThrowArgs} args - Arguments to find a MapFeatures
     * @example
     * // Get one MapFeatures
     * const mapFeatures = await prisma.mapFeatures.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MapFeaturesFindUniqueOrThrowArgs>(args: SelectSubset<T, MapFeaturesFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MapFeaturesClient<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MapFeatures that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MapFeaturesFindFirstArgs} args - Arguments to find a MapFeatures
     * @example
     * // Get one MapFeatures
     * const mapFeatures = await prisma.mapFeatures.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MapFeaturesFindFirstArgs>(args?: SelectSubset<T, MapFeaturesFindFirstArgs<ExtArgs>>): Prisma__MapFeaturesClient<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first MapFeatures that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MapFeaturesFindFirstOrThrowArgs} args - Arguments to find a MapFeatures
     * @example
     * // Get one MapFeatures
     * const mapFeatures = await prisma.mapFeatures.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MapFeaturesFindFirstOrThrowArgs>(args?: SelectSubset<T, MapFeaturesFindFirstOrThrowArgs<ExtArgs>>): Prisma__MapFeaturesClient<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more MapFeatures that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MapFeaturesFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all MapFeatures
     * const mapFeatures = await prisma.mapFeatures.findMany()
     * 
     * // Get first 10 MapFeatures
     * const mapFeatures = await prisma.mapFeatures.findMany({ take: 10 })
     * 
     * // Only select the `mapId`
     * const mapFeaturesWithMapIdOnly = await prisma.mapFeatures.findMany({ select: { mapId: true } })
     * 
     */
    findMany<T extends MapFeaturesFindManyArgs>(args?: SelectSubset<T, MapFeaturesFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a MapFeatures.
     * @param {MapFeaturesCreateArgs} args - Arguments to create a MapFeatures.
     * @example
     * // Create one MapFeatures
     * const MapFeatures = await prisma.mapFeatures.create({
     *   data: {
     *     // ... data to create a MapFeatures
     *   }
     * })
     * 
     */
    create<T extends MapFeaturesCreateArgs>(args: SelectSubset<T, MapFeaturesCreateArgs<ExtArgs>>): Prisma__MapFeaturesClient<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many MapFeatures.
     * @param {MapFeaturesCreateManyArgs} args - Arguments to create many MapFeatures.
     * @example
     * // Create many MapFeatures
     * const mapFeatures = await prisma.mapFeatures.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MapFeaturesCreateManyArgs>(args?: SelectSubset<T, MapFeaturesCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many MapFeatures and returns the data saved in the database.
     * @param {MapFeaturesCreateManyAndReturnArgs} args - Arguments to create many MapFeatures.
     * @example
     * // Create many MapFeatures
     * const mapFeatures = await prisma.mapFeatures.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many MapFeatures and only return the `mapId`
     * const mapFeaturesWithMapIdOnly = await prisma.mapFeatures.createManyAndReturn({
     *   select: { mapId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MapFeaturesCreateManyAndReturnArgs>(args?: SelectSubset<T, MapFeaturesCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a MapFeatures.
     * @param {MapFeaturesDeleteArgs} args - Arguments to delete one MapFeatures.
     * @example
     * // Delete one MapFeatures
     * const MapFeatures = await prisma.mapFeatures.delete({
     *   where: {
     *     // ... filter to delete one MapFeatures
     *   }
     * })
     * 
     */
    delete<T extends MapFeaturesDeleteArgs>(args: SelectSubset<T, MapFeaturesDeleteArgs<ExtArgs>>): Prisma__MapFeaturesClient<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one MapFeatures.
     * @param {MapFeaturesUpdateArgs} args - Arguments to update one MapFeatures.
     * @example
     * // Update one MapFeatures
     * const mapFeatures = await prisma.mapFeatures.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MapFeaturesUpdateArgs>(args: SelectSubset<T, MapFeaturesUpdateArgs<ExtArgs>>): Prisma__MapFeaturesClient<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more MapFeatures.
     * @param {MapFeaturesDeleteManyArgs} args - Arguments to filter MapFeatures to delete.
     * @example
     * // Delete a few MapFeatures
     * const { count } = await prisma.mapFeatures.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MapFeaturesDeleteManyArgs>(args?: SelectSubset<T, MapFeaturesDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MapFeatures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MapFeaturesUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many MapFeatures
     * const mapFeatures = await prisma.mapFeatures.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MapFeaturesUpdateManyArgs>(args: SelectSubset<T, MapFeaturesUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more MapFeatures and returns the data updated in the database.
     * @param {MapFeaturesUpdateManyAndReturnArgs} args - Arguments to update many MapFeatures.
     * @example
     * // Update many MapFeatures
     * const mapFeatures = await prisma.mapFeatures.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more MapFeatures and only return the `mapId`
     * const mapFeaturesWithMapIdOnly = await prisma.mapFeatures.updateManyAndReturn({
     *   select: { mapId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends MapFeaturesUpdateManyAndReturnArgs>(args: SelectSubset<T, MapFeaturesUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one MapFeatures.
     * @param {MapFeaturesUpsertArgs} args - Arguments to update or create a MapFeatures.
     * @example
     * // Update or create a MapFeatures
     * const mapFeatures = await prisma.mapFeatures.upsert({
     *   create: {
     *     // ... data to create a MapFeatures
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the MapFeatures we want to update
     *   }
     * })
     */
    upsert<T extends MapFeaturesUpsertArgs>(args: SelectSubset<T, MapFeaturesUpsertArgs<ExtArgs>>): Prisma__MapFeaturesClient<$Result.GetResult<Prisma.$MapFeaturesPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of MapFeatures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MapFeaturesCountArgs} args - Arguments to filter MapFeatures to count.
     * @example
     * // Count the number of MapFeatures
     * const count = await prisma.mapFeatures.count({
     *   where: {
     *     // ... the filter for the MapFeatures we want to count
     *   }
     * })
    **/
    count<T extends MapFeaturesCountArgs>(
      args?: Subset<T, MapFeaturesCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MapFeaturesCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a MapFeatures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MapFeaturesAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MapFeaturesAggregateArgs>(args: Subset<T, MapFeaturesAggregateArgs>): Prisma.PrismaPromise<GetMapFeaturesAggregateType<T>>

    /**
     * Group by MapFeatures.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MapFeaturesGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MapFeaturesGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MapFeaturesGroupByArgs['orderBy'] }
        : { orderBy?: MapFeaturesGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MapFeaturesGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMapFeaturesGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the MapFeatures model
   */
  readonly fields: MapFeaturesFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for MapFeatures.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MapFeaturesClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    map<T extends GameMapDefaultArgs<ExtArgs> = {}>(args?: Subset<T, GameMapDefaultArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the MapFeatures model
   */
  interface MapFeaturesFieldRefs {
    readonly mapId: FieldRef<"MapFeatures", 'String'>
    readonly totalJoins: FieldRef<"MapFeatures", 'Int'>
    readonly totalLeaves: FieldRef<"MapFeatures", 'Int'>
    readonly bounceCount: FieldRef<"MapFeatures", 'Int'>
    readonly averageDuration: FieldRef<"MapFeatures", 'Float'>
    readonly bounceRate: FieldRef<"MapFeatures", 'Float'>
    readonly medianPlaytime: FieldRef<"MapFeatures", 'Float'>
    readonly completionRate: FieldRef<"MapFeatures", 'Float'>
    readonly retentionCurve: FieldRef<"MapFeatures", 'Json'>
    readonly difficultyScore: FieldRef<"MapFeatures", 'Float'>
    readonly difficultyLabel: FieldRef<"MapFeatures", 'String'>
    readonly paceScore: FieldRef<"MapFeatures", 'Float'>
    readonly paceLabel: FieldRef<"MapFeatures", 'String'>
    readonly earlyAbandonRate: FieldRef<"MapFeatures", 'Float'>
    readonly stickyFactor: FieldRef<"MapFeatures", 'Float'>
    readonly viralityFactor: FieldRef<"MapFeatures", 'Float'>
  }
    

  // Custom InputTypes
  /**
   * MapFeatures findUnique
   */
  export type MapFeaturesFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which MapFeatures to fetch.
     */
    where: MapFeaturesWhereUniqueInput
  }

  /**
   * MapFeatures findUniqueOrThrow
   */
  export type MapFeaturesFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which MapFeatures to fetch.
     */
    where: MapFeaturesWhereUniqueInput
  }

  /**
   * MapFeatures findFirst
   */
  export type MapFeaturesFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which MapFeatures to fetch.
     */
    where?: MapFeaturesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MapFeatures to fetch.
     */
    orderBy?: MapFeaturesOrderByWithRelationInput | MapFeaturesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MapFeatures.
     */
    cursor?: MapFeaturesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MapFeatures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MapFeatures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MapFeatures.
     */
    distinct?: MapFeaturesScalarFieldEnum | MapFeaturesScalarFieldEnum[]
  }

  /**
   * MapFeatures findFirstOrThrow
   */
  export type MapFeaturesFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which MapFeatures to fetch.
     */
    where?: MapFeaturesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MapFeatures to fetch.
     */
    orderBy?: MapFeaturesOrderByWithRelationInput | MapFeaturesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for MapFeatures.
     */
    cursor?: MapFeaturesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MapFeatures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MapFeatures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MapFeatures.
     */
    distinct?: MapFeaturesScalarFieldEnum | MapFeaturesScalarFieldEnum[]
  }

  /**
   * MapFeatures findMany
   */
  export type MapFeaturesFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    /**
     * Filter, which MapFeatures to fetch.
     */
    where?: MapFeaturesWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of MapFeatures to fetch.
     */
    orderBy?: MapFeaturesOrderByWithRelationInput | MapFeaturesOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing MapFeatures.
     */
    cursor?: MapFeaturesWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` MapFeatures from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` MapFeatures.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of MapFeatures.
     */
    distinct?: MapFeaturesScalarFieldEnum | MapFeaturesScalarFieldEnum[]
  }

  /**
   * MapFeatures create
   */
  export type MapFeaturesCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    /**
     * The data needed to create a MapFeatures.
     */
    data: XOR<MapFeaturesCreateInput, MapFeaturesUncheckedCreateInput>
  }

  /**
   * MapFeatures createMany
   */
  export type MapFeaturesCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many MapFeatures.
     */
    data: MapFeaturesCreateManyInput | MapFeaturesCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * MapFeatures createManyAndReturn
   */
  export type MapFeaturesCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * The data used to create many MapFeatures.
     */
    data: MapFeaturesCreateManyInput | MapFeaturesCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * MapFeatures update
   */
  export type MapFeaturesUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    /**
     * The data needed to update a MapFeatures.
     */
    data: XOR<MapFeaturesUpdateInput, MapFeaturesUncheckedUpdateInput>
    /**
     * Choose, which MapFeatures to update.
     */
    where: MapFeaturesWhereUniqueInput
  }

  /**
   * MapFeatures updateMany
   */
  export type MapFeaturesUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update MapFeatures.
     */
    data: XOR<MapFeaturesUpdateManyMutationInput, MapFeaturesUncheckedUpdateManyInput>
    /**
     * Filter which MapFeatures to update
     */
    where?: MapFeaturesWhereInput
    /**
     * Limit how many MapFeatures to update.
     */
    limit?: number
  }

  /**
   * MapFeatures updateManyAndReturn
   */
  export type MapFeaturesUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * The data used to update MapFeatures.
     */
    data: XOR<MapFeaturesUpdateManyMutationInput, MapFeaturesUncheckedUpdateManyInput>
    /**
     * Filter which MapFeatures to update
     */
    where?: MapFeaturesWhereInput
    /**
     * Limit how many MapFeatures to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * MapFeatures upsert
   */
  export type MapFeaturesUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    /**
     * The filter to search for the MapFeatures to update in case it exists.
     */
    where: MapFeaturesWhereUniqueInput
    /**
     * In case the MapFeatures found by the `where` argument doesn't exist, create a new MapFeatures with this data.
     */
    create: XOR<MapFeaturesCreateInput, MapFeaturesUncheckedCreateInput>
    /**
     * In case the MapFeatures was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MapFeaturesUpdateInput, MapFeaturesUncheckedUpdateInput>
  }

  /**
   * MapFeatures delete
   */
  export type MapFeaturesDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
    /**
     * Filter which MapFeatures to delete.
     */
    where: MapFeaturesWhereUniqueInput
  }

  /**
   * MapFeatures deleteMany
   */
  export type MapFeaturesDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which MapFeatures to delete
     */
    where?: MapFeaturesWhereInput
    /**
     * Limit how many MapFeatures to delete.
     */
    limit?: number
  }

  /**
   * MapFeatures without action
   */
  export type MapFeaturesDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the MapFeatures
     */
    select?: MapFeaturesSelect<ExtArgs> | null
    /**
     * Omit specific fields from the MapFeatures
     */
    omit?: MapFeaturesOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MapFeaturesInclude<ExtArgs> | null
  }


  /**
   * Model SocialAffinity
   */

  export type AggregateSocialAffinity = {
    _count: SocialAffinityCountAggregateOutputType | null
    _avg: SocialAffinityAvgAggregateOutputType | null
    _sum: SocialAffinitySumAggregateOutputType | null
    _min: SocialAffinityMinAggregateOutputType | null
    _max: SocialAffinityMaxAggregateOutputType | null
  }

  export type SocialAffinityAvgAggregateOutputType = {
    affinity: number | null
  }

  export type SocialAffinitySumAggregateOutputType = {
    affinity: number | null
  }

  export type SocialAffinityMinAggregateOutputType = {
    id: string | null
    userId1: string | null
    userId2: string | null
    affinity: number | null
    updatedAt: Date | null
  }

  export type SocialAffinityMaxAggregateOutputType = {
    id: string | null
    userId1: string | null
    userId2: string | null
    affinity: number | null
    updatedAt: Date | null
  }

  export type SocialAffinityCountAggregateOutputType = {
    id: number
    userId1: number
    userId2: number
    affinity: number
    updatedAt: number
    _all: number
  }


  export type SocialAffinityAvgAggregateInputType = {
    affinity?: true
  }

  export type SocialAffinitySumAggregateInputType = {
    affinity?: true
  }

  export type SocialAffinityMinAggregateInputType = {
    id?: true
    userId1?: true
    userId2?: true
    affinity?: true
    updatedAt?: true
  }

  export type SocialAffinityMaxAggregateInputType = {
    id?: true
    userId1?: true
    userId2?: true
    affinity?: true
    updatedAt?: true
  }

  export type SocialAffinityCountAggregateInputType = {
    id?: true
    userId1?: true
    userId2?: true
    affinity?: true
    updatedAt?: true
    _all?: true
  }

  export type SocialAffinityAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SocialAffinity to aggregate.
     */
    where?: SocialAffinityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SocialAffinities to fetch.
     */
    orderBy?: SocialAffinityOrderByWithRelationInput | SocialAffinityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SocialAffinityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SocialAffinities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SocialAffinities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SocialAffinities
    **/
    _count?: true | SocialAffinityCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SocialAffinityAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SocialAffinitySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SocialAffinityMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SocialAffinityMaxAggregateInputType
  }

  export type GetSocialAffinityAggregateType<T extends SocialAffinityAggregateArgs> = {
        [P in keyof T & keyof AggregateSocialAffinity]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSocialAffinity[P]>
      : GetScalarType<T[P], AggregateSocialAffinity[P]>
  }




  export type SocialAffinityGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SocialAffinityWhereInput
    orderBy?: SocialAffinityOrderByWithAggregationInput | SocialAffinityOrderByWithAggregationInput[]
    by: SocialAffinityScalarFieldEnum[] | SocialAffinityScalarFieldEnum
    having?: SocialAffinityScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SocialAffinityCountAggregateInputType | true
    _avg?: SocialAffinityAvgAggregateInputType
    _sum?: SocialAffinitySumAggregateInputType
    _min?: SocialAffinityMinAggregateInputType
    _max?: SocialAffinityMaxAggregateInputType
  }

  export type SocialAffinityGroupByOutputType = {
    id: string
    userId1: string
    userId2: string
    affinity: number
    updatedAt: Date
    _count: SocialAffinityCountAggregateOutputType | null
    _avg: SocialAffinityAvgAggregateOutputType | null
    _sum: SocialAffinitySumAggregateOutputType | null
    _min: SocialAffinityMinAggregateOutputType | null
    _max: SocialAffinityMaxAggregateOutputType | null
  }

  type GetSocialAffinityGroupByPayload<T extends SocialAffinityGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SocialAffinityGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SocialAffinityGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SocialAffinityGroupByOutputType[P]>
            : GetScalarType<T[P], SocialAffinityGroupByOutputType[P]>
        }
      >
    >


  export type SocialAffinitySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId1?: boolean
    userId2?: boolean
    affinity?: boolean
    updatedAt?: boolean
    user1?: boolean | UserDefaultArgs<ExtArgs>
    user2?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["socialAffinity"]>

  export type SocialAffinitySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId1?: boolean
    userId2?: boolean
    affinity?: boolean
    updatedAt?: boolean
    user1?: boolean | UserDefaultArgs<ExtArgs>
    user2?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["socialAffinity"]>

  export type SocialAffinitySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId1?: boolean
    userId2?: boolean
    affinity?: boolean
    updatedAt?: boolean
    user1?: boolean | UserDefaultArgs<ExtArgs>
    user2?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["socialAffinity"]>

  export type SocialAffinitySelectScalar = {
    id?: boolean
    userId1?: boolean
    userId2?: boolean
    affinity?: boolean
    updatedAt?: boolean
  }

  export type SocialAffinityOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId1" | "userId2" | "affinity" | "updatedAt", ExtArgs["result"]["socialAffinity"]>
  export type SocialAffinityInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user1?: boolean | UserDefaultArgs<ExtArgs>
    user2?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SocialAffinityIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user1?: boolean | UserDefaultArgs<ExtArgs>
    user2?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SocialAffinityIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user1?: boolean | UserDefaultArgs<ExtArgs>
    user2?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $SocialAffinityPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SocialAffinity"
    objects: {
      user1: Prisma.$UserPayload<ExtArgs>
      user2: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId1: string
      userId2: string
      affinity: number
      updatedAt: Date
    }, ExtArgs["result"]["socialAffinity"]>
    composites: {}
  }

  type SocialAffinityGetPayload<S extends boolean | null | undefined | SocialAffinityDefaultArgs> = $Result.GetResult<Prisma.$SocialAffinityPayload, S>

  type SocialAffinityCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SocialAffinityFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SocialAffinityCountAggregateInputType | true
    }

  export interface SocialAffinityDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SocialAffinity'], meta: { name: 'SocialAffinity' } }
    /**
     * Find zero or one SocialAffinity that matches the filter.
     * @param {SocialAffinityFindUniqueArgs} args - Arguments to find a SocialAffinity
     * @example
     * // Get one SocialAffinity
     * const socialAffinity = await prisma.socialAffinity.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SocialAffinityFindUniqueArgs>(args: SelectSubset<T, SocialAffinityFindUniqueArgs<ExtArgs>>): Prisma__SocialAffinityClient<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SocialAffinity that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SocialAffinityFindUniqueOrThrowArgs} args - Arguments to find a SocialAffinity
     * @example
     * // Get one SocialAffinity
     * const socialAffinity = await prisma.socialAffinity.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SocialAffinityFindUniqueOrThrowArgs>(args: SelectSubset<T, SocialAffinityFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SocialAffinityClient<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SocialAffinity that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAffinityFindFirstArgs} args - Arguments to find a SocialAffinity
     * @example
     * // Get one SocialAffinity
     * const socialAffinity = await prisma.socialAffinity.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SocialAffinityFindFirstArgs>(args?: SelectSubset<T, SocialAffinityFindFirstArgs<ExtArgs>>): Prisma__SocialAffinityClient<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SocialAffinity that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAffinityFindFirstOrThrowArgs} args - Arguments to find a SocialAffinity
     * @example
     * // Get one SocialAffinity
     * const socialAffinity = await prisma.socialAffinity.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SocialAffinityFindFirstOrThrowArgs>(args?: SelectSubset<T, SocialAffinityFindFirstOrThrowArgs<ExtArgs>>): Prisma__SocialAffinityClient<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SocialAffinities that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAffinityFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SocialAffinities
     * const socialAffinities = await prisma.socialAffinity.findMany()
     * 
     * // Get first 10 SocialAffinities
     * const socialAffinities = await prisma.socialAffinity.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const socialAffinityWithIdOnly = await prisma.socialAffinity.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SocialAffinityFindManyArgs>(args?: SelectSubset<T, SocialAffinityFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SocialAffinity.
     * @param {SocialAffinityCreateArgs} args - Arguments to create a SocialAffinity.
     * @example
     * // Create one SocialAffinity
     * const SocialAffinity = await prisma.socialAffinity.create({
     *   data: {
     *     // ... data to create a SocialAffinity
     *   }
     * })
     * 
     */
    create<T extends SocialAffinityCreateArgs>(args: SelectSubset<T, SocialAffinityCreateArgs<ExtArgs>>): Prisma__SocialAffinityClient<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SocialAffinities.
     * @param {SocialAffinityCreateManyArgs} args - Arguments to create many SocialAffinities.
     * @example
     * // Create many SocialAffinities
     * const socialAffinity = await prisma.socialAffinity.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SocialAffinityCreateManyArgs>(args?: SelectSubset<T, SocialAffinityCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SocialAffinities and returns the data saved in the database.
     * @param {SocialAffinityCreateManyAndReturnArgs} args - Arguments to create many SocialAffinities.
     * @example
     * // Create many SocialAffinities
     * const socialAffinity = await prisma.socialAffinity.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SocialAffinities and only return the `id`
     * const socialAffinityWithIdOnly = await prisma.socialAffinity.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SocialAffinityCreateManyAndReturnArgs>(args?: SelectSubset<T, SocialAffinityCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a SocialAffinity.
     * @param {SocialAffinityDeleteArgs} args - Arguments to delete one SocialAffinity.
     * @example
     * // Delete one SocialAffinity
     * const SocialAffinity = await prisma.socialAffinity.delete({
     *   where: {
     *     // ... filter to delete one SocialAffinity
     *   }
     * })
     * 
     */
    delete<T extends SocialAffinityDeleteArgs>(args: SelectSubset<T, SocialAffinityDeleteArgs<ExtArgs>>): Prisma__SocialAffinityClient<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SocialAffinity.
     * @param {SocialAffinityUpdateArgs} args - Arguments to update one SocialAffinity.
     * @example
     * // Update one SocialAffinity
     * const socialAffinity = await prisma.socialAffinity.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SocialAffinityUpdateArgs>(args: SelectSubset<T, SocialAffinityUpdateArgs<ExtArgs>>): Prisma__SocialAffinityClient<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SocialAffinities.
     * @param {SocialAffinityDeleteManyArgs} args - Arguments to filter SocialAffinities to delete.
     * @example
     * // Delete a few SocialAffinities
     * const { count } = await prisma.socialAffinity.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SocialAffinityDeleteManyArgs>(args?: SelectSubset<T, SocialAffinityDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SocialAffinities.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAffinityUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SocialAffinities
     * const socialAffinity = await prisma.socialAffinity.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SocialAffinityUpdateManyArgs>(args: SelectSubset<T, SocialAffinityUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SocialAffinities and returns the data updated in the database.
     * @param {SocialAffinityUpdateManyAndReturnArgs} args - Arguments to update many SocialAffinities.
     * @example
     * // Update many SocialAffinities
     * const socialAffinity = await prisma.socialAffinity.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more SocialAffinities and only return the `id`
     * const socialAffinityWithIdOnly = await prisma.socialAffinity.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SocialAffinityUpdateManyAndReturnArgs>(args: SelectSubset<T, SocialAffinityUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one SocialAffinity.
     * @param {SocialAffinityUpsertArgs} args - Arguments to update or create a SocialAffinity.
     * @example
     * // Update or create a SocialAffinity
     * const socialAffinity = await prisma.socialAffinity.upsert({
     *   create: {
     *     // ... data to create a SocialAffinity
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SocialAffinity we want to update
     *   }
     * })
     */
    upsert<T extends SocialAffinityUpsertArgs>(args: SelectSubset<T, SocialAffinityUpsertArgs<ExtArgs>>): Prisma__SocialAffinityClient<$Result.GetResult<Prisma.$SocialAffinityPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SocialAffinities.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAffinityCountArgs} args - Arguments to filter SocialAffinities to count.
     * @example
     * // Count the number of SocialAffinities
     * const count = await prisma.socialAffinity.count({
     *   where: {
     *     // ... the filter for the SocialAffinities we want to count
     *   }
     * })
    **/
    count<T extends SocialAffinityCountArgs>(
      args?: Subset<T, SocialAffinityCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SocialAffinityCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SocialAffinity.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAffinityAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SocialAffinityAggregateArgs>(args: Subset<T, SocialAffinityAggregateArgs>): Prisma.PrismaPromise<GetSocialAffinityAggregateType<T>>

    /**
     * Group by SocialAffinity.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAffinityGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SocialAffinityGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SocialAffinityGroupByArgs['orderBy'] }
        : { orderBy?: SocialAffinityGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SocialAffinityGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSocialAffinityGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SocialAffinity model
   */
  readonly fields: SocialAffinityFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SocialAffinity.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SocialAffinityClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user1<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    user2<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SocialAffinity model
   */
  interface SocialAffinityFieldRefs {
    readonly id: FieldRef<"SocialAffinity", 'String'>
    readonly userId1: FieldRef<"SocialAffinity", 'String'>
    readonly userId2: FieldRef<"SocialAffinity", 'String'>
    readonly affinity: FieldRef<"SocialAffinity", 'Float'>
    readonly updatedAt: FieldRef<"SocialAffinity", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SocialAffinity findUnique
   */
  export type SocialAffinityFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    /**
     * Filter, which SocialAffinity to fetch.
     */
    where: SocialAffinityWhereUniqueInput
  }

  /**
   * SocialAffinity findUniqueOrThrow
   */
  export type SocialAffinityFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    /**
     * Filter, which SocialAffinity to fetch.
     */
    where: SocialAffinityWhereUniqueInput
  }

  /**
   * SocialAffinity findFirst
   */
  export type SocialAffinityFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    /**
     * Filter, which SocialAffinity to fetch.
     */
    where?: SocialAffinityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SocialAffinities to fetch.
     */
    orderBy?: SocialAffinityOrderByWithRelationInput | SocialAffinityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SocialAffinities.
     */
    cursor?: SocialAffinityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SocialAffinities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SocialAffinities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SocialAffinities.
     */
    distinct?: SocialAffinityScalarFieldEnum | SocialAffinityScalarFieldEnum[]
  }

  /**
   * SocialAffinity findFirstOrThrow
   */
  export type SocialAffinityFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    /**
     * Filter, which SocialAffinity to fetch.
     */
    where?: SocialAffinityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SocialAffinities to fetch.
     */
    orderBy?: SocialAffinityOrderByWithRelationInput | SocialAffinityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SocialAffinities.
     */
    cursor?: SocialAffinityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SocialAffinities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SocialAffinities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SocialAffinities.
     */
    distinct?: SocialAffinityScalarFieldEnum | SocialAffinityScalarFieldEnum[]
  }

  /**
   * SocialAffinity findMany
   */
  export type SocialAffinityFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    /**
     * Filter, which SocialAffinities to fetch.
     */
    where?: SocialAffinityWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SocialAffinities to fetch.
     */
    orderBy?: SocialAffinityOrderByWithRelationInput | SocialAffinityOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SocialAffinities.
     */
    cursor?: SocialAffinityWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SocialAffinities from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SocialAffinities.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SocialAffinities.
     */
    distinct?: SocialAffinityScalarFieldEnum | SocialAffinityScalarFieldEnum[]
  }

  /**
   * SocialAffinity create
   */
  export type SocialAffinityCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    /**
     * The data needed to create a SocialAffinity.
     */
    data: XOR<SocialAffinityCreateInput, SocialAffinityUncheckedCreateInput>
  }

  /**
   * SocialAffinity createMany
   */
  export type SocialAffinityCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SocialAffinities.
     */
    data: SocialAffinityCreateManyInput | SocialAffinityCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SocialAffinity createManyAndReturn
   */
  export type SocialAffinityCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * The data used to create many SocialAffinities.
     */
    data: SocialAffinityCreateManyInput | SocialAffinityCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * SocialAffinity update
   */
  export type SocialAffinityUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    /**
     * The data needed to update a SocialAffinity.
     */
    data: XOR<SocialAffinityUpdateInput, SocialAffinityUncheckedUpdateInput>
    /**
     * Choose, which SocialAffinity to update.
     */
    where: SocialAffinityWhereUniqueInput
  }

  /**
   * SocialAffinity updateMany
   */
  export type SocialAffinityUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SocialAffinities.
     */
    data: XOR<SocialAffinityUpdateManyMutationInput, SocialAffinityUncheckedUpdateManyInput>
    /**
     * Filter which SocialAffinities to update
     */
    where?: SocialAffinityWhereInput
    /**
     * Limit how many SocialAffinities to update.
     */
    limit?: number
  }

  /**
   * SocialAffinity updateManyAndReturn
   */
  export type SocialAffinityUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * The data used to update SocialAffinities.
     */
    data: XOR<SocialAffinityUpdateManyMutationInput, SocialAffinityUncheckedUpdateManyInput>
    /**
     * Filter which SocialAffinities to update
     */
    where?: SocialAffinityWhereInput
    /**
     * Limit how many SocialAffinities to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * SocialAffinity upsert
   */
  export type SocialAffinityUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    /**
     * The filter to search for the SocialAffinity to update in case it exists.
     */
    where: SocialAffinityWhereUniqueInput
    /**
     * In case the SocialAffinity found by the `where` argument doesn't exist, create a new SocialAffinity with this data.
     */
    create: XOR<SocialAffinityCreateInput, SocialAffinityUncheckedCreateInput>
    /**
     * In case the SocialAffinity was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SocialAffinityUpdateInput, SocialAffinityUncheckedUpdateInput>
  }

  /**
   * SocialAffinity delete
   */
  export type SocialAffinityDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
    /**
     * Filter which SocialAffinity to delete.
     */
    where: SocialAffinityWhereUniqueInput
  }

  /**
   * SocialAffinity deleteMany
   */
  export type SocialAffinityDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SocialAffinities to delete
     */
    where?: SocialAffinityWhereInput
    /**
     * Limit how many SocialAffinities to delete.
     */
    limit?: number
  }

  /**
   * SocialAffinity without action
   */
  export type SocialAffinityDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SocialAffinity
     */
    select?: SocialAffinitySelect<ExtArgs> | null
    /**
     * Omit specific fields from the SocialAffinity
     */
    omit?: SocialAffinityOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAffinityInclude<ExtArgs> | null
  }


  /**
   * Model FatiguedMap
   */

  export type AggregateFatiguedMap = {
    _count: FatiguedMapCountAggregateOutputType | null
    _min: FatiguedMapMinAggregateOutputType | null
    _max: FatiguedMapMaxAggregateOutputType | null
  }

  export type FatiguedMapMinAggregateOutputType = {
    userId: string | null
    mapId: string | null
    fatiguedAt: Date | null
    expiresAt: Date | null
  }

  export type FatiguedMapMaxAggregateOutputType = {
    userId: string | null
    mapId: string | null
    fatiguedAt: Date | null
    expiresAt: Date | null
  }

  export type FatiguedMapCountAggregateOutputType = {
    userId: number
    mapId: number
    fatiguedAt: number
    expiresAt: number
    _all: number
  }


  export type FatiguedMapMinAggregateInputType = {
    userId?: true
    mapId?: true
    fatiguedAt?: true
    expiresAt?: true
  }

  export type FatiguedMapMaxAggregateInputType = {
    userId?: true
    mapId?: true
    fatiguedAt?: true
    expiresAt?: true
  }

  export type FatiguedMapCountAggregateInputType = {
    userId?: true
    mapId?: true
    fatiguedAt?: true
    expiresAt?: true
    _all?: true
  }

  export type FatiguedMapAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FatiguedMap to aggregate.
     */
    where?: FatiguedMapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FatiguedMaps to fetch.
     */
    orderBy?: FatiguedMapOrderByWithRelationInput | FatiguedMapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: FatiguedMapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FatiguedMaps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FatiguedMaps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned FatiguedMaps
    **/
    _count?: true | FatiguedMapCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: FatiguedMapMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: FatiguedMapMaxAggregateInputType
  }

  export type GetFatiguedMapAggregateType<T extends FatiguedMapAggregateArgs> = {
        [P in keyof T & keyof AggregateFatiguedMap]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateFatiguedMap[P]>
      : GetScalarType<T[P], AggregateFatiguedMap[P]>
  }




  export type FatiguedMapGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: FatiguedMapWhereInput
    orderBy?: FatiguedMapOrderByWithAggregationInput | FatiguedMapOrderByWithAggregationInput[]
    by: FatiguedMapScalarFieldEnum[] | FatiguedMapScalarFieldEnum
    having?: FatiguedMapScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: FatiguedMapCountAggregateInputType | true
    _min?: FatiguedMapMinAggregateInputType
    _max?: FatiguedMapMaxAggregateInputType
  }

  export type FatiguedMapGroupByOutputType = {
    userId: string
    mapId: string
    fatiguedAt: Date
    expiresAt: Date
    _count: FatiguedMapCountAggregateOutputType | null
    _min: FatiguedMapMinAggregateOutputType | null
    _max: FatiguedMapMaxAggregateOutputType | null
  }

  type GetFatiguedMapGroupByPayload<T extends FatiguedMapGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<FatiguedMapGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof FatiguedMapGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], FatiguedMapGroupByOutputType[P]>
            : GetScalarType<T[P], FatiguedMapGroupByOutputType[P]>
        }
      >
    >


  export type FatiguedMapSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    mapId?: boolean
    fatiguedAt?: boolean
    expiresAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["fatiguedMap"]>

  export type FatiguedMapSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    mapId?: boolean
    fatiguedAt?: boolean
    expiresAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["fatiguedMap"]>

  export type FatiguedMapSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    mapId?: boolean
    fatiguedAt?: boolean
    expiresAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["fatiguedMap"]>

  export type FatiguedMapSelectScalar = {
    userId?: boolean
    mapId?: boolean
    fatiguedAt?: boolean
    expiresAt?: boolean
  }

  export type FatiguedMapOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"userId" | "mapId" | "fatiguedAt" | "expiresAt", ExtArgs["result"]["fatiguedMap"]>
  export type FatiguedMapInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }
  export type FatiguedMapIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }
  export type FatiguedMapIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    map?: boolean | GameMapDefaultArgs<ExtArgs>
  }

  export type $FatiguedMapPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "FatiguedMap"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      map: Prisma.$GameMapPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      userId: string
      mapId: string
      fatiguedAt: Date
      expiresAt: Date
    }, ExtArgs["result"]["fatiguedMap"]>
    composites: {}
  }

  type FatiguedMapGetPayload<S extends boolean | null | undefined | FatiguedMapDefaultArgs> = $Result.GetResult<Prisma.$FatiguedMapPayload, S>

  type FatiguedMapCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<FatiguedMapFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: FatiguedMapCountAggregateInputType | true
    }

  export interface FatiguedMapDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['FatiguedMap'], meta: { name: 'FatiguedMap' } }
    /**
     * Find zero or one FatiguedMap that matches the filter.
     * @param {FatiguedMapFindUniqueArgs} args - Arguments to find a FatiguedMap
     * @example
     * // Get one FatiguedMap
     * const fatiguedMap = await prisma.fatiguedMap.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends FatiguedMapFindUniqueArgs>(args: SelectSubset<T, FatiguedMapFindUniqueArgs<ExtArgs>>): Prisma__FatiguedMapClient<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one FatiguedMap that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {FatiguedMapFindUniqueOrThrowArgs} args - Arguments to find a FatiguedMap
     * @example
     * // Get one FatiguedMap
     * const fatiguedMap = await prisma.fatiguedMap.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends FatiguedMapFindUniqueOrThrowArgs>(args: SelectSubset<T, FatiguedMapFindUniqueOrThrowArgs<ExtArgs>>): Prisma__FatiguedMapClient<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first FatiguedMap that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FatiguedMapFindFirstArgs} args - Arguments to find a FatiguedMap
     * @example
     * // Get one FatiguedMap
     * const fatiguedMap = await prisma.fatiguedMap.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends FatiguedMapFindFirstArgs>(args?: SelectSubset<T, FatiguedMapFindFirstArgs<ExtArgs>>): Prisma__FatiguedMapClient<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first FatiguedMap that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FatiguedMapFindFirstOrThrowArgs} args - Arguments to find a FatiguedMap
     * @example
     * // Get one FatiguedMap
     * const fatiguedMap = await prisma.fatiguedMap.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends FatiguedMapFindFirstOrThrowArgs>(args?: SelectSubset<T, FatiguedMapFindFirstOrThrowArgs<ExtArgs>>): Prisma__FatiguedMapClient<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more FatiguedMaps that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FatiguedMapFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all FatiguedMaps
     * const fatiguedMaps = await prisma.fatiguedMap.findMany()
     * 
     * // Get first 10 FatiguedMaps
     * const fatiguedMaps = await prisma.fatiguedMap.findMany({ take: 10 })
     * 
     * // Only select the `userId`
     * const fatiguedMapWithUserIdOnly = await prisma.fatiguedMap.findMany({ select: { userId: true } })
     * 
     */
    findMany<T extends FatiguedMapFindManyArgs>(args?: SelectSubset<T, FatiguedMapFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a FatiguedMap.
     * @param {FatiguedMapCreateArgs} args - Arguments to create a FatiguedMap.
     * @example
     * // Create one FatiguedMap
     * const FatiguedMap = await prisma.fatiguedMap.create({
     *   data: {
     *     // ... data to create a FatiguedMap
     *   }
     * })
     * 
     */
    create<T extends FatiguedMapCreateArgs>(args: SelectSubset<T, FatiguedMapCreateArgs<ExtArgs>>): Prisma__FatiguedMapClient<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many FatiguedMaps.
     * @param {FatiguedMapCreateManyArgs} args - Arguments to create many FatiguedMaps.
     * @example
     * // Create many FatiguedMaps
     * const fatiguedMap = await prisma.fatiguedMap.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends FatiguedMapCreateManyArgs>(args?: SelectSubset<T, FatiguedMapCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many FatiguedMaps and returns the data saved in the database.
     * @param {FatiguedMapCreateManyAndReturnArgs} args - Arguments to create many FatiguedMaps.
     * @example
     * // Create many FatiguedMaps
     * const fatiguedMap = await prisma.fatiguedMap.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many FatiguedMaps and only return the `userId`
     * const fatiguedMapWithUserIdOnly = await prisma.fatiguedMap.createManyAndReturn({
     *   select: { userId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends FatiguedMapCreateManyAndReturnArgs>(args?: SelectSubset<T, FatiguedMapCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a FatiguedMap.
     * @param {FatiguedMapDeleteArgs} args - Arguments to delete one FatiguedMap.
     * @example
     * // Delete one FatiguedMap
     * const FatiguedMap = await prisma.fatiguedMap.delete({
     *   where: {
     *     // ... filter to delete one FatiguedMap
     *   }
     * })
     * 
     */
    delete<T extends FatiguedMapDeleteArgs>(args: SelectSubset<T, FatiguedMapDeleteArgs<ExtArgs>>): Prisma__FatiguedMapClient<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one FatiguedMap.
     * @param {FatiguedMapUpdateArgs} args - Arguments to update one FatiguedMap.
     * @example
     * // Update one FatiguedMap
     * const fatiguedMap = await prisma.fatiguedMap.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends FatiguedMapUpdateArgs>(args: SelectSubset<T, FatiguedMapUpdateArgs<ExtArgs>>): Prisma__FatiguedMapClient<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more FatiguedMaps.
     * @param {FatiguedMapDeleteManyArgs} args - Arguments to filter FatiguedMaps to delete.
     * @example
     * // Delete a few FatiguedMaps
     * const { count } = await prisma.fatiguedMap.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends FatiguedMapDeleteManyArgs>(args?: SelectSubset<T, FatiguedMapDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more FatiguedMaps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FatiguedMapUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many FatiguedMaps
     * const fatiguedMap = await prisma.fatiguedMap.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends FatiguedMapUpdateManyArgs>(args: SelectSubset<T, FatiguedMapUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more FatiguedMaps and returns the data updated in the database.
     * @param {FatiguedMapUpdateManyAndReturnArgs} args - Arguments to update many FatiguedMaps.
     * @example
     * // Update many FatiguedMaps
     * const fatiguedMap = await prisma.fatiguedMap.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more FatiguedMaps and only return the `userId`
     * const fatiguedMapWithUserIdOnly = await prisma.fatiguedMap.updateManyAndReturn({
     *   select: { userId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends FatiguedMapUpdateManyAndReturnArgs>(args: SelectSubset<T, FatiguedMapUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one FatiguedMap.
     * @param {FatiguedMapUpsertArgs} args - Arguments to update or create a FatiguedMap.
     * @example
     * // Update or create a FatiguedMap
     * const fatiguedMap = await prisma.fatiguedMap.upsert({
     *   create: {
     *     // ... data to create a FatiguedMap
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the FatiguedMap we want to update
     *   }
     * })
     */
    upsert<T extends FatiguedMapUpsertArgs>(args: SelectSubset<T, FatiguedMapUpsertArgs<ExtArgs>>): Prisma__FatiguedMapClient<$Result.GetResult<Prisma.$FatiguedMapPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of FatiguedMaps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FatiguedMapCountArgs} args - Arguments to filter FatiguedMaps to count.
     * @example
     * // Count the number of FatiguedMaps
     * const count = await prisma.fatiguedMap.count({
     *   where: {
     *     // ... the filter for the FatiguedMaps we want to count
     *   }
     * })
    **/
    count<T extends FatiguedMapCountArgs>(
      args?: Subset<T, FatiguedMapCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], FatiguedMapCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a FatiguedMap.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FatiguedMapAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends FatiguedMapAggregateArgs>(args: Subset<T, FatiguedMapAggregateArgs>): Prisma.PrismaPromise<GetFatiguedMapAggregateType<T>>

    /**
     * Group by FatiguedMap.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {FatiguedMapGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends FatiguedMapGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: FatiguedMapGroupByArgs['orderBy'] }
        : { orderBy?: FatiguedMapGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, FatiguedMapGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetFatiguedMapGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the FatiguedMap model
   */
  readonly fields: FatiguedMapFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for FatiguedMap.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__FatiguedMapClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    map<T extends GameMapDefaultArgs<ExtArgs> = {}>(args?: Subset<T, GameMapDefaultArgs<ExtArgs>>): Prisma__GameMapClient<$Result.GetResult<Prisma.$GameMapPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the FatiguedMap model
   */
  interface FatiguedMapFieldRefs {
    readonly userId: FieldRef<"FatiguedMap", 'String'>
    readonly mapId: FieldRef<"FatiguedMap", 'String'>
    readonly fatiguedAt: FieldRef<"FatiguedMap", 'DateTime'>
    readonly expiresAt: FieldRef<"FatiguedMap", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * FatiguedMap findUnique
   */
  export type FatiguedMapFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    /**
     * Filter, which FatiguedMap to fetch.
     */
    where: FatiguedMapWhereUniqueInput
  }

  /**
   * FatiguedMap findUniqueOrThrow
   */
  export type FatiguedMapFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    /**
     * Filter, which FatiguedMap to fetch.
     */
    where: FatiguedMapWhereUniqueInput
  }

  /**
   * FatiguedMap findFirst
   */
  export type FatiguedMapFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    /**
     * Filter, which FatiguedMap to fetch.
     */
    where?: FatiguedMapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FatiguedMaps to fetch.
     */
    orderBy?: FatiguedMapOrderByWithRelationInput | FatiguedMapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FatiguedMaps.
     */
    cursor?: FatiguedMapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FatiguedMaps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FatiguedMaps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FatiguedMaps.
     */
    distinct?: FatiguedMapScalarFieldEnum | FatiguedMapScalarFieldEnum[]
  }

  /**
   * FatiguedMap findFirstOrThrow
   */
  export type FatiguedMapFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    /**
     * Filter, which FatiguedMap to fetch.
     */
    where?: FatiguedMapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FatiguedMaps to fetch.
     */
    orderBy?: FatiguedMapOrderByWithRelationInput | FatiguedMapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for FatiguedMaps.
     */
    cursor?: FatiguedMapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FatiguedMaps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FatiguedMaps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FatiguedMaps.
     */
    distinct?: FatiguedMapScalarFieldEnum | FatiguedMapScalarFieldEnum[]
  }

  /**
   * FatiguedMap findMany
   */
  export type FatiguedMapFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    /**
     * Filter, which FatiguedMaps to fetch.
     */
    where?: FatiguedMapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of FatiguedMaps to fetch.
     */
    orderBy?: FatiguedMapOrderByWithRelationInput | FatiguedMapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing FatiguedMaps.
     */
    cursor?: FatiguedMapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` FatiguedMaps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` FatiguedMaps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of FatiguedMaps.
     */
    distinct?: FatiguedMapScalarFieldEnum | FatiguedMapScalarFieldEnum[]
  }

  /**
   * FatiguedMap create
   */
  export type FatiguedMapCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    /**
     * The data needed to create a FatiguedMap.
     */
    data: XOR<FatiguedMapCreateInput, FatiguedMapUncheckedCreateInput>
  }

  /**
   * FatiguedMap createMany
   */
  export type FatiguedMapCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many FatiguedMaps.
     */
    data: FatiguedMapCreateManyInput | FatiguedMapCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * FatiguedMap createManyAndReturn
   */
  export type FatiguedMapCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * The data used to create many FatiguedMaps.
     */
    data: FatiguedMapCreateManyInput | FatiguedMapCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * FatiguedMap update
   */
  export type FatiguedMapUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    /**
     * The data needed to update a FatiguedMap.
     */
    data: XOR<FatiguedMapUpdateInput, FatiguedMapUncheckedUpdateInput>
    /**
     * Choose, which FatiguedMap to update.
     */
    where: FatiguedMapWhereUniqueInput
  }

  /**
   * FatiguedMap updateMany
   */
  export type FatiguedMapUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update FatiguedMaps.
     */
    data: XOR<FatiguedMapUpdateManyMutationInput, FatiguedMapUncheckedUpdateManyInput>
    /**
     * Filter which FatiguedMaps to update
     */
    where?: FatiguedMapWhereInput
    /**
     * Limit how many FatiguedMaps to update.
     */
    limit?: number
  }

  /**
   * FatiguedMap updateManyAndReturn
   */
  export type FatiguedMapUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * The data used to update FatiguedMaps.
     */
    data: XOR<FatiguedMapUpdateManyMutationInput, FatiguedMapUncheckedUpdateManyInput>
    /**
     * Filter which FatiguedMaps to update
     */
    where?: FatiguedMapWhereInput
    /**
     * Limit how many FatiguedMaps to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * FatiguedMap upsert
   */
  export type FatiguedMapUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    /**
     * The filter to search for the FatiguedMap to update in case it exists.
     */
    where: FatiguedMapWhereUniqueInput
    /**
     * In case the FatiguedMap found by the `where` argument doesn't exist, create a new FatiguedMap with this data.
     */
    create: XOR<FatiguedMapCreateInput, FatiguedMapUncheckedCreateInput>
    /**
     * In case the FatiguedMap was found with the provided `where` argument, update it with this data.
     */
    update: XOR<FatiguedMapUpdateInput, FatiguedMapUncheckedUpdateInput>
  }

  /**
   * FatiguedMap delete
   */
  export type FatiguedMapDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
    /**
     * Filter which FatiguedMap to delete.
     */
    where: FatiguedMapWhereUniqueInput
  }

  /**
   * FatiguedMap deleteMany
   */
  export type FatiguedMapDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which FatiguedMaps to delete
     */
    where?: FatiguedMapWhereInput
    /**
     * Limit how many FatiguedMaps to delete.
     */
    limit?: number
  }

  /**
   * FatiguedMap without action
   */
  export type FatiguedMapDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the FatiguedMap
     */
    select?: FatiguedMapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the FatiguedMap
     */
    omit?: FatiguedMapOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: FatiguedMapInclude<ExtArgs> | null
  }


  /**
   * Model DataQuarantine
   */

  export type AggregateDataQuarantine = {
    _count: DataQuarantineCountAggregateOutputType | null
    _min: DataQuarantineMinAggregateOutputType | null
    _max: DataQuarantineMaxAggregateOutputType | null
  }

  export type DataQuarantineMinAggregateOutputType = {
    id: string | null
    originalId: string | null
    eventType: string | null
    userId: string | null
    timestamp: Date | null
    reason: string | null
    quarantinedAt: Date | null
  }

  export type DataQuarantineMaxAggregateOutputType = {
    id: string | null
    originalId: string | null
    eventType: string | null
    userId: string | null
    timestamp: Date | null
    reason: string | null
    quarantinedAt: Date | null
  }

  export type DataQuarantineCountAggregateOutputType = {
    id: number
    originalId: number
    eventType: number
    userId: number
    timestamp: number
    payload: number
    reason: number
    quarantinedAt: number
    _all: number
  }


  export type DataQuarantineMinAggregateInputType = {
    id?: true
    originalId?: true
    eventType?: true
    userId?: true
    timestamp?: true
    reason?: true
    quarantinedAt?: true
  }

  export type DataQuarantineMaxAggregateInputType = {
    id?: true
    originalId?: true
    eventType?: true
    userId?: true
    timestamp?: true
    reason?: true
    quarantinedAt?: true
  }

  export type DataQuarantineCountAggregateInputType = {
    id?: true
    originalId?: true
    eventType?: true
    userId?: true
    timestamp?: true
    payload?: true
    reason?: true
    quarantinedAt?: true
    _all?: true
  }

  export type DataQuarantineAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DataQuarantine to aggregate.
     */
    where?: DataQuarantineWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DataQuarantines to fetch.
     */
    orderBy?: DataQuarantineOrderByWithRelationInput | DataQuarantineOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DataQuarantineWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DataQuarantines from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DataQuarantines.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned DataQuarantines
    **/
    _count?: true | DataQuarantineCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DataQuarantineMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DataQuarantineMaxAggregateInputType
  }

  export type GetDataQuarantineAggregateType<T extends DataQuarantineAggregateArgs> = {
        [P in keyof T & keyof AggregateDataQuarantine]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDataQuarantine[P]>
      : GetScalarType<T[P], AggregateDataQuarantine[P]>
  }




  export type DataQuarantineGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DataQuarantineWhereInput
    orderBy?: DataQuarantineOrderByWithAggregationInput | DataQuarantineOrderByWithAggregationInput[]
    by: DataQuarantineScalarFieldEnum[] | DataQuarantineScalarFieldEnum
    having?: DataQuarantineScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DataQuarantineCountAggregateInputType | true
    _min?: DataQuarantineMinAggregateInputType
    _max?: DataQuarantineMaxAggregateInputType
  }

  export type DataQuarantineGroupByOutputType = {
    id: string
    originalId: string | null
    eventType: string
    userId: string | null
    timestamp: Date
    payload: JsonValue
    reason: string
    quarantinedAt: Date
    _count: DataQuarantineCountAggregateOutputType | null
    _min: DataQuarantineMinAggregateOutputType | null
    _max: DataQuarantineMaxAggregateOutputType | null
  }

  type GetDataQuarantineGroupByPayload<T extends DataQuarantineGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DataQuarantineGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DataQuarantineGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DataQuarantineGroupByOutputType[P]>
            : GetScalarType<T[P], DataQuarantineGroupByOutputType[P]>
        }
      >
    >


  export type DataQuarantineSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    originalId?: boolean
    eventType?: boolean
    userId?: boolean
    timestamp?: boolean
    payload?: boolean
    reason?: boolean
    quarantinedAt?: boolean
  }, ExtArgs["result"]["dataQuarantine"]>

  export type DataQuarantineSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    originalId?: boolean
    eventType?: boolean
    userId?: boolean
    timestamp?: boolean
    payload?: boolean
    reason?: boolean
    quarantinedAt?: boolean
  }, ExtArgs["result"]["dataQuarantine"]>

  export type DataQuarantineSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    originalId?: boolean
    eventType?: boolean
    userId?: boolean
    timestamp?: boolean
    payload?: boolean
    reason?: boolean
    quarantinedAt?: boolean
  }, ExtArgs["result"]["dataQuarantine"]>

  export type DataQuarantineSelectScalar = {
    id?: boolean
    originalId?: boolean
    eventType?: boolean
    userId?: boolean
    timestamp?: boolean
    payload?: boolean
    reason?: boolean
    quarantinedAt?: boolean
  }

  export type DataQuarantineOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "originalId" | "eventType" | "userId" | "timestamp" | "payload" | "reason" | "quarantinedAt", ExtArgs["result"]["dataQuarantine"]>

  export type $DataQuarantinePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "DataQuarantine"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      originalId: string | null
      eventType: string
      userId: string | null
      timestamp: Date
      payload: Prisma.JsonValue
      reason: string
      quarantinedAt: Date
    }, ExtArgs["result"]["dataQuarantine"]>
    composites: {}
  }

  type DataQuarantineGetPayload<S extends boolean | null | undefined | DataQuarantineDefaultArgs> = $Result.GetResult<Prisma.$DataQuarantinePayload, S>

  type DataQuarantineCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<DataQuarantineFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: DataQuarantineCountAggregateInputType | true
    }

  export interface DataQuarantineDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['DataQuarantine'], meta: { name: 'DataQuarantine' } }
    /**
     * Find zero or one DataQuarantine that matches the filter.
     * @param {DataQuarantineFindUniqueArgs} args - Arguments to find a DataQuarantine
     * @example
     * // Get one DataQuarantine
     * const dataQuarantine = await prisma.dataQuarantine.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DataQuarantineFindUniqueArgs>(args: SelectSubset<T, DataQuarantineFindUniqueArgs<ExtArgs>>): Prisma__DataQuarantineClient<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one DataQuarantine that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DataQuarantineFindUniqueOrThrowArgs} args - Arguments to find a DataQuarantine
     * @example
     * // Get one DataQuarantine
     * const dataQuarantine = await prisma.dataQuarantine.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DataQuarantineFindUniqueOrThrowArgs>(args: SelectSubset<T, DataQuarantineFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DataQuarantineClient<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DataQuarantine that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DataQuarantineFindFirstArgs} args - Arguments to find a DataQuarantine
     * @example
     * // Get one DataQuarantine
     * const dataQuarantine = await prisma.dataQuarantine.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DataQuarantineFindFirstArgs>(args?: SelectSubset<T, DataQuarantineFindFirstArgs<ExtArgs>>): Prisma__DataQuarantineClient<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DataQuarantine that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DataQuarantineFindFirstOrThrowArgs} args - Arguments to find a DataQuarantine
     * @example
     * // Get one DataQuarantine
     * const dataQuarantine = await prisma.dataQuarantine.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DataQuarantineFindFirstOrThrowArgs>(args?: SelectSubset<T, DataQuarantineFindFirstOrThrowArgs<ExtArgs>>): Prisma__DataQuarantineClient<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more DataQuarantines that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DataQuarantineFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DataQuarantines
     * const dataQuarantines = await prisma.dataQuarantine.findMany()
     * 
     * // Get first 10 DataQuarantines
     * const dataQuarantines = await prisma.dataQuarantine.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const dataQuarantineWithIdOnly = await prisma.dataQuarantine.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DataQuarantineFindManyArgs>(args?: SelectSubset<T, DataQuarantineFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a DataQuarantine.
     * @param {DataQuarantineCreateArgs} args - Arguments to create a DataQuarantine.
     * @example
     * // Create one DataQuarantine
     * const DataQuarantine = await prisma.dataQuarantine.create({
     *   data: {
     *     // ... data to create a DataQuarantine
     *   }
     * })
     * 
     */
    create<T extends DataQuarantineCreateArgs>(args: SelectSubset<T, DataQuarantineCreateArgs<ExtArgs>>): Prisma__DataQuarantineClient<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many DataQuarantines.
     * @param {DataQuarantineCreateManyArgs} args - Arguments to create many DataQuarantines.
     * @example
     * // Create many DataQuarantines
     * const dataQuarantine = await prisma.dataQuarantine.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DataQuarantineCreateManyArgs>(args?: SelectSubset<T, DataQuarantineCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many DataQuarantines and returns the data saved in the database.
     * @param {DataQuarantineCreateManyAndReturnArgs} args - Arguments to create many DataQuarantines.
     * @example
     * // Create many DataQuarantines
     * const dataQuarantine = await prisma.dataQuarantine.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many DataQuarantines and only return the `id`
     * const dataQuarantineWithIdOnly = await prisma.dataQuarantine.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DataQuarantineCreateManyAndReturnArgs>(args?: SelectSubset<T, DataQuarantineCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a DataQuarantine.
     * @param {DataQuarantineDeleteArgs} args - Arguments to delete one DataQuarantine.
     * @example
     * // Delete one DataQuarantine
     * const DataQuarantine = await prisma.dataQuarantine.delete({
     *   where: {
     *     // ... filter to delete one DataQuarantine
     *   }
     * })
     * 
     */
    delete<T extends DataQuarantineDeleteArgs>(args: SelectSubset<T, DataQuarantineDeleteArgs<ExtArgs>>): Prisma__DataQuarantineClient<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one DataQuarantine.
     * @param {DataQuarantineUpdateArgs} args - Arguments to update one DataQuarantine.
     * @example
     * // Update one DataQuarantine
     * const dataQuarantine = await prisma.dataQuarantine.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DataQuarantineUpdateArgs>(args: SelectSubset<T, DataQuarantineUpdateArgs<ExtArgs>>): Prisma__DataQuarantineClient<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more DataQuarantines.
     * @param {DataQuarantineDeleteManyArgs} args - Arguments to filter DataQuarantines to delete.
     * @example
     * // Delete a few DataQuarantines
     * const { count } = await prisma.dataQuarantine.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DataQuarantineDeleteManyArgs>(args?: SelectSubset<T, DataQuarantineDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DataQuarantines.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DataQuarantineUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DataQuarantines
     * const dataQuarantine = await prisma.dataQuarantine.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DataQuarantineUpdateManyArgs>(args: SelectSubset<T, DataQuarantineUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DataQuarantines and returns the data updated in the database.
     * @param {DataQuarantineUpdateManyAndReturnArgs} args - Arguments to update many DataQuarantines.
     * @example
     * // Update many DataQuarantines
     * const dataQuarantine = await prisma.dataQuarantine.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more DataQuarantines and only return the `id`
     * const dataQuarantineWithIdOnly = await prisma.dataQuarantine.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends DataQuarantineUpdateManyAndReturnArgs>(args: SelectSubset<T, DataQuarantineUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one DataQuarantine.
     * @param {DataQuarantineUpsertArgs} args - Arguments to update or create a DataQuarantine.
     * @example
     * // Update or create a DataQuarantine
     * const dataQuarantine = await prisma.dataQuarantine.upsert({
     *   create: {
     *     // ... data to create a DataQuarantine
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DataQuarantine we want to update
     *   }
     * })
     */
    upsert<T extends DataQuarantineUpsertArgs>(args: SelectSubset<T, DataQuarantineUpsertArgs<ExtArgs>>): Prisma__DataQuarantineClient<$Result.GetResult<Prisma.$DataQuarantinePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of DataQuarantines.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DataQuarantineCountArgs} args - Arguments to filter DataQuarantines to count.
     * @example
     * // Count the number of DataQuarantines
     * const count = await prisma.dataQuarantine.count({
     *   where: {
     *     // ... the filter for the DataQuarantines we want to count
     *   }
     * })
    **/
    count<T extends DataQuarantineCountArgs>(
      args?: Subset<T, DataQuarantineCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DataQuarantineCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a DataQuarantine.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DataQuarantineAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DataQuarantineAggregateArgs>(args: Subset<T, DataQuarantineAggregateArgs>): Prisma.PrismaPromise<GetDataQuarantineAggregateType<T>>

    /**
     * Group by DataQuarantine.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DataQuarantineGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DataQuarantineGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DataQuarantineGroupByArgs['orderBy'] }
        : { orderBy?: DataQuarantineGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DataQuarantineGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDataQuarantineGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the DataQuarantine model
   */
  readonly fields: DataQuarantineFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for DataQuarantine.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DataQuarantineClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the DataQuarantine model
   */
  interface DataQuarantineFieldRefs {
    readonly id: FieldRef<"DataQuarantine", 'String'>
    readonly originalId: FieldRef<"DataQuarantine", 'String'>
    readonly eventType: FieldRef<"DataQuarantine", 'String'>
    readonly userId: FieldRef<"DataQuarantine", 'String'>
    readonly timestamp: FieldRef<"DataQuarantine", 'DateTime'>
    readonly payload: FieldRef<"DataQuarantine", 'Json'>
    readonly reason: FieldRef<"DataQuarantine", 'String'>
    readonly quarantinedAt: FieldRef<"DataQuarantine", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * DataQuarantine findUnique
   */
  export type DataQuarantineFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * Filter, which DataQuarantine to fetch.
     */
    where: DataQuarantineWhereUniqueInput
  }

  /**
   * DataQuarantine findUniqueOrThrow
   */
  export type DataQuarantineFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * Filter, which DataQuarantine to fetch.
     */
    where: DataQuarantineWhereUniqueInput
  }

  /**
   * DataQuarantine findFirst
   */
  export type DataQuarantineFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * Filter, which DataQuarantine to fetch.
     */
    where?: DataQuarantineWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DataQuarantines to fetch.
     */
    orderBy?: DataQuarantineOrderByWithRelationInput | DataQuarantineOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DataQuarantines.
     */
    cursor?: DataQuarantineWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DataQuarantines from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DataQuarantines.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DataQuarantines.
     */
    distinct?: DataQuarantineScalarFieldEnum | DataQuarantineScalarFieldEnum[]
  }

  /**
   * DataQuarantine findFirstOrThrow
   */
  export type DataQuarantineFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * Filter, which DataQuarantine to fetch.
     */
    where?: DataQuarantineWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DataQuarantines to fetch.
     */
    orderBy?: DataQuarantineOrderByWithRelationInput | DataQuarantineOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DataQuarantines.
     */
    cursor?: DataQuarantineWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DataQuarantines from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DataQuarantines.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DataQuarantines.
     */
    distinct?: DataQuarantineScalarFieldEnum | DataQuarantineScalarFieldEnum[]
  }

  /**
   * DataQuarantine findMany
   */
  export type DataQuarantineFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * Filter, which DataQuarantines to fetch.
     */
    where?: DataQuarantineWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DataQuarantines to fetch.
     */
    orderBy?: DataQuarantineOrderByWithRelationInput | DataQuarantineOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing DataQuarantines.
     */
    cursor?: DataQuarantineWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DataQuarantines from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DataQuarantines.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DataQuarantines.
     */
    distinct?: DataQuarantineScalarFieldEnum | DataQuarantineScalarFieldEnum[]
  }

  /**
   * DataQuarantine create
   */
  export type DataQuarantineCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * The data needed to create a DataQuarantine.
     */
    data: XOR<DataQuarantineCreateInput, DataQuarantineUncheckedCreateInput>
  }

  /**
   * DataQuarantine createMany
   */
  export type DataQuarantineCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many DataQuarantines.
     */
    data: DataQuarantineCreateManyInput | DataQuarantineCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * DataQuarantine createManyAndReturn
   */
  export type DataQuarantineCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * The data used to create many DataQuarantines.
     */
    data: DataQuarantineCreateManyInput | DataQuarantineCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * DataQuarantine update
   */
  export type DataQuarantineUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * The data needed to update a DataQuarantine.
     */
    data: XOR<DataQuarantineUpdateInput, DataQuarantineUncheckedUpdateInput>
    /**
     * Choose, which DataQuarantine to update.
     */
    where: DataQuarantineWhereUniqueInput
  }

  /**
   * DataQuarantine updateMany
   */
  export type DataQuarantineUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update DataQuarantines.
     */
    data: XOR<DataQuarantineUpdateManyMutationInput, DataQuarantineUncheckedUpdateManyInput>
    /**
     * Filter which DataQuarantines to update
     */
    where?: DataQuarantineWhereInput
    /**
     * Limit how many DataQuarantines to update.
     */
    limit?: number
  }

  /**
   * DataQuarantine updateManyAndReturn
   */
  export type DataQuarantineUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * The data used to update DataQuarantines.
     */
    data: XOR<DataQuarantineUpdateManyMutationInput, DataQuarantineUncheckedUpdateManyInput>
    /**
     * Filter which DataQuarantines to update
     */
    where?: DataQuarantineWhereInput
    /**
     * Limit how many DataQuarantines to update.
     */
    limit?: number
  }

  /**
   * DataQuarantine upsert
   */
  export type DataQuarantineUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * The filter to search for the DataQuarantine to update in case it exists.
     */
    where: DataQuarantineWhereUniqueInput
    /**
     * In case the DataQuarantine found by the `where` argument doesn't exist, create a new DataQuarantine with this data.
     */
    create: XOR<DataQuarantineCreateInput, DataQuarantineUncheckedCreateInput>
    /**
     * In case the DataQuarantine was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DataQuarantineUpdateInput, DataQuarantineUncheckedUpdateInput>
  }

  /**
   * DataQuarantine delete
   */
  export type DataQuarantineDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
    /**
     * Filter which DataQuarantine to delete.
     */
    where: DataQuarantineWhereUniqueInput
  }

  /**
   * DataQuarantine deleteMany
   */
  export type DataQuarantineDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DataQuarantines to delete
     */
    where?: DataQuarantineWhereInput
    /**
     * Limit how many DataQuarantines to delete.
     */
    limit?: number
  }

  /**
   * DataQuarantine without action
   */
  export type DataQuarantineDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DataQuarantine
     */
    select?: DataQuarantineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DataQuarantine
     */
    omit?: DataQuarantineOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    username: 'username',
    displayName: 'displayName',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const GameMapScalarFieldEnum: {
    id: 'id',
    slug: 'slug',
    name: 'name',
    ownerId: 'ownerId',
    isPublished: 'isPublished',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type GameMapScalarFieldEnum = (typeof GameMapScalarFieldEnum)[keyof typeof GameMapScalarFieldEnum]


  export const RawEventScalarFieldEnum: {
    id: 'id',
    eventType: 'eventType',
    userId: 'userId',
    timestamp: 'timestamp',
    payload: 'payload'
  };

  export type RawEventScalarFieldEnum = (typeof RawEventScalarFieldEnum)[keyof typeof RawEventScalarFieldEnum]


  export const PlayerFeaturesScalarFieldEnum: {
    userId: 'userId',
    lastActive: 'lastActive',
    totalPlayTime: 'totalPlayTime',
    matchesPlayed: 'matchesPlayed',
    preferredLanguage: 'preferredLanguage',
    explorerRatio: 'explorerRatio',
    playerProfile: 'playerProfile',
    popularitySensitivity: 'popularitySensitivity',
    returnIntent: 'returnIntent',
    scheduleProfile: 'scheduleProfile'
  };

  export type PlayerFeaturesScalarFieldEnum = (typeof PlayerFeaturesScalarFieldEnum)[keyof typeof PlayerFeaturesScalarFieldEnum]


  export const MapFeaturesScalarFieldEnum: {
    mapId: 'mapId',
    totalJoins: 'totalJoins',
    totalLeaves: 'totalLeaves',
    bounceCount: 'bounceCount',
    averageDuration: 'averageDuration',
    bounceRate: 'bounceRate',
    medianPlaytime: 'medianPlaytime',
    completionRate: 'completionRate',
    retentionCurve: 'retentionCurve',
    difficultyScore: 'difficultyScore',
    difficultyLabel: 'difficultyLabel',
    paceScore: 'paceScore',
    paceLabel: 'paceLabel',
    earlyAbandonRate: 'earlyAbandonRate',
    stickyFactor: 'stickyFactor',
    viralityFactor: 'viralityFactor'
  };

  export type MapFeaturesScalarFieldEnum = (typeof MapFeaturesScalarFieldEnum)[keyof typeof MapFeaturesScalarFieldEnum]


  export const SocialAffinityScalarFieldEnum: {
    id: 'id',
    userId1: 'userId1',
    userId2: 'userId2',
    affinity: 'affinity',
    updatedAt: 'updatedAt'
  };

  export type SocialAffinityScalarFieldEnum = (typeof SocialAffinityScalarFieldEnum)[keyof typeof SocialAffinityScalarFieldEnum]


  export const FatiguedMapScalarFieldEnum: {
    userId: 'userId',
    mapId: 'mapId',
    fatiguedAt: 'fatiguedAt',
    expiresAt: 'expiresAt'
  };

  export type FatiguedMapScalarFieldEnum = (typeof FatiguedMapScalarFieldEnum)[keyof typeof FatiguedMapScalarFieldEnum]


  export const DataQuarantineScalarFieldEnum: {
    id: 'id',
    originalId: 'originalId',
    eventType: 'eventType',
    userId: 'userId',
    timestamp: 'timestamp',
    payload: 'payload',
    reason: 'reason',
    quarantinedAt: 'quarantinedAt'
  };

  export type DataQuarantineScalarFieldEnum = (typeof DataQuarantineScalarFieldEnum)[keyof typeof DataQuarantineScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    username?: StringFilter<"User"> | string
    displayName?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    events?: RawEventListRelationFilter
    playerFeatures?: XOR<PlayerFeaturesNullableScalarRelationFilter, PlayerFeaturesWhereInput> | null
    socialAffinity1?: SocialAffinityListRelationFilter
    socialAffinity2?: SocialAffinityListRelationFilter
    fatiguedMaps?: FatiguedMapListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    username?: SortOrder
    displayName?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    events?: RawEventOrderByRelationAggregateInput
    playerFeatures?: PlayerFeaturesOrderByWithRelationInput
    socialAffinity1?: SocialAffinityOrderByRelationAggregateInput
    socialAffinity2?: SocialAffinityOrderByRelationAggregateInput
    fatiguedMaps?: FatiguedMapOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    email?: StringFilter<"User"> | string
    username?: StringFilter<"User"> | string
    displayName?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    events?: RawEventListRelationFilter
    playerFeatures?: XOR<PlayerFeaturesNullableScalarRelationFilter, PlayerFeaturesWhereInput> | null
    socialAffinity1?: SocialAffinityListRelationFilter
    socialAffinity2?: SocialAffinityListRelationFilter
    fatiguedMaps?: FatiguedMapListRelationFilter
  }, "id">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    username?: SortOrder
    displayName?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    username?: StringWithAggregatesFilter<"User"> | string
    displayName?: StringNullableWithAggregatesFilter<"User"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type GameMapWhereInput = {
    AND?: GameMapWhereInput | GameMapWhereInput[]
    OR?: GameMapWhereInput[]
    NOT?: GameMapWhereInput | GameMapWhereInput[]
    id?: StringFilter<"GameMap"> | string
    slug?: StringFilter<"GameMap"> | string
    name?: StringFilter<"GameMap"> | string
    ownerId?: StringNullableFilter<"GameMap"> | string | null
    isPublished?: BoolFilter<"GameMap"> | boolean
    createdAt?: DateTimeFilter<"GameMap"> | Date | string
    updatedAt?: DateTimeFilter<"GameMap"> | Date | string
    mapFeatures?: XOR<MapFeaturesNullableScalarRelationFilter, MapFeaturesWhereInput> | null
    fatiguedPlayers?: FatiguedMapListRelationFilter
  }

  export type GameMapOrderByWithRelationInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    ownerId?: SortOrderInput | SortOrder
    isPublished?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    mapFeatures?: MapFeaturesOrderByWithRelationInput
    fatiguedPlayers?: FatiguedMapOrderByRelationAggregateInput
  }

  export type GameMapWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: GameMapWhereInput | GameMapWhereInput[]
    OR?: GameMapWhereInput[]
    NOT?: GameMapWhereInput | GameMapWhereInput[]
    slug?: StringFilter<"GameMap"> | string
    name?: StringFilter<"GameMap"> | string
    ownerId?: StringNullableFilter<"GameMap"> | string | null
    isPublished?: BoolFilter<"GameMap"> | boolean
    createdAt?: DateTimeFilter<"GameMap"> | Date | string
    updatedAt?: DateTimeFilter<"GameMap"> | Date | string
    mapFeatures?: XOR<MapFeaturesNullableScalarRelationFilter, MapFeaturesWhereInput> | null
    fatiguedPlayers?: FatiguedMapListRelationFilter
  }, "id">

  export type GameMapOrderByWithAggregationInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    ownerId?: SortOrderInput | SortOrder
    isPublished?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: GameMapCountOrderByAggregateInput
    _max?: GameMapMaxOrderByAggregateInput
    _min?: GameMapMinOrderByAggregateInput
  }

  export type GameMapScalarWhereWithAggregatesInput = {
    AND?: GameMapScalarWhereWithAggregatesInput | GameMapScalarWhereWithAggregatesInput[]
    OR?: GameMapScalarWhereWithAggregatesInput[]
    NOT?: GameMapScalarWhereWithAggregatesInput | GameMapScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"GameMap"> | string
    slug?: StringWithAggregatesFilter<"GameMap"> | string
    name?: StringWithAggregatesFilter<"GameMap"> | string
    ownerId?: StringNullableWithAggregatesFilter<"GameMap"> | string | null
    isPublished?: BoolWithAggregatesFilter<"GameMap"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"GameMap"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"GameMap"> | Date | string
  }

  export type RawEventWhereInput = {
    AND?: RawEventWhereInput | RawEventWhereInput[]
    OR?: RawEventWhereInput[]
    NOT?: RawEventWhereInput | RawEventWhereInput[]
    id?: StringFilter<"RawEvent"> | string
    eventType?: StringFilter<"RawEvent"> | string
    userId?: StringNullableFilter<"RawEvent"> | string | null
    timestamp?: DateTimeFilter<"RawEvent"> | Date | string
    payload?: JsonFilter<"RawEvent">
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }

  export type RawEventOrderByWithRelationInput = {
    id?: SortOrder
    eventType?: SortOrder
    userId?: SortOrderInput | SortOrder
    timestamp?: SortOrder
    payload?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type RawEventWhereUniqueInput = Prisma.AtLeast<{
    id_timestamp?: RawEventIdTimestampCompoundUniqueInput
    AND?: RawEventWhereInput | RawEventWhereInput[]
    OR?: RawEventWhereInput[]
    NOT?: RawEventWhereInput | RawEventWhereInput[]
    id?: StringFilter<"RawEvent"> | string
    eventType?: StringFilter<"RawEvent"> | string
    userId?: StringNullableFilter<"RawEvent"> | string | null
    timestamp?: DateTimeFilter<"RawEvent"> | Date | string
    payload?: JsonFilter<"RawEvent">
    user?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }, "id_timestamp">

  export type RawEventOrderByWithAggregationInput = {
    id?: SortOrder
    eventType?: SortOrder
    userId?: SortOrderInput | SortOrder
    timestamp?: SortOrder
    payload?: SortOrder
    _count?: RawEventCountOrderByAggregateInput
    _max?: RawEventMaxOrderByAggregateInput
    _min?: RawEventMinOrderByAggregateInput
  }

  export type RawEventScalarWhereWithAggregatesInput = {
    AND?: RawEventScalarWhereWithAggregatesInput | RawEventScalarWhereWithAggregatesInput[]
    OR?: RawEventScalarWhereWithAggregatesInput[]
    NOT?: RawEventScalarWhereWithAggregatesInput | RawEventScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"RawEvent"> | string
    eventType?: StringWithAggregatesFilter<"RawEvent"> | string
    userId?: StringNullableWithAggregatesFilter<"RawEvent"> | string | null
    timestamp?: DateTimeWithAggregatesFilter<"RawEvent"> | Date | string
    payload?: JsonWithAggregatesFilter<"RawEvent">
  }

  export type PlayerFeaturesWhereInput = {
    AND?: PlayerFeaturesWhereInput | PlayerFeaturesWhereInput[]
    OR?: PlayerFeaturesWhereInput[]
    NOT?: PlayerFeaturesWhereInput | PlayerFeaturesWhereInput[]
    userId?: StringFilter<"PlayerFeatures"> | string
    lastActive?: DateTimeFilter<"PlayerFeatures"> | Date | string
    totalPlayTime?: FloatFilter<"PlayerFeatures"> | number
    matchesPlayed?: IntFilter<"PlayerFeatures"> | number
    preferredLanguage?: StringFilter<"PlayerFeatures"> | string
    explorerRatio?: FloatNullableFilter<"PlayerFeatures"> | number | null
    playerProfile?: StringNullableFilter<"PlayerFeatures"> | string | null
    popularitySensitivity?: FloatNullableFilter<"PlayerFeatures"> | number | null
    returnIntent?: FloatNullableFilter<"PlayerFeatures"> | number | null
    scheduleProfile?: JsonNullableFilter<"PlayerFeatures">
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type PlayerFeaturesOrderByWithRelationInput = {
    userId?: SortOrder
    lastActive?: SortOrder
    totalPlayTime?: SortOrder
    matchesPlayed?: SortOrder
    preferredLanguage?: SortOrder
    explorerRatio?: SortOrderInput | SortOrder
    playerProfile?: SortOrderInput | SortOrder
    popularitySensitivity?: SortOrderInput | SortOrder
    returnIntent?: SortOrderInput | SortOrder
    scheduleProfile?: SortOrderInput | SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type PlayerFeaturesWhereUniqueInput = Prisma.AtLeast<{
    userId?: string
    AND?: PlayerFeaturesWhereInput | PlayerFeaturesWhereInput[]
    OR?: PlayerFeaturesWhereInput[]
    NOT?: PlayerFeaturesWhereInput | PlayerFeaturesWhereInput[]
    lastActive?: DateTimeFilter<"PlayerFeatures"> | Date | string
    totalPlayTime?: FloatFilter<"PlayerFeatures"> | number
    matchesPlayed?: IntFilter<"PlayerFeatures"> | number
    preferredLanguage?: StringFilter<"PlayerFeatures"> | string
    explorerRatio?: FloatNullableFilter<"PlayerFeatures"> | number | null
    playerProfile?: StringNullableFilter<"PlayerFeatures"> | string | null
    popularitySensitivity?: FloatNullableFilter<"PlayerFeatures"> | number | null
    returnIntent?: FloatNullableFilter<"PlayerFeatures"> | number | null
    scheduleProfile?: JsonNullableFilter<"PlayerFeatures">
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "userId">

  export type PlayerFeaturesOrderByWithAggregationInput = {
    userId?: SortOrder
    lastActive?: SortOrder
    totalPlayTime?: SortOrder
    matchesPlayed?: SortOrder
    preferredLanguage?: SortOrder
    explorerRatio?: SortOrderInput | SortOrder
    playerProfile?: SortOrderInput | SortOrder
    popularitySensitivity?: SortOrderInput | SortOrder
    returnIntent?: SortOrderInput | SortOrder
    scheduleProfile?: SortOrderInput | SortOrder
    _count?: PlayerFeaturesCountOrderByAggregateInput
    _avg?: PlayerFeaturesAvgOrderByAggregateInput
    _max?: PlayerFeaturesMaxOrderByAggregateInput
    _min?: PlayerFeaturesMinOrderByAggregateInput
    _sum?: PlayerFeaturesSumOrderByAggregateInput
  }

  export type PlayerFeaturesScalarWhereWithAggregatesInput = {
    AND?: PlayerFeaturesScalarWhereWithAggregatesInput | PlayerFeaturesScalarWhereWithAggregatesInput[]
    OR?: PlayerFeaturesScalarWhereWithAggregatesInput[]
    NOT?: PlayerFeaturesScalarWhereWithAggregatesInput | PlayerFeaturesScalarWhereWithAggregatesInput[]
    userId?: StringWithAggregatesFilter<"PlayerFeatures"> | string
    lastActive?: DateTimeWithAggregatesFilter<"PlayerFeatures"> | Date | string
    totalPlayTime?: FloatWithAggregatesFilter<"PlayerFeatures"> | number
    matchesPlayed?: IntWithAggregatesFilter<"PlayerFeatures"> | number
    preferredLanguage?: StringWithAggregatesFilter<"PlayerFeatures"> | string
    explorerRatio?: FloatNullableWithAggregatesFilter<"PlayerFeatures"> | number | null
    playerProfile?: StringNullableWithAggregatesFilter<"PlayerFeatures"> | string | null
    popularitySensitivity?: FloatNullableWithAggregatesFilter<"PlayerFeatures"> | number | null
    returnIntent?: FloatNullableWithAggregatesFilter<"PlayerFeatures"> | number | null
    scheduleProfile?: JsonNullableWithAggregatesFilter<"PlayerFeatures">
  }

  export type MapFeaturesWhereInput = {
    AND?: MapFeaturesWhereInput | MapFeaturesWhereInput[]
    OR?: MapFeaturesWhereInput[]
    NOT?: MapFeaturesWhereInput | MapFeaturesWhereInput[]
    mapId?: StringFilter<"MapFeatures"> | string
    totalJoins?: IntFilter<"MapFeatures"> | number
    totalLeaves?: IntFilter<"MapFeatures"> | number
    bounceCount?: IntFilter<"MapFeatures"> | number
    averageDuration?: FloatFilter<"MapFeatures"> | number
    bounceRate?: FloatFilter<"MapFeatures"> | number
    medianPlaytime?: FloatNullableFilter<"MapFeatures"> | number | null
    completionRate?: FloatNullableFilter<"MapFeatures"> | number | null
    retentionCurve?: JsonNullableFilter<"MapFeatures">
    difficultyScore?: FloatNullableFilter<"MapFeatures"> | number | null
    difficultyLabel?: StringNullableFilter<"MapFeatures"> | string | null
    paceScore?: FloatNullableFilter<"MapFeatures"> | number | null
    paceLabel?: StringNullableFilter<"MapFeatures"> | string | null
    earlyAbandonRate?: FloatNullableFilter<"MapFeatures"> | number | null
    stickyFactor?: FloatNullableFilter<"MapFeatures"> | number | null
    viralityFactor?: FloatNullableFilter<"MapFeatures"> | number | null
    map?: XOR<GameMapScalarRelationFilter, GameMapWhereInput>
  }

  export type MapFeaturesOrderByWithRelationInput = {
    mapId?: SortOrder
    totalJoins?: SortOrder
    totalLeaves?: SortOrder
    bounceCount?: SortOrder
    averageDuration?: SortOrder
    bounceRate?: SortOrder
    medianPlaytime?: SortOrderInput | SortOrder
    completionRate?: SortOrderInput | SortOrder
    retentionCurve?: SortOrderInput | SortOrder
    difficultyScore?: SortOrderInput | SortOrder
    difficultyLabel?: SortOrderInput | SortOrder
    paceScore?: SortOrderInput | SortOrder
    paceLabel?: SortOrderInput | SortOrder
    earlyAbandonRate?: SortOrderInput | SortOrder
    stickyFactor?: SortOrderInput | SortOrder
    viralityFactor?: SortOrderInput | SortOrder
    map?: GameMapOrderByWithRelationInput
  }

  export type MapFeaturesWhereUniqueInput = Prisma.AtLeast<{
    mapId?: string
    AND?: MapFeaturesWhereInput | MapFeaturesWhereInput[]
    OR?: MapFeaturesWhereInput[]
    NOT?: MapFeaturesWhereInput | MapFeaturesWhereInput[]
    totalJoins?: IntFilter<"MapFeatures"> | number
    totalLeaves?: IntFilter<"MapFeatures"> | number
    bounceCount?: IntFilter<"MapFeatures"> | number
    averageDuration?: FloatFilter<"MapFeatures"> | number
    bounceRate?: FloatFilter<"MapFeatures"> | number
    medianPlaytime?: FloatNullableFilter<"MapFeatures"> | number | null
    completionRate?: FloatNullableFilter<"MapFeatures"> | number | null
    retentionCurve?: JsonNullableFilter<"MapFeatures">
    difficultyScore?: FloatNullableFilter<"MapFeatures"> | number | null
    difficultyLabel?: StringNullableFilter<"MapFeatures"> | string | null
    paceScore?: FloatNullableFilter<"MapFeatures"> | number | null
    paceLabel?: StringNullableFilter<"MapFeatures"> | string | null
    earlyAbandonRate?: FloatNullableFilter<"MapFeatures"> | number | null
    stickyFactor?: FloatNullableFilter<"MapFeatures"> | number | null
    viralityFactor?: FloatNullableFilter<"MapFeatures"> | number | null
    map?: XOR<GameMapScalarRelationFilter, GameMapWhereInput>
  }, "mapId">

  export type MapFeaturesOrderByWithAggregationInput = {
    mapId?: SortOrder
    totalJoins?: SortOrder
    totalLeaves?: SortOrder
    bounceCount?: SortOrder
    averageDuration?: SortOrder
    bounceRate?: SortOrder
    medianPlaytime?: SortOrderInput | SortOrder
    completionRate?: SortOrderInput | SortOrder
    retentionCurve?: SortOrderInput | SortOrder
    difficultyScore?: SortOrderInput | SortOrder
    difficultyLabel?: SortOrderInput | SortOrder
    paceScore?: SortOrderInput | SortOrder
    paceLabel?: SortOrderInput | SortOrder
    earlyAbandonRate?: SortOrderInput | SortOrder
    stickyFactor?: SortOrderInput | SortOrder
    viralityFactor?: SortOrderInput | SortOrder
    _count?: MapFeaturesCountOrderByAggregateInput
    _avg?: MapFeaturesAvgOrderByAggregateInput
    _max?: MapFeaturesMaxOrderByAggregateInput
    _min?: MapFeaturesMinOrderByAggregateInput
    _sum?: MapFeaturesSumOrderByAggregateInput
  }

  export type MapFeaturesScalarWhereWithAggregatesInput = {
    AND?: MapFeaturesScalarWhereWithAggregatesInput | MapFeaturesScalarWhereWithAggregatesInput[]
    OR?: MapFeaturesScalarWhereWithAggregatesInput[]
    NOT?: MapFeaturesScalarWhereWithAggregatesInput | MapFeaturesScalarWhereWithAggregatesInput[]
    mapId?: StringWithAggregatesFilter<"MapFeatures"> | string
    totalJoins?: IntWithAggregatesFilter<"MapFeatures"> | number
    totalLeaves?: IntWithAggregatesFilter<"MapFeatures"> | number
    bounceCount?: IntWithAggregatesFilter<"MapFeatures"> | number
    averageDuration?: FloatWithAggregatesFilter<"MapFeatures"> | number
    bounceRate?: FloatWithAggregatesFilter<"MapFeatures"> | number
    medianPlaytime?: FloatNullableWithAggregatesFilter<"MapFeatures"> | number | null
    completionRate?: FloatNullableWithAggregatesFilter<"MapFeatures"> | number | null
    retentionCurve?: JsonNullableWithAggregatesFilter<"MapFeatures">
    difficultyScore?: FloatNullableWithAggregatesFilter<"MapFeatures"> | number | null
    difficultyLabel?: StringNullableWithAggregatesFilter<"MapFeatures"> | string | null
    paceScore?: FloatNullableWithAggregatesFilter<"MapFeatures"> | number | null
    paceLabel?: StringNullableWithAggregatesFilter<"MapFeatures"> | string | null
    earlyAbandonRate?: FloatNullableWithAggregatesFilter<"MapFeatures"> | number | null
    stickyFactor?: FloatNullableWithAggregatesFilter<"MapFeatures"> | number | null
    viralityFactor?: FloatNullableWithAggregatesFilter<"MapFeatures"> | number | null
  }

  export type SocialAffinityWhereInput = {
    AND?: SocialAffinityWhereInput | SocialAffinityWhereInput[]
    OR?: SocialAffinityWhereInput[]
    NOT?: SocialAffinityWhereInput | SocialAffinityWhereInput[]
    id?: StringFilter<"SocialAffinity"> | string
    userId1?: StringFilter<"SocialAffinity"> | string
    userId2?: StringFilter<"SocialAffinity"> | string
    affinity?: FloatFilter<"SocialAffinity"> | number
    updatedAt?: DateTimeFilter<"SocialAffinity"> | Date | string
    user1?: XOR<UserScalarRelationFilter, UserWhereInput>
    user2?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type SocialAffinityOrderByWithRelationInput = {
    id?: SortOrder
    userId1?: SortOrder
    userId2?: SortOrder
    affinity?: SortOrder
    updatedAt?: SortOrder
    user1?: UserOrderByWithRelationInput
    user2?: UserOrderByWithRelationInput
  }

  export type SocialAffinityWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId1_userId2?: SocialAffinityUserId1UserId2CompoundUniqueInput
    AND?: SocialAffinityWhereInput | SocialAffinityWhereInput[]
    OR?: SocialAffinityWhereInput[]
    NOT?: SocialAffinityWhereInput | SocialAffinityWhereInput[]
    userId1?: StringFilter<"SocialAffinity"> | string
    userId2?: StringFilter<"SocialAffinity"> | string
    affinity?: FloatFilter<"SocialAffinity"> | number
    updatedAt?: DateTimeFilter<"SocialAffinity"> | Date | string
    user1?: XOR<UserScalarRelationFilter, UserWhereInput>
    user2?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id" | "userId1_userId2">

  export type SocialAffinityOrderByWithAggregationInput = {
    id?: SortOrder
    userId1?: SortOrder
    userId2?: SortOrder
    affinity?: SortOrder
    updatedAt?: SortOrder
    _count?: SocialAffinityCountOrderByAggregateInput
    _avg?: SocialAffinityAvgOrderByAggregateInput
    _max?: SocialAffinityMaxOrderByAggregateInput
    _min?: SocialAffinityMinOrderByAggregateInput
    _sum?: SocialAffinitySumOrderByAggregateInput
  }

  export type SocialAffinityScalarWhereWithAggregatesInput = {
    AND?: SocialAffinityScalarWhereWithAggregatesInput | SocialAffinityScalarWhereWithAggregatesInput[]
    OR?: SocialAffinityScalarWhereWithAggregatesInput[]
    NOT?: SocialAffinityScalarWhereWithAggregatesInput | SocialAffinityScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"SocialAffinity"> | string
    userId1?: StringWithAggregatesFilter<"SocialAffinity"> | string
    userId2?: StringWithAggregatesFilter<"SocialAffinity"> | string
    affinity?: FloatWithAggregatesFilter<"SocialAffinity"> | number
    updatedAt?: DateTimeWithAggregatesFilter<"SocialAffinity"> | Date | string
  }

  export type FatiguedMapWhereInput = {
    AND?: FatiguedMapWhereInput | FatiguedMapWhereInput[]
    OR?: FatiguedMapWhereInput[]
    NOT?: FatiguedMapWhereInput | FatiguedMapWhereInput[]
    userId?: StringFilter<"FatiguedMap"> | string
    mapId?: StringFilter<"FatiguedMap"> | string
    fatiguedAt?: DateTimeFilter<"FatiguedMap"> | Date | string
    expiresAt?: DateTimeFilter<"FatiguedMap"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    map?: XOR<GameMapScalarRelationFilter, GameMapWhereInput>
  }

  export type FatiguedMapOrderByWithRelationInput = {
    userId?: SortOrder
    mapId?: SortOrder
    fatiguedAt?: SortOrder
    expiresAt?: SortOrder
    user?: UserOrderByWithRelationInput
    map?: GameMapOrderByWithRelationInput
  }

  export type FatiguedMapWhereUniqueInput = Prisma.AtLeast<{
    userId_mapId?: FatiguedMapUserIdMapIdCompoundUniqueInput
    AND?: FatiguedMapWhereInput | FatiguedMapWhereInput[]
    OR?: FatiguedMapWhereInput[]
    NOT?: FatiguedMapWhereInput | FatiguedMapWhereInput[]
    userId?: StringFilter<"FatiguedMap"> | string
    mapId?: StringFilter<"FatiguedMap"> | string
    fatiguedAt?: DateTimeFilter<"FatiguedMap"> | Date | string
    expiresAt?: DateTimeFilter<"FatiguedMap"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    map?: XOR<GameMapScalarRelationFilter, GameMapWhereInput>
  }, "userId_mapId">

  export type FatiguedMapOrderByWithAggregationInput = {
    userId?: SortOrder
    mapId?: SortOrder
    fatiguedAt?: SortOrder
    expiresAt?: SortOrder
    _count?: FatiguedMapCountOrderByAggregateInput
    _max?: FatiguedMapMaxOrderByAggregateInput
    _min?: FatiguedMapMinOrderByAggregateInput
  }

  export type FatiguedMapScalarWhereWithAggregatesInput = {
    AND?: FatiguedMapScalarWhereWithAggregatesInput | FatiguedMapScalarWhereWithAggregatesInput[]
    OR?: FatiguedMapScalarWhereWithAggregatesInput[]
    NOT?: FatiguedMapScalarWhereWithAggregatesInput | FatiguedMapScalarWhereWithAggregatesInput[]
    userId?: StringWithAggregatesFilter<"FatiguedMap"> | string
    mapId?: StringWithAggregatesFilter<"FatiguedMap"> | string
    fatiguedAt?: DateTimeWithAggregatesFilter<"FatiguedMap"> | Date | string
    expiresAt?: DateTimeWithAggregatesFilter<"FatiguedMap"> | Date | string
  }

  export type DataQuarantineWhereInput = {
    AND?: DataQuarantineWhereInput | DataQuarantineWhereInput[]
    OR?: DataQuarantineWhereInput[]
    NOT?: DataQuarantineWhereInput | DataQuarantineWhereInput[]
    id?: StringFilter<"DataQuarantine"> | string
    originalId?: StringNullableFilter<"DataQuarantine"> | string | null
    eventType?: StringFilter<"DataQuarantine"> | string
    userId?: StringNullableFilter<"DataQuarantine"> | string | null
    timestamp?: DateTimeFilter<"DataQuarantine"> | Date | string
    payload?: JsonFilter<"DataQuarantine">
    reason?: StringFilter<"DataQuarantine"> | string
    quarantinedAt?: DateTimeFilter<"DataQuarantine"> | Date | string
  }

  export type DataQuarantineOrderByWithRelationInput = {
    id?: SortOrder
    originalId?: SortOrderInput | SortOrder
    eventType?: SortOrder
    userId?: SortOrderInput | SortOrder
    timestamp?: SortOrder
    payload?: SortOrder
    reason?: SortOrder
    quarantinedAt?: SortOrder
  }

  export type DataQuarantineWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: DataQuarantineWhereInput | DataQuarantineWhereInput[]
    OR?: DataQuarantineWhereInput[]
    NOT?: DataQuarantineWhereInput | DataQuarantineWhereInput[]
    originalId?: StringNullableFilter<"DataQuarantine"> | string | null
    eventType?: StringFilter<"DataQuarantine"> | string
    userId?: StringNullableFilter<"DataQuarantine"> | string | null
    timestamp?: DateTimeFilter<"DataQuarantine"> | Date | string
    payload?: JsonFilter<"DataQuarantine">
    reason?: StringFilter<"DataQuarantine"> | string
    quarantinedAt?: DateTimeFilter<"DataQuarantine"> | Date | string
  }, "id">

  export type DataQuarantineOrderByWithAggregationInput = {
    id?: SortOrder
    originalId?: SortOrderInput | SortOrder
    eventType?: SortOrder
    userId?: SortOrderInput | SortOrder
    timestamp?: SortOrder
    payload?: SortOrder
    reason?: SortOrder
    quarantinedAt?: SortOrder
    _count?: DataQuarantineCountOrderByAggregateInput
    _max?: DataQuarantineMaxOrderByAggregateInput
    _min?: DataQuarantineMinOrderByAggregateInput
  }

  export type DataQuarantineScalarWhereWithAggregatesInput = {
    AND?: DataQuarantineScalarWhereWithAggregatesInput | DataQuarantineScalarWhereWithAggregatesInput[]
    OR?: DataQuarantineScalarWhereWithAggregatesInput[]
    NOT?: DataQuarantineScalarWhereWithAggregatesInput | DataQuarantineScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"DataQuarantine"> | string
    originalId?: StringNullableWithAggregatesFilter<"DataQuarantine"> | string | null
    eventType?: StringWithAggregatesFilter<"DataQuarantine"> | string
    userId?: StringNullableWithAggregatesFilter<"DataQuarantine"> | string | null
    timestamp?: DateTimeWithAggregatesFilter<"DataQuarantine"> | Date | string
    payload?: JsonWithAggregatesFilter<"DataQuarantine">
    reason?: StringWithAggregatesFilter<"DataQuarantine"> | string
    quarantinedAt?: DateTimeWithAggregatesFilter<"DataQuarantine"> | Date | string
  }

  export type UserCreateInput = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventCreateNestedManyWithoutUserInput
    playerFeatures?: PlayerFeaturesCreateNestedOneWithoutUserInput
    socialAffinity1?: SocialAffinityCreateNestedManyWithoutUser1Input
    socialAffinity2?: SocialAffinityCreateNestedManyWithoutUser2Input
    fatiguedMaps?: FatiguedMapCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventUncheckedCreateNestedManyWithoutUserInput
    playerFeatures?: PlayerFeaturesUncheckedCreateNestedOneWithoutUserInput
    socialAffinity1?: SocialAffinityUncheckedCreateNestedManyWithoutUser1Input
    socialAffinity2?: SocialAffinityUncheckedCreateNestedManyWithoutUser2Input
    fatiguedMaps?: FatiguedMapUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUpdateManyWithoutUserNestedInput
    playerFeatures?: PlayerFeaturesUpdateOneWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUpdateManyWithoutUser1NestedInput
    socialAffinity2?: SocialAffinityUpdateManyWithoutUser2NestedInput
    fatiguedMaps?: FatiguedMapUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUncheckedUpdateManyWithoutUserNestedInput
    playerFeatures?: PlayerFeaturesUncheckedUpdateOneWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUncheckedUpdateManyWithoutUser1NestedInput
    socialAffinity2?: SocialAffinityUncheckedUpdateManyWithoutUser2NestedInput
    fatiguedMaps?: FatiguedMapUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GameMapCreateInput = {
    id: string
    slug: string
    name: string
    ownerId?: string | null
    isPublished: boolean
    createdAt: Date | string
    updatedAt: Date | string
    mapFeatures?: MapFeaturesCreateNestedOneWithoutMapInput
    fatiguedPlayers?: FatiguedMapCreateNestedManyWithoutMapInput
  }

  export type GameMapUncheckedCreateInput = {
    id: string
    slug: string
    name: string
    ownerId?: string | null
    isPublished: boolean
    createdAt: Date | string
    updatedAt: Date | string
    mapFeatures?: MapFeaturesUncheckedCreateNestedOneWithoutMapInput
    fatiguedPlayers?: FatiguedMapUncheckedCreateNestedManyWithoutMapInput
  }

  export type GameMapUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    ownerId?: NullableStringFieldUpdateOperationsInput | string | null
    isPublished?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    mapFeatures?: MapFeaturesUpdateOneWithoutMapNestedInput
    fatiguedPlayers?: FatiguedMapUpdateManyWithoutMapNestedInput
  }

  export type GameMapUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    ownerId?: NullableStringFieldUpdateOperationsInput | string | null
    isPublished?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    mapFeatures?: MapFeaturesUncheckedUpdateOneWithoutMapNestedInput
    fatiguedPlayers?: FatiguedMapUncheckedUpdateManyWithoutMapNestedInput
  }

  export type GameMapCreateManyInput = {
    id: string
    slug: string
    name: string
    ownerId?: string | null
    isPublished: boolean
    createdAt: Date | string
    updatedAt: Date | string
  }

  export type GameMapUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    ownerId?: NullableStringFieldUpdateOperationsInput | string | null
    isPublished?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type GameMapUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    ownerId?: NullableStringFieldUpdateOperationsInput | string | null
    isPublished?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RawEventCreateInput = {
    id?: string
    eventType: string
    timestamp?: Date | string
    payload: JsonNullValueInput | InputJsonValue
    user?: UserCreateNestedOneWithoutEventsInput
  }

  export type RawEventUncheckedCreateInput = {
    id?: string
    eventType: string
    userId?: string | null
    timestamp?: Date | string
    payload: JsonNullValueInput | InputJsonValue
  }

  export type RawEventUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
    user?: UserUpdateOneWithoutEventsNestedInput
  }

  export type RawEventUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
  }

  export type RawEventCreateManyInput = {
    id?: string
    eventType: string
    userId?: string | null
    timestamp?: Date | string
    payload: JsonNullValueInput | InputJsonValue
  }

  export type RawEventUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
  }

  export type RawEventUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
  }

  export type PlayerFeaturesCreateInput = {
    lastActive: Date | string
    totalPlayTime?: number
    matchesPlayed?: number
    preferredLanguage?: string
    explorerRatio?: number | null
    playerProfile?: string | null
    popularitySensitivity?: number | null
    returnIntent?: number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
    user: UserCreateNestedOneWithoutPlayerFeaturesInput
  }

  export type PlayerFeaturesUncheckedCreateInput = {
    userId: string
    lastActive: Date | string
    totalPlayTime?: number
    matchesPlayed?: number
    preferredLanguage?: string
    explorerRatio?: number | null
    playerProfile?: string | null
    popularitySensitivity?: number | null
    returnIntent?: number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PlayerFeaturesUpdateInput = {
    lastActive?: DateTimeFieldUpdateOperationsInput | Date | string
    totalPlayTime?: FloatFieldUpdateOperationsInput | number
    matchesPlayed?: IntFieldUpdateOperationsInput | number
    preferredLanguage?: StringFieldUpdateOperationsInput | string
    explorerRatio?: NullableFloatFieldUpdateOperationsInput | number | null
    playerProfile?: NullableStringFieldUpdateOperationsInput | string | null
    popularitySensitivity?: NullableFloatFieldUpdateOperationsInput | number | null
    returnIntent?: NullableFloatFieldUpdateOperationsInput | number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
    user?: UserUpdateOneRequiredWithoutPlayerFeaturesNestedInput
  }

  export type PlayerFeaturesUncheckedUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    lastActive?: DateTimeFieldUpdateOperationsInput | Date | string
    totalPlayTime?: FloatFieldUpdateOperationsInput | number
    matchesPlayed?: IntFieldUpdateOperationsInput | number
    preferredLanguage?: StringFieldUpdateOperationsInput | string
    explorerRatio?: NullableFloatFieldUpdateOperationsInput | number | null
    playerProfile?: NullableStringFieldUpdateOperationsInput | string | null
    popularitySensitivity?: NullableFloatFieldUpdateOperationsInput | number | null
    returnIntent?: NullableFloatFieldUpdateOperationsInput | number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PlayerFeaturesCreateManyInput = {
    userId: string
    lastActive: Date | string
    totalPlayTime?: number
    matchesPlayed?: number
    preferredLanguage?: string
    explorerRatio?: number | null
    playerProfile?: string | null
    popularitySensitivity?: number | null
    returnIntent?: number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PlayerFeaturesUpdateManyMutationInput = {
    lastActive?: DateTimeFieldUpdateOperationsInput | Date | string
    totalPlayTime?: FloatFieldUpdateOperationsInput | number
    matchesPlayed?: IntFieldUpdateOperationsInput | number
    preferredLanguage?: StringFieldUpdateOperationsInput | string
    explorerRatio?: NullableFloatFieldUpdateOperationsInput | number | null
    playerProfile?: NullableStringFieldUpdateOperationsInput | string | null
    popularitySensitivity?: NullableFloatFieldUpdateOperationsInput | number | null
    returnIntent?: NullableFloatFieldUpdateOperationsInput | number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PlayerFeaturesUncheckedUpdateManyInput = {
    userId?: StringFieldUpdateOperationsInput | string
    lastActive?: DateTimeFieldUpdateOperationsInput | Date | string
    totalPlayTime?: FloatFieldUpdateOperationsInput | number
    matchesPlayed?: IntFieldUpdateOperationsInput | number
    preferredLanguage?: StringFieldUpdateOperationsInput | string
    explorerRatio?: NullableFloatFieldUpdateOperationsInput | number | null
    playerProfile?: NullableStringFieldUpdateOperationsInput | string | null
    popularitySensitivity?: NullableFloatFieldUpdateOperationsInput | number | null
    returnIntent?: NullableFloatFieldUpdateOperationsInput | number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
  }

  export type MapFeaturesCreateInput = {
    totalJoins?: number
    totalLeaves?: number
    bounceCount?: number
    averageDuration?: number
    bounceRate?: number
    medianPlaytime?: number | null
    completionRate?: number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: number | null
    difficultyLabel?: string | null
    paceScore?: number | null
    paceLabel?: string | null
    earlyAbandonRate?: number | null
    stickyFactor?: number | null
    viralityFactor?: number | null
    map: GameMapCreateNestedOneWithoutMapFeaturesInput
  }

  export type MapFeaturesUncheckedCreateInput = {
    mapId: string
    totalJoins?: number
    totalLeaves?: number
    bounceCount?: number
    averageDuration?: number
    bounceRate?: number
    medianPlaytime?: number | null
    completionRate?: number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: number | null
    difficultyLabel?: string | null
    paceScore?: number | null
    paceLabel?: string | null
    earlyAbandonRate?: number | null
    stickyFactor?: number | null
    viralityFactor?: number | null
  }

  export type MapFeaturesUpdateInput = {
    totalJoins?: IntFieldUpdateOperationsInput | number
    totalLeaves?: IntFieldUpdateOperationsInput | number
    bounceCount?: IntFieldUpdateOperationsInput | number
    averageDuration?: FloatFieldUpdateOperationsInput | number
    bounceRate?: FloatFieldUpdateOperationsInput | number
    medianPlaytime?: NullableFloatFieldUpdateOperationsInput | number | null
    completionRate?: NullableFloatFieldUpdateOperationsInput | number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: NullableFloatFieldUpdateOperationsInput | number | null
    difficultyLabel?: NullableStringFieldUpdateOperationsInput | string | null
    paceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    paceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    earlyAbandonRate?: NullableFloatFieldUpdateOperationsInput | number | null
    stickyFactor?: NullableFloatFieldUpdateOperationsInput | number | null
    viralityFactor?: NullableFloatFieldUpdateOperationsInput | number | null
    map?: GameMapUpdateOneRequiredWithoutMapFeaturesNestedInput
  }

  export type MapFeaturesUncheckedUpdateInput = {
    mapId?: StringFieldUpdateOperationsInput | string
    totalJoins?: IntFieldUpdateOperationsInput | number
    totalLeaves?: IntFieldUpdateOperationsInput | number
    bounceCount?: IntFieldUpdateOperationsInput | number
    averageDuration?: FloatFieldUpdateOperationsInput | number
    bounceRate?: FloatFieldUpdateOperationsInput | number
    medianPlaytime?: NullableFloatFieldUpdateOperationsInput | number | null
    completionRate?: NullableFloatFieldUpdateOperationsInput | number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: NullableFloatFieldUpdateOperationsInput | number | null
    difficultyLabel?: NullableStringFieldUpdateOperationsInput | string | null
    paceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    paceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    earlyAbandonRate?: NullableFloatFieldUpdateOperationsInput | number | null
    stickyFactor?: NullableFloatFieldUpdateOperationsInput | number | null
    viralityFactor?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type MapFeaturesCreateManyInput = {
    mapId: string
    totalJoins?: number
    totalLeaves?: number
    bounceCount?: number
    averageDuration?: number
    bounceRate?: number
    medianPlaytime?: number | null
    completionRate?: number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: number | null
    difficultyLabel?: string | null
    paceScore?: number | null
    paceLabel?: string | null
    earlyAbandonRate?: number | null
    stickyFactor?: number | null
    viralityFactor?: number | null
  }

  export type MapFeaturesUpdateManyMutationInput = {
    totalJoins?: IntFieldUpdateOperationsInput | number
    totalLeaves?: IntFieldUpdateOperationsInput | number
    bounceCount?: IntFieldUpdateOperationsInput | number
    averageDuration?: FloatFieldUpdateOperationsInput | number
    bounceRate?: FloatFieldUpdateOperationsInput | number
    medianPlaytime?: NullableFloatFieldUpdateOperationsInput | number | null
    completionRate?: NullableFloatFieldUpdateOperationsInput | number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: NullableFloatFieldUpdateOperationsInput | number | null
    difficultyLabel?: NullableStringFieldUpdateOperationsInput | string | null
    paceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    paceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    earlyAbandonRate?: NullableFloatFieldUpdateOperationsInput | number | null
    stickyFactor?: NullableFloatFieldUpdateOperationsInput | number | null
    viralityFactor?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type MapFeaturesUncheckedUpdateManyInput = {
    mapId?: StringFieldUpdateOperationsInput | string
    totalJoins?: IntFieldUpdateOperationsInput | number
    totalLeaves?: IntFieldUpdateOperationsInput | number
    bounceCount?: IntFieldUpdateOperationsInput | number
    averageDuration?: FloatFieldUpdateOperationsInput | number
    bounceRate?: FloatFieldUpdateOperationsInput | number
    medianPlaytime?: NullableFloatFieldUpdateOperationsInput | number | null
    completionRate?: NullableFloatFieldUpdateOperationsInput | number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: NullableFloatFieldUpdateOperationsInput | number | null
    difficultyLabel?: NullableStringFieldUpdateOperationsInput | string | null
    paceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    paceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    earlyAbandonRate?: NullableFloatFieldUpdateOperationsInput | number | null
    stickyFactor?: NullableFloatFieldUpdateOperationsInput | number | null
    viralityFactor?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type SocialAffinityCreateInput = {
    id?: string
    affinity?: number
    updatedAt?: Date | string
    user1: UserCreateNestedOneWithoutSocialAffinity1Input
    user2: UserCreateNestedOneWithoutSocialAffinity2Input
  }

  export type SocialAffinityUncheckedCreateInput = {
    id?: string
    userId1: string
    userId2: string
    affinity?: number
    updatedAt?: Date | string
  }

  export type SocialAffinityUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user1?: UserUpdateOneRequiredWithoutSocialAffinity1NestedInput
    user2?: UserUpdateOneRequiredWithoutSocialAffinity2NestedInput
  }

  export type SocialAffinityUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId1?: StringFieldUpdateOperationsInput | string
    userId2?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SocialAffinityCreateManyInput = {
    id?: string
    userId1: string
    userId2: string
    affinity?: number
    updatedAt?: Date | string
  }

  export type SocialAffinityUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SocialAffinityUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId1?: StringFieldUpdateOperationsInput | string
    userId2?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FatiguedMapCreateInput = {
    fatiguedAt?: Date | string
    expiresAt: Date | string
    user: UserCreateNestedOneWithoutFatiguedMapsInput
    map: GameMapCreateNestedOneWithoutFatiguedPlayersInput
  }

  export type FatiguedMapUncheckedCreateInput = {
    userId: string
    mapId: string
    fatiguedAt?: Date | string
    expiresAt: Date | string
  }

  export type FatiguedMapUpdateInput = {
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutFatiguedMapsNestedInput
    map?: GameMapUpdateOneRequiredWithoutFatiguedPlayersNestedInput
  }

  export type FatiguedMapUncheckedUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mapId?: StringFieldUpdateOperationsInput | string
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FatiguedMapCreateManyInput = {
    userId: string
    mapId: string
    fatiguedAt?: Date | string
    expiresAt: Date | string
  }

  export type FatiguedMapUpdateManyMutationInput = {
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FatiguedMapUncheckedUpdateManyInput = {
    userId?: StringFieldUpdateOperationsInput | string
    mapId?: StringFieldUpdateOperationsInput | string
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DataQuarantineCreateInput = {
    id?: string
    originalId?: string | null
    eventType: string
    userId?: string | null
    timestamp: Date | string
    payload: JsonNullValueInput | InputJsonValue
    reason: string
    quarantinedAt?: Date | string
  }

  export type DataQuarantineUncheckedCreateInput = {
    id?: string
    originalId?: string | null
    eventType: string
    userId?: string | null
    timestamp: Date | string
    payload: JsonNullValueInput | InputJsonValue
    reason: string
    quarantinedAt?: Date | string
  }

  export type DataQuarantineUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    originalId?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: StringFieldUpdateOperationsInput | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
    reason?: StringFieldUpdateOperationsInput | string
    quarantinedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DataQuarantineUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    originalId?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: StringFieldUpdateOperationsInput | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
    reason?: StringFieldUpdateOperationsInput | string
    quarantinedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DataQuarantineCreateManyInput = {
    id?: string
    originalId?: string | null
    eventType: string
    userId?: string | null
    timestamp: Date | string
    payload: JsonNullValueInput | InputJsonValue
    reason: string
    quarantinedAt?: Date | string
  }

  export type DataQuarantineUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    originalId?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: StringFieldUpdateOperationsInput | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
    reason?: StringFieldUpdateOperationsInput | string
    quarantinedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DataQuarantineUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    originalId?: NullableStringFieldUpdateOperationsInput | string | null
    eventType?: StringFieldUpdateOperationsInput | string
    userId?: NullableStringFieldUpdateOperationsInput | string | null
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
    reason?: StringFieldUpdateOperationsInput | string
    quarantinedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type RawEventListRelationFilter = {
    every?: RawEventWhereInput
    some?: RawEventWhereInput
    none?: RawEventWhereInput
  }

  export type PlayerFeaturesNullableScalarRelationFilter = {
    is?: PlayerFeaturesWhereInput | null
    isNot?: PlayerFeaturesWhereInput | null
  }

  export type SocialAffinityListRelationFilter = {
    every?: SocialAffinityWhereInput
    some?: SocialAffinityWhereInput
    none?: SocialAffinityWhereInput
  }

  export type FatiguedMapListRelationFilter = {
    every?: FatiguedMapWhereInput
    some?: FatiguedMapWhereInput
    none?: FatiguedMapWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type RawEventOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SocialAffinityOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type FatiguedMapOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    username?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    username?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    username?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type MapFeaturesNullableScalarRelationFilter = {
    is?: MapFeaturesWhereInput | null
    isNot?: MapFeaturesWhereInput | null
  }

  export type GameMapCountOrderByAggregateInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    ownerId?: SortOrder
    isPublished?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GameMapMaxOrderByAggregateInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    ownerId?: SortOrder
    isPublished?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type GameMapMinOrderByAggregateInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    ownerId?: SortOrder
    isPublished?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type RawEventIdTimestampCompoundUniqueInput = {
    id: string
    timestamp: Date | string
  }

  export type RawEventCountOrderByAggregateInput = {
    id?: SortOrder
    eventType?: SortOrder
    userId?: SortOrder
    timestamp?: SortOrder
    payload?: SortOrder
  }

  export type RawEventMaxOrderByAggregateInput = {
    id?: SortOrder
    eventType?: SortOrder
    userId?: SortOrder
    timestamp?: SortOrder
  }

  export type RawEventMinOrderByAggregateInput = {
    id?: SortOrder
    eventType?: SortOrder
    userId?: SortOrder
    timestamp?: SortOrder
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type PlayerFeaturesCountOrderByAggregateInput = {
    userId?: SortOrder
    lastActive?: SortOrder
    totalPlayTime?: SortOrder
    matchesPlayed?: SortOrder
    preferredLanguage?: SortOrder
    explorerRatio?: SortOrder
    playerProfile?: SortOrder
    popularitySensitivity?: SortOrder
    returnIntent?: SortOrder
    scheduleProfile?: SortOrder
  }

  export type PlayerFeaturesAvgOrderByAggregateInput = {
    totalPlayTime?: SortOrder
    matchesPlayed?: SortOrder
    explorerRatio?: SortOrder
    popularitySensitivity?: SortOrder
    returnIntent?: SortOrder
  }

  export type PlayerFeaturesMaxOrderByAggregateInput = {
    userId?: SortOrder
    lastActive?: SortOrder
    totalPlayTime?: SortOrder
    matchesPlayed?: SortOrder
    preferredLanguage?: SortOrder
    explorerRatio?: SortOrder
    playerProfile?: SortOrder
    popularitySensitivity?: SortOrder
    returnIntent?: SortOrder
  }

  export type PlayerFeaturesMinOrderByAggregateInput = {
    userId?: SortOrder
    lastActive?: SortOrder
    totalPlayTime?: SortOrder
    matchesPlayed?: SortOrder
    preferredLanguage?: SortOrder
    explorerRatio?: SortOrder
    playerProfile?: SortOrder
    popularitySensitivity?: SortOrder
    returnIntent?: SortOrder
  }

  export type PlayerFeaturesSumOrderByAggregateInput = {
    totalPlayTime?: SortOrder
    matchesPlayed?: SortOrder
    explorerRatio?: SortOrder
    popularitySensitivity?: SortOrder
    returnIntent?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type GameMapScalarRelationFilter = {
    is?: GameMapWhereInput
    isNot?: GameMapWhereInput
  }

  export type MapFeaturesCountOrderByAggregateInput = {
    mapId?: SortOrder
    totalJoins?: SortOrder
    totalLeaves?: SortOrder
    bounceCount?: SortOrder
    averageDuration?: SortOrder
    bounceRate?: SortOrder
    medianPlaytime?: SortOrder
    completionRate?: SortOrder
    retentionCurve?: SortOrder
    difficultyScore?: SortOrder
    difficultyLabel?: SortOrder
    paceScore?: SortOrder
    paceLabel?: SortOrder
    earlyAbandonRate?: SortOrder
    stickyFactor?: SortOrder
    viralityFactor?: SortOrder
  }

  export type MapFeaturesAvgOrderByAggregateInput = {
    totalJoins?: SortOrder
    totalLeaves?: SortOrder
    bounceCount?: SortOrder
    averageDuration?: SortOrder
    bounceRate?: SortOrder
    medianPlaytime?: SortOrder
    completionRate?: SortOrder
    difficultyScore?: SortOrder
    paceScore?: SortOrder
    earlyAbandonRate?: SortOrder
    stickyFactor?: SortOrder
    viralityFactor?: SortOrder
  }

  export type MapFeaturesMaxOrderByAggregateInput = {
    mapId?: SortOrder
    totalJoins?: SortOrder
    totalLeaves?: SortOrder
    bounceCount?: SortOrder
    averageDuration?: SortOrder
    bounceRate?: SortOrder
    medianPlaytime?: SortOrder
    completionRate?: SortOrder
    difficultyScore?: SortOrder
    difficultyLabel?: SortOrder
    paceScore?: SortOrder
    paceLabel?: SortOrder
    earlyAbandonRate?: SortOrder
    stickyFactor?: SortOrder
    viralityFactor?: SortOrder
  }

  export type MapFeaturesMinOrderByAggregateInput = {
    mapId?: SortOrder
    totalJoins?: SortOrder
    totalLeaves?: SortOrder
    bounceCount?: SortOrder
    averageDuration?: SortOrder
    bounceRate?: SortOrder
    medianPlaytime?: SortOrder
    completionRate?: SortOrder
    difficultyScore?: SortOrder
    difficultyLabel?: SortOrder
    paceScore?: SortOrder
    paceLabel?: SortOrder
    earlyAbandonRate?: SortOrder
    stickyFactor?: SortOrder
    viralityFactor?: SortOrder
  }

  export type MapFeaturesSumOrderByAggregateInput = {
    totalJoins?: SortOrder
    totalLeaves?: SortOrder
    bounceCount?: SortOrder
    averageDuration?: SortOrder
    bounceRate?: SortOrder
    medianPlaytime?: SortOrder
    completionRate?: SortOrder
    difficultyScore?: SortOrder
    paceScore?: SortOrder
    earlyAbandonRate?: SortOrder
    stickyFactor?: SortOrder
    viralityFactor?: SortOrder
  }

  export type SocialAffinityUserId1UserId2CompoundUniqueInput = {
    userId1: string
    userId2: string
  }

  export type SocialAffinityCountOrderByAggregateInput = {
    id?: SortOrder
    userId1?: SortOrder
    userId2?: SortOrder
    affinity?: SortOrder
    updatedAt?: SortOrder
  }

  export type SocialAffinityAvgOrderByAggregateInput = {
    affinity?: SortOrder
  }

  export type SocialAffinityMaxOrderByAggregateInput = {
    id?: SortOrder
    userId1?: SortOrder
    userId2?: SortOrder
    affinity?: SortOrder
    updatedAt?: SortOrder
  }

  export type SocialAffinityMinOrderByAggregateInput = {
    id?: SortOrder
    userId1?: SortOrder
    userId2?: SortOrder
    affinity?: SortOrder
    updatedAt?: SortOrder
  }

  export type SocialAffinitySumOrderByAggregateInput = {
    affinity?: SortOrder
  }

  export type FatiguedMapUserIdMapIdCompoundUniqueInput = {
    userId: string
    mapId: string
  }

  export type FatiguedMapCountOrderByAggregateInput = {
    userId?: SortOrder
    mapId?: SortOrder
    fatiguedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type FatiguedMapMaxOrderByAggregateInput = {
    userId?: SortOrder
    mapId?: SortOrder
    fatiguedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type FatiguedMapMinOrderByAggregateInput = {
    userId?: SortOrder
    mapId?: SortOrder
    fatiguedAt?: SortOrder
    expiresAt?: SortOrder
  }

  export type DataQuarantineCountOrderByAggregateInput = {
    id?: SortOrder
    originalId?: SortOrder
    eventType?: SortOrder
    userId?: SortOrder
    timestamp?: SortOrder
    payload?: SortOrder
    reason?: SortOrder
    quarantinedAt?: SortOrder
  }

  export type DataQuarantineMaxOrderByAggregateInput = {
    id?: SortOrder
    originalId?: SortOrder
    eventType?: SortOrder
    userId?: SortOrder
    timestamp?: SortOrder
    reason?: SortOrder
    quarantinedAt?: SortOrder
  }

  export type DataQuarantineMinOrderByAggregateInput = {
    id?: SortOrder
    originalId?: SortOrder
    eventType?: SortOrder
    userId?: SortOrder
    timestamp?: SortOrder
    reason?: SortOrder
    quarantinedAt?: SortOrder
  }

  export type RawEventCreateNestedManyWithoutUserInput = {
    create?: XOR<RawEventCreateWithoutUserInput, RawEventUncheckedCreateWithoutUserInput> | RawEventCreateWithoutUserInput[] | RawEventUncheckedCreateWithoutUserInput[]
    connectOrCreate?: RawEventCreateOrConnectWithoutUserInput | RawEventCreateOrConnectWithoutUserInput[]
    createMany?: RawEventCreateManyUserInputEnvelope
    connect?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
  }

  export type PlayerFeaturesCreateNestedOneWithoutUserInput = {
    create?: XOR<PlayerFeaturesCreateWithoutUserInput, PlayerFeaturesUncheckedCreateWithoutUserInput>
    connectOrCreate?: PlayerFeaturesCreateOrConnectWithoutUserInput
    connect?: PlayerFeaturesWhereUniqueInput
  }

  export type SocialAffinityCreateNestedManyWithoutUser1Input = {
    create?: XOR<SocialAffinityCreateWithoutUser1Input, SocialAffinityUncheckedCreateWithoutUser1Input> | SocialAffinityCreateWithoutUser1Input[] | SocialAffinityUncheckedCreateWithoutUser1Input[]
    connectOrCreate?: SocialAffinityCreateOrConnectWithoutUser1Input | SocialAffinityCreateOrConnectWithoutUser1Input[]
    createMany?: SocialAffinityCreateManyUser1InputEnvelope
    connect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
  }

  export type SocialAffinityCreateNestedManyWithoutUser2Input = {
    create?: XOR<SocialAffinityCreateWithoutUser2Input, SocialAffinityUncheckedCreateWithoutUser2Input> | SocialAffinityCreateWithoutUser2Input[] | SocialAffinityUncheckedCreateWithoutUser2Input[]
    connectOrCreate?: SocialAffinityCreateOrConnectWithoutUser2Input | SocialAffinityCreateOrConnectWithoutUser2Input[]
    createMany?: SocialAffinityCreateManyUser2InputEnvelope
    connect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
  }

  export type FatiguedMapCreateNestedManyWithoutUserInput = {
    create?: XOR<FatiguedMapCreateWithoutUserInput, FatiguedMapUncheckedCreateWithoutUserInput> | FatiguedMapCreateWithoutUserInput[] | FatiguedMapUncheckedCreateWithoutUserInput[]
    connectOrCreate?: FatiguedMapCreateOrConnectWithoutUserInput | FatiguedMapCreateOrConnectWithoutUserInput[]
    createMany?: FatiguedMapCreateManyUserInputEnvelope
    connect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
  }

  export type RawEventUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<RawEventCreateWithoutUserInput, RawEventUncheckedCreateWithoutUserInput> | RawEventCreateWithoutUserInput[] | RawEventUncheckedCreateWithoutUserInput[]
    connectOrCreate?: RawEventCreateOrConnectWithoutUserInput | RawEventCreateOrConnectWithoutUserInput[]
    createMany?: RawEventCreateManyUserInputEnvelope
    connect?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
  }

  export type PlayerFeaturesUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<PlayerFeaturesCreateWithoutUserInput, PlayerFeaturesUncheckedCreateWithoutUserInput>
    connectOrCreate?: PlayerFeaturesCreateOrConnectWithoutUserInput
    connect?: PlayerFeaturesWhereUniqueInput
  }

  export type SocialAffinityUncheckedCreateNestedManyWithoutUser1Input = {
    create?: XOR<SocialAffinityCreateWithoutUser1Input, SocialAffinityUncheckedCreateWithoutUser1Input> | SocialAffinityCreateWithoutUser1Input[] | SocialAffinityUncheckedCreateWithoutUser1Input[]
    connectOrCreate?: SocialAffinityCreateOrConnectWithoutUser1Input | SocialAffinityCreateOrConnectWithoutUser1Input[]
    createMany?: SocialAffinityCreateManyUser1InputEnvelope
    connect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
  }

  export type SocialAffinityUncheckedCreateNestedManyWithoutUser2Input = {
    create?: XOR<SocialAffinityCreateWithoutUser2Input, SocialAffinityUncheckedCreateWithoutUser2Input> | SocialAffinityCreateWithoutUser2Input[] | SocialAffinityUncheckedCreateWithoutUser2Input[]
    connectOrCreate?: SocialAffinityCreateOrConnectWithoutUser2Input | SocialAffinityCreateOrConnectWithoutUser2Input[]
    createMany?: SocialAffinityCreateManyUser2InputEnvelope
    connect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
  }

  export type FatiguedMapUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<FatiguedMapCreateWithoutUserInput, FatiguedMapUncheckedCreateWithoutUserInput> | FatiguedMapCreateWithoutUserInput[] | FatiguedMapUncheckedCreateWithoutUserInput[]
    connectOrCreate?: FatiguedMapCreateOrConnectWithoutUserInput | FatiguedMapCreateOrConnectWithoutUserInput[]
    createMany?: FatiguedMapCreateManyUserInputEnvelope
    connect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type RawEventUpdateManyWithoutUserNestedInput = {
    create?: XOR<RawEventCreateWithoutUserInput, RawEventUncheckedCreateWithoutUserInput> | RawEventCreateWithoutUserInput[] | RawEventUncheckedCreateWithoutUserInput[]
    connectOrCreate?: RawEventCreateOrConnectWithoutUserInput | RawEventCreateOrConnectWithoutUserInput[]
    upsert?: RawEventUpsertWithWhereUniqueWithoutUserInput | RawEventUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: RawEventCreateManyUserInputEnvelope
    set?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
    disconnect?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
    delete?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
    connect?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
    update?: RawEventUpdateWithWhereUniqueWithoutUserInput | RawEventUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: RawEventUpdateManyWithWhereWithoutUserInput | RawEventUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: RawEventScalarWhereInput | RawEventScalarWhereInput[]
  }

  export type PlayerFeaturesUpdateOneWithoutUserNestedInput = {
    create?: XOR<PlayerFeaturesCreateWithoutUserInput, PlayerFeaturesUncheckedCreateWithoutUserInput>
    connectOrCreate?: PlayerFeaturesCreateOrConnectWithoutUserInput
    upsert?: PlayerFeaturesUpsertWithoutUserInput
    disconnect?: PlayerFeaturesWhereInput | boolean
    delete?: PlayerFeaturesWhereInput | boolean
    connect?: PlayerFeaturesWhereUniqueInput
    update?: XOR<XOR<PlayerFeaturesUpdateToOneWithWhereWithoutUserInput, PlayerFeaturesUpdateWithoutUserInput>, PlayerFeaturesUncheckedUpdateWithoutUserInput>
  }

  export type SocialAffinityUpdateManyWithoutUser1NestedInput = {
    create?: XOR<SocialAffinityCreateWithoutUser1Input, SocialAffinityUncheckedCreateWithoutUser1Input> | SocialAffinityCreateWithoutUser1Input[] | SocialAffinityUncheckedCreateWithoutUser1Input[]
    connectOrCreate?: SocialAffinityCreateOrConnectWithoutUser1Input | SocialAffinityCreateOrConnectWithoutUser1Input[]
    upsert?: SocialAffinityUpsertWithWhereUniqueWithoutUser1Input | SocialAffinityUpsertWithWhereUniqueWithoutUser1Input[]
    createMany?: SocialAffinityCreateManyUser1InputEnvelope
    set?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    disconnect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    delete?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    connect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    update?: SocialAffinityUpdateWithWhereUniqueWithoutUser1Input | SocialAffinityUpdateWithWhereUniqueWithoutUser1Input[]
    updateMany?: SocialAffinityUpdateManyWithWhereWithoutUser1Input | SocialAffinityUpdateManyWithWhereWithoutUser1Input[]
    deleteMany?: SocialAffinityScalarWhereInput | SocialAffinityScalarWhereInput[]
  }

  export type SocialAffinityUpdateManyWithoutUser2NestedInput = {
    create?: XOR<SocialAffinityCreateWithoutUser2Input, SocialAffinityUncheckedCreateWithoutUser2Input> | SocialAffinityCreateWithoutUser2Input[] | SocialAffinityUncheckedCreateWithoutUser2Input[]
    connectOrCreate?: SocialAffinityCreateOrConnectWithoutUser2Input | SocialAffinityCreateOrConnectWithoutUser2Input[]
    upsert?: SocialAffinityUpsertWithWhereUniqueWithoutUser2Input | SocialAffinityUpsertWithWhereUniqueWithoutUser2Input[]
    createMany?: SocialAffinityCreateManyUser2InputEnvelope
    set?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    disconnect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    delete?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    connect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    update?: SocialAffinityUpdateWithWhereUniqueWithoutUser2Input | SocialAffinityUpdateWithWhereUniqueWithoutUser2Input[]
    updateMany?: SocialAffinityUpdateManyWithWhereWithoutUser2Input | SocialAffinityUpdateManyWithWhereWithoutUser2Input[]
    deleteMany?: SocialAffinityScalarWhereInput | SocialAffinityScalarWhereInput[]
  }

  export type FatiguedMapUpdateManyWithoutUserNestedInput = {
    create?: XOR<FatiguedMapCreateWithoutUserInput, FatiguedMapUncheckedCreateWithoutUserInput> | FatiguedMapCreateWithoutUserInput[] | FatiguedMapUncheckedCreateWithoutUserInput[]
    connectOrCreate?: FatiguedMapCreateOrConnectWithoutUserInput | FatiguedMapCreateOrConnectWithoutUserInput[]
    upsert?: FatiguedMapUpsertWithWhereUniqueWithoutUserInput | FatiguedMapUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: FatiguedMapCreateManyUserInputEnvelope
    set?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    disconnect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    delete?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    connect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    update?: FatiguedMapUpdateWithWhereUniqueWithoutUserInput | FatiguedMapUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: FatiguedMapUpdateManyWithWhereWithoutUserInput | FatiguedMapUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: FatiguedMapScalarWhereInput | FatiguedMapScalarWhereInput[]
  }

  export type RawEventUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<RawEventCreateWithoutUserInput, RawEventUncheckedCreateWithoutUserInput> | RawEventCreateWithoutUserInput[] | RawEventUncheckedCreateWithoutUserInput[]
    connectOrCreate?: RawEventCreateOrConnectWithoutUserInput | RawEventCreateOrConnectWithoutUserInput[]
    upsert?: RawEventUpsertWithWhereUniqueWithoutUserInput | RawEventUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: RawEventCreateManyUserInputEnvelope
    set?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
    disconnect?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
    delete?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
    connect?: RawEventWhereUniqueInput | RawEventWhereUniqueInput[]
    update?: RawEventUpdateWithWhereUniqueWithoutUserInput | RawEventUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: RawEventUpdateManyWithWhereWithoutUserInput | RawEventUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: RawEventScalarWhereInput | RawEventScalarWhereInput[]
  }

  export type PlayerFeaturesUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<PlayerFeaturesCreateWithoutUserInput, PlayerFeaturesUncheckedCreateWithoutUserInput>
    connectOrCreate?: PlayerFeaturesCreateOrConnectWithoutUserInput
    upsert?: PlayerFeaturesUpsertWithoutUserInput
    disconnect?: PlayerFeaturesWhereInput | boolean
    delete?: PlayerFeaturesWhereInput | boolean
    connect?: PlayerFeaturesWhereUniqueInput
    update?: XOR<XOR<PlayerFeaturesUpdateToOneWithWhereWithoutUserInput, PlayerFeaturesUpdateWithoutUserInput>, PlayerFeaturesUncheckedUpdateWithoutUserInput>
  }

  export type SocialAffinityUncheckedUpdateManyWithoutUser1NestedInput = {
    create?: XOR<SocialAffinityCreateWithoutUser1Input, SocialAffinityUncheckedCreateWithoutUser1Input> | SocialAffinityCreateWithoutUser1Input[] | SocialAffinityUncheckedCreateWithoutUser1Input[]
    connectOrCreate?: SocialAffinityCreateOrConnectWithoutUser1Input | SocialAffinityCreateOrConnectWithoutUser1Input[]
    upsert?: SocialAffinityUpsertWithWhereUniqueWithoutUser1Input | SocialAffinityUpsertWithWhereUniqueWithoutUser1Input[]
    createMany?: SocialAffinityCreateManyUser1InputEnvelope
    set?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    disconnect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    delete?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    connect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    update?: SocialAffinityUpdateWithWhereUniqueWithoutUser1Input | SocialAffinityUpdateWithWhereUniqueWithoutUser1Input[]
    updateMany?: SocialAffinityUpdateManyWithWhereWithoutUser1Input | SocialAffinityUpdateManyWithWhereWithoutUser1Input[]
    deleteMany?: SocialAffinityScalarWhereInput | SocialAffinityScalarWhereInput[]
  }

  export type SocialAffinityUncheckedUpdateManyWithoutUser2NestedInput = {
    create?: XOR<SocialAffinityCreateWithoutUser2Input, SocialAffinityUncheckedCreateWithoutUser2Input> | SocialAffinityCreateWithoutUser2Input[] | SocialAffinityUncheckedCreateWithoutUser2Input[]
    connectOrCreate?: SocialAffinityCreateOrConnectWithoutUser2Input | SocialAffinityCreateOrConnectWithoutUser2Input[]
    upsert?: SocialAffinityUpsertWithWhereUniqueWithoutUser2Input | SocialAffinityUpsertWithWhereUniqueWithoutUser2Input[]
    createMany?: SocialAffinityCreateManyUser2InputEnvelope
    set?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    disconnect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    delete?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    connect?: SocialAffinityWhereUniqueInput | SocialAffinityWhereUniqueInput[]
    update?: SocialAffinityUpdateWithWhereUniqueWithoutUser2Input | SocialAffinityUpdateWithWhereUniqueWithoutUser2Input[]
    updateMany?: SocialAffinityUpdateManyWithWhereWithoutUser2Input | SocialAffinityUpdateManyWithWhereWithoutUser2Input[]
    deleteMany?: SocialAffinityScalarWhereInput | SocialAffinityScalarWhereInput[]
  }

  export type FatiguedMapUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<FatiguedMapCreateWithoutUserInput, FatiguedMapUncheckedCreateWithoutUserInput> | FatiguedMapCreateWithoutUserInput[] | FatiguedMapUncheckedCreateWithoutUserInput[]
    connectOrCreate?: FatiguedMapCreateOrConnectWithoutUserInput | FatiguedMapCreateOrConnectWithoutUserInput[]
    upsert?: FatiguedMapUpsertWithWhereUniqueWithoutUserInput | FatiguedMapUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: FatiguedMapCreateManyUserInputEnvelope
    set?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    disconnect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    delete?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    connect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    update?: FatiguedMapUpdateWithWhereUniqueWithoutUserInput | FatiguedMapUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: FatiguedMapUpdateManyWithWhereWithoutUserInput | FatiguedMapUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: FatiguedMapScalarWhereInput | FatiguedMapScalarWhereInput[]
  }

  export type MapFeaturesCreateNestedOneWithoutMapInput = {
    create?: XOR<MapFeaturesCreateWithoutMapInput, MapFeaturesUncheckedCreateWithoutMapInput>
    connectOrCreate?: MapFeaturesCreateOrConnectWithoutMapInput
    connect?: MapFeaturesWhereUniqueInput
  }

  export type FatiguedMapCreateNestedManyWithoutMapInput = {
    create?: XOR<FatiguedMapCreateWithoutMapInput, FatiguedMapUncheckedCreateWithoutMapInput> | FatiguedMapCreateWithoutMapInput[] | FatiguedMapUncheckedCreateWithoutMapInput[]
    connectOrCreate?: FatiguedMapCreateOrConnectWithoutMapInput | FatiguedMapCreateOrConnectWithoutMapInput[]
    createMany?: FatiguedMapCreateManyMapInputEnvelope
    connect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
  }

  export type MapFeaturesUncheckedCreateNestedOneWithoutMapInput = {
    create?: XOR<MapFeaturesCreateWithoutMapInput, MapFeaturesUncheckedCreateWithoutMapInput>
    connectOrCreate?: MapFeaturesCreateOrConnectWithoutMapInput
    connect?: MapFeaturesWhereUniqueInput
  }

  export type FatiguedMapUncheckedCreateNestedManyWithoutMapInput = {
    create?: XOR<FatiguedMapCreateWithoutMapInput, FatiguedMapUncheckedCreateWithoutMapInput> | FatiguedMapCreateWithoutMapInput[] | FatiguedMapUncheckedCreateWithoutMapInput[]
    connectOrCreate?: FatiguedMapCreateOrConnectWithoutMapInput | FatiguedMapCreateOrConnectWithoutMapInput[]
    createMany?: FatiguedMapCreateManyMapInputEnvelope
    connect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type MapFeaturesUpdateOneWithoutMapNestedInput = {
    create?: XOR<MapFeaturesCreateWithoutMapInput, MapFeaturesUncheckedCreateWithoutMapInput>
    connectOrCreate?: MapFeaturesCreateOrConnectWithoutMapInput
    upsert?: MapFeaturesUpsertWithoutMapInput
    disconnect?: MapFeaturesWhereInput | boolean
    delete?: MapFeaturesWhereInput | boolean
    connect?: MapFeaturesWhereUniqueInput
    update?: XOR<XOR<MapFeaturesUpdateToOneWithWhereWithoutMapInput, MapFeaturesUpdateWithoutMapInput>, MapFeaturesUncheckedUpdateWithoutMapInput>
  }

  export type FatiguedMapUpdateManyWithoutMapNestedInput = {
    create?: XOR<FatiguedMapCreateWithoutMapInput, FatiguedMapUncheckedCreateWithoutMapInput> | FatiguedMapCreateWithoutMapInput[] | FatiguedMapUncheckedCreateWithoutMapInput[]
    connectOrCreate?: FatiguedMapCreateOrConnectWithoutMapInput | FatiguedMapCreateOrConnectWithoutMapInput[]
    upsert?: FatiguedMapUpsertWithWhereUniqueWithoutMapInput | FatiguedMapUpsertWithWhereUniqueWithoutMapInput[]
    createMany?: FatiguedMapCreateManyMapInputEnvelope
    set?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    disconnect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    delete?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    connect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    update?: FatiguedMapUpdateWithWhereUniqueWithoutMapInput | FatiguedMapUpdateWithWhereUniqueWithoutMapInput[]
    updateMany?: FatiguedMapUpdateManyWithWhereWithoutMapInput | FatiguedMapUpdateManyWithWhereWithoutMapInput[]
    deleteMany?: FatiguedMapScalarWhereInput | FatiguedMapScalarWhereInput[]
  }

  export type MapFeaturesUncheckedUpdateOneWithoutMapNestedInput = {
    create?: XOR<MapFeaturesCreateWithoutMapInput, MapFeaturesUncheckedCreateWithoutMapInput>
    connectOrCreate?: MapFeaturesCreateOrConnectWithoutMapInput
    upsert?: MapFeaturesUpsertWithoutMapInput
    disconnect?: MapFeaturesWhereInput | boolean
    delete?: MapFeaturesWhereInput | boolean
    connect?: MapFeaturesWhereUniqueInput
    update?: XOR<XOR<MapFeaturesUpdateToOneWithWhereWithoutMapInput, MapFeaturesUpdateWithoutMapInput>, MapFeaturesUncheckedUpdateWithoutMapInput>
  }

  export type FatiguedMapUncheckedUpdateManyWithoutMapNestedInput = {
    create?: XOR<FatiguedMapCreateWithoutMapInput, FatiguedMapUncheckedCreateWithoutMapInput> | FatiguedMapCreateWithoutMapInput[] | FatiguedMapUncheckedCreateWithoutMapInput[]
    connectOrCreate?: FatiguedMapCreateOrConnectWithoutMapInput | FatiguedMapCreateOrConnectWithoutMapInput[]
    upsert?: FatiguedMapUpsertWithWhereUniqueWithoutMapInput | FatiguedMapUpsertWithWhereUniqueWithoutMapInput[]
    createMany?: FatiguedMapCreateManyMapInputEnvelope
    set?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    disconnect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    delete?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    connect?: FatiguedMapWhereUniqueInput | FatiguedMapWhereUniqueInput[]
    update?: FatiguedMapUpdateWithWhereUniqueWithoutMapInput | FatiguedMapUpdateWithWhereUniqueWithoutMapInput[]
    updateMany?: FatiguedMapUpdateManyWithWhereWithoutMapInput | FatiguedMapUpdateManyWithWhereWithoutMapInput[]
    deleteMany?: FatiguedMapScalarWhereInput | FatiguedMapScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutEventsInput = {
    create?: XOR<UserCreateWithoutEventsInput, UserUncheckedCreateWithoutEventsInput>
    connectOrCreate?: UserCreateOrConnectWithoutEventsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneWithoutEventsNestedInput = {
    create?: XOR<UserCreateWithoutEventsInput, UserUncheckedCreateWithoutEventsInput>
    connectOrCreate?: UserCreateOrConnectWithoutEventsInput
    upsert?: UserUpsertWithoutEventsInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutEventsInput, UserUpdateWithoutEventsInput>, UserUncheckedUpdateWithoutEventsInput>
  }

  export type UserCreateNestedOneWithoutPlayerFeaturesInput = {
    create?: XOR<UserCreateWithoutPlayerFeaturesInput, UserUncheckedCreateWithoutPlayerFeaturesInput>
    connectOrCreate?: UserCreateOrConnectWithoutPlayerFeaturesInput
    connect?: UserWhereUniqueInput
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type UserUpdateOneRequiredWithoutPlayerFeaturesNestedInput = {
    create?: XOR<UserCreateWithoutPlayerFeaturesInput, UserUncheckedCreateWithoutPlayerFeaturesInput>
    connectOrCreate?: UserCreateOrConnectWithoutPlayerFeaturesInput
    upsert?: UserUpsertWithoutPlayerFeaturesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutPlayerFeaturesInput, UserUpdateWithoutPlayerFeaturesInput>, UserUncheckedUpdateWithoutPlayerFeaturesInput>
  }

  export type GameMapCreateNestedOneWithoutMapFeaturesInput = {
    create?: XOR<GameMapCreateWithoutMapFeaturesInput, GameMapUncheckedCreateWithoutMapFeaturesInput>
    connectOrCreate?: GameMapCreateOrConnectWithoutMapFeaturesInput
    connect?: GameMapWhereUniqueInput
  }

  export type GameMapUpdateOneRequiredWithoutMapFeaturesNestedInput = {
    create?: XOR<GameMapCreateWithoutMapFeaturesInput, GameMapUncheckedCreateWithoutMapFeaturesInput>
    connectOrCreate?: GameMapCreateOrConnectWithoutMapFeaturesInput
    upsert?: GameMapUpsertWithoutMapFeaturesInput
    connect?: GameMapWhereUniqueInput
    update?: XOR<XOR<GameMapUpdateToOneWithWhereWithoutMapFeaturesInput, GameMapUpdateWithoutMapFeaturesInput>, GameMapUncheckedUpdateWithoutMapFeaturesInput>
  }

  export type UserCreateNestedOneWithoutSocialAffinity1Input = {
    create?: XOR<UserCreateWithoutSocialAffinity1Input, UserUncheckedCreateWithoutSocialAffinity1Input>
    connectOrCreate?: UserCreateOrConnectWithoutSocialAffinity1Input
    connect?: UserWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutSocialAffinity2Input = {
    create?: XOR<UserCreateWithoutSocialAffinity2Input, UserUncheckedCreateWithoutSocialAffinity2Input>
    connectOrCreate?: UserCreateOrConnectWithoutSocialAffinity2Input
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutSocialAffinity1NestedInput = {
    create?: XOR<UserCreateWithoutSocialAffinity1Input, UserUncheckedCreateWithoutSocialAffinity1Input>
    connectOrCreate?: UserCreateOrConnectWithoutSocialAffinity1Input
    upsert?: UserUpsertWithoutSocialAffinity1Input
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSocialAffinity1Input, UserUpdateWithoutSocialAffinity1Input>, UserUncheckedUpdateWithoutSocialAffinity1Input>
  }

  export type UserUpdateOneRequiredWithoutSocialAffinity2NestedInput = {
    create?: XOR<UserCreateWithoutSocialAffinity2Input, UserUncheckedCreateWithoutSocialAffinity2Input>
    connectOrCreate?: UserCreateOrConnectWithoutSocialAffinity2Input
    upsert?: UserUpsertWithoutSocialAffinity2Input
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSocialAffinity2Input, UserUpdateWithoutSocialAffinity2Input>, UserUncheckedUpdateWithoutSocialAffinity2Input>
  }

  export type UserCreateNestedOneWithoutFatiguedMapsInput = {
    create?: XOR<UserCreateWithoutFatiguedMapsInput, UserUncheckedCreateWithoutFatiguedMapsInput>
    connectOrCreate?: UserCreateOrConnectWithoutFatiguedMapsInput
    connect?: UserWhereUniqueInput
  }

  export type GameMapCreateNestedOneWithoutFatiguedPlayersInput = {
    create?: XOR<GameMapCreateWithoutFatiguedPlayersInput, GameMapUncheckedCreateWithoutFatiguedPlayersInput>
    connectOrCreate?: GameMapCreateOrConnectWithoutFatiguedPlayersInput
    connect?: GameMapWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutFatiguedMapsNestedInput = {
    create?: XOR<UserCreateWithoutFatiguedMapsInput, UserUncheckedCreateWithoutFatiguedMapsInput>
    connectOrCreate?: UserCreateOrConnectWithoutFatiguedMapsInput
    upsert?: UserUpsertWithoutFatiguedMapsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutFatiguedMapsInput, UserUpdateWithoutFatiguedMapsInput>, UserUncheckedUpdateWithoutFatiguedMapsInput>
  }

  export type GameMapUpdateOneRequiredWithoutFatiguedPlayersNestedInput = {
    create?: XOR<GameMapCreateWithoutFatiguedPlayersInput, GameMapUncheckedCreateWithoutFatiguedPlayersInput>
    connectOrCreate?: GameMapCreateOrConnectWithoutFatiguedPlayersInput
    upsert?: GameMapUpsertWithoutFatiguedPlayersInput
    connect?: GameMapWhereUniqueInput
    update?: XOR<XOR<GameMapUpdateToOneWithWhereWithoutFatiguedPlayersInput, GameMapUpdateWithoutFatiguedPlayersInput>, GameMapUncheckedUpdateWithoutFatiguedPlayersInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type RawEventCreateWithoutUserInput = {
    id?: string
    eventType: string
    timestamp?: Date | string
    payload: JsonNullValueInput | InputJsonValue
  }

  export type RawEventUncheckedCreateWithoutUserInput = {
    id?: string
    eventType: string
    timestamp?: Date | string
    payload: JsonNullValueInput | InputJsonValue
  }

  export type RawEventCreateOrConnectWithoutUserInput = {
    where: RawEventWhereUniqueInput
    create: XOR<RawEventCreateWithoutUserInput, RawEventUncheckedCreateWithoutUserInput>
  }

  export type RawEventCreateManyUserInputEnvelope = {
    data: RawEventCreateManyUserInput | RawEventCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type PlayerFeaturesCreateWithoutUserInput = {
    lastActive: Date | string
    totalPlayTime?: number
    matchesPlayed?: number
    preferredLanguage?: string
    explorerRatio?: number | null
    playerProfile?: string | null
    popularitySensitivity?: number | null
    returnIntent?: number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PlayerFeaturesUncheckedCreateWithoutUserInput = {
    lastActive: Date | string
    totalPlayTime?: number
    matchesPlayed?: number
    preferredLanguage?: string
    explorerRatio?: number | null
    playerProfile?: string | null
    popularitySensitivity?: number | null
    returnIntent?: number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PlayerFeaturesCreateOrConnectWithoutUserInput = {
    where: PlayerFeaturesWhereUniqueInput
    create: XOR<PlayerFeaturesCreateWithoutUserInput, PlayerFeaturesUncheckedCreateWithoutUserInput>
  }

  export type SocialAffinityCreateWithoutUser1Input = {
    id?: string
    affinity?: number
    updatedAt?: Date | string
    user2: UserCreateNestedOneWithoutSocialAffinity2Input
  }

  export type SocialAffinityUncheckedCreateWithoutUser1Input = {
    id?: string
    userId2: string
    affinity?: number
    updatedAt?: Date | string
  }

  export type SocialAffinityCreateOrConnectWithoutUser1Input = {
    where: SocialAffinityWhereUniqueInput
    create: XOR<SocialAffinityCreateWithoutUser1Input, SocialAffinityUncheckedCreateWithoutUser1Input>
  }

  export type SocialAffinityCreateManyUser1InputEnvelope = {
    data: SocialAffinityCreateManyUser1Input | SocialAffinityCreateManyUser1Input[]
    skipDuplicates?: boolean
  }

  export type SocialAffinityCreateWithoutUser2Input = {
    id?: string
    affinity?: number
    updatedAt?: Date | string
    user1: UserCreateNestedOneWithoutSocialAffinity1Input
  }

  export type SocialAffinityUncheckedCreateWithoutUser2Input = {
    id?: string
    userId1: string
    affinity?: number
    updatedAt?: Date | string
  }

  export type SocialAffinityCreateOrConnectWithoutUser2Input = {
    where: SocialAffinityWhereUniqueInput
    create: XOR<SocialAffinityCreateWithoutUser2Input, SocialAffinityUncheckedCreateWithoutUser2Input>
  }

  export type SocialAffinityCreateManyUser2InputEnvelope = {
    data: SocialAffinityCreateManyUser2Input | SocialAffinityCreateManyUser2Input[]
    skipDuplicates?: boolean
  }

  export type FatiguedMapCreateWithoutUserInput = {
    fatiguedAt?: Date | string
    expiresAt: Date | string
    map: GameMapCreateNestedOneWithoutFatiguedPlayersInput
  }

  export type FatiguedMapUncheckedCreateWithoutUserInput = {
    mapId: string
    fatiguedAt?: Date | string
    expiresAt: Date | string
  }

  export type FatiguedMapCreateOrConnectWithoutUserInput = {
    where: FatiguedMapWhereUniqueInput
    create: XOR<FatiguedMapCreateWithoutUserInput, FatiguedMapUncheckedCreateWithoutUserInput>
  }

  export type FatiguedMapCreateManyUserInputEnvelope = {
    data: FatiguedMapCreateManyUserInput | FatiguedMapCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type RawEventUpsertWithWhereUniqueWithoutUserInput = {
    where: RawEventWhereUniqueInput
    update: XOR<RawEventUpdateWithoutUserInput, RawEventUncheckedUpdateWithoutUserInput>
    create: XOR<RawEventCreateWithoutUserInput, RawEventUncheckedCreateWithoutUserInput>
  }

  export type RawEventUpdateWithWhereUniqueWithoutUserInput = {
    where: RawEventWhereUniqueInput
    data: XOR<RawEventUpdateWithoutUserInput, RawEventUncheckedUpdateWithoutUserInput>
  }

  export type RawEventUpdateManyWithWhereWithoutUserInput = {
    where: RawEventScalarWhereInput
    data: XOR<RawEventUpdateManyMutationInput, RawEventUncheckedUpdateManyWithoutUserInput>
  }

  export type RawEventScalarWhereInput = {
    AND?: RawEventScalarWhereInput | RawEventScalarWhereInput[]
    OR?: RawEventScalarWhereInput[]
    NOT?: RawEventScalarWhereInput | RawEventScalarWhereInput[]
    id?: StringFilter<"RawEvent"> | string
    eventType?: StringFilter<"RawEvent"> | string
    userId?: StringNullableFilter<"RawEvent"> | string | null
    timestamp?: DateTimeFilter<"RawEvent"> | Date | string
    payload?: JsonFilter<"RawEvent">
  }

  export type PlayerFeaturesUpsertWithoutUserInput = {
    update: XOR<PlayerFeaturesUpdateWithoutUserInput, PlayerFeaturesUncheckedUpdateWithoutUserInput>
    create: XOR<PlayerFeaturesCreateWithoutUserInput, PlayerFeaturesUncheckedCreateWithoutUserInput>
    where?: PlayerFeaturesWhereInput
  }

  export type PlayerFeaturesUpdateToOneWithWhereWithoutUserInput = {
    where?: PlayerFeaturesWhereInput
    data: XOR<PlayerFeaturesUpdateWithoutUserInput, PlayerFeaturesUncheckedUpdateWithoutUserInput>
  }

  export type PlayerFeaturesUpdateWithoutUserInput = {
    lastActive?: DateTimeFieldUpdateOperationsInput | Date | string
    totalPlayTime?: FloatFieldUpdateOperationsInput | number
    matchesPlayed?: IntFieldUpdateOperationsInput | number
    preferredLanguage?: StringFieldUpdateOperationsInput | string
    explorerRatio?: NullableFloatFieldUpdateOperationsInput | number | null
    playerProfile?: NullableStringFieldUpdateOperationsInput | string | null
    popularitySensitivity?: NullableFloatFieldUpdateOperationsInput | number | null
    returnIntent?: NullableFloatFieldUpdateOperationsInput | number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
  }

  export type PlayerFeaturesUncheckedUpdateWithoutUserInput = {
    lastActive?: DateTimeFieldUpdateOperationsInput | Date | string
    totalPlayTime?: FloatFieldUpdateOperationsInput | number
    matchesPlayed?: IntFieldUpdateOperationsInput | number
    preferredLanguage?: StringFieldUpdateOperationsInput | string
    explorerRatio?: NullableFloatFieldUpdateOperationsInput | number | null
    playerProfile?: NullableStringFieldUpdateOperationsInput | string | null
    popularitySensitivity?: NullableFloatFieldUpdateOperationsInput | number | null
    returnIntent?: NullableFloatFieldUpdateOperationsInput | number | null
    scheduleProfile?: NullableJsonNullValueInput | InputJsonValue
  }

  export type SocialAffinityUpsertWithWhereUniqueWithoutUser1Input = {
    where: SocialAffinityWhereUniqueInput
    update: XOR<SocialAffinityUpdateWithoutUser1Input, SocialAffinityUncheckedUpdateWithoutUser1Input>
    create: XOR<SocialAffinityCreateWithoutUser1Input, SocialAffinityUncheckedCreateWithoutUser1Input>
  }

  export type SocialAffinityUpdateWithWhereUniqueWithoutUser1Input = {
    where: SocialAffinityWhereUniqueInput
    data: XOR<SocialAffinityUpdateWithoutUser1Input, SocialAffinityUncheckedUpdateWithoutUser1Input>
  }

  export type SocialAffinityUpdateManyWithWhereWithoutUser1Input = {
    where: SocialAffinityScalarWhereInput
    data: XOR<SocialAffinityUpdateManyMutationInput, SocialAffinityUncheckedUpdateManyWithoutUser1Input>
  }

  export type SocialAffinityScalarWhereInput = {
    AND?: SocialAffinityScalarWhereInput | SocialAffinityScalarWhereInput[]
    OR?: SocialAffinityScalarWhereInput[]
    NOT?: SocialAffinityScalarWhereInput | SocialAffinityScalarWhereInput[]
    id?: StringFilter<"SocialAffinity"> | string
    userId1?: StringFilter<"SocialAffinity"> | string
    userId2?: StringFilter<"SocialAffinity"> | string
    affinity?: FloatFilter<"SocialAffinity"> | number
    updatedAt?: DateTimeFilter<"SocialAffinity"> | Date | string
  }

  export type SocialAffinityUpsertWithWhereUniqueWithoutUser2Input = {
    where: SocialAffinityWhereUniqueInput
    update: XOR<SocialAffinityUpdateWithoutUser2Input, SocialAffinityUncheckedUpdateWithoutUser2Input>
    create: XOR<SocialAffinityCreateWithoutUser2Input, SocialAffinityUncheckedCreateWithoutUser2Input>
  }

  export type SocialAffinityUpdateWithWhereUniqueWithoutUser2Input = {
    where: SocialAffinityWhereUniqueInput
    data: XOR<SocialAffinityUpdateWithoutUser2Input, SocialAffinityUncheckedUpdateWithoutUser2Input>
  }

  export type SocialAffinityUpdateManyWithWhereWithoutUser2Input = {
    where: SocialAffinityScalarWhereInput
    data: XOR<SocialAffinityUpdateManyMutationInput, SocialAffinityUncheckedUpdateManyWithoutUser2Input>
  }

  export type FatiguedMapUpsertWithWhereUniqueWithoutUserInput = {
    where: FatiguedMapWhereUniqueInput
    update: XOR<FatiguedMapUpdateWithoutUserInput, FatiguedMapUncheckedUpdateWithoutUserInput>
    create: XOR<FatiguedMapCreateWithoutUserInput, FatiguedMapUncheckedCreateWithoutUserInput>
  }

  export type FatiguedMapUpdateWithWhereUniqueWithoutUserInput = {
    where: FatiguedMapWhereUniqueInput
    data: XOR<FatiguedMapUpdateWithoutUserInput, FatiguedMapUncheckedUpdateWithoutUserInput>
  }

  export type FatiguedMapUpdateManyWithWhereWithoutUserInput = {
    where: FatiguedMapScalarWhereInput
    data: XOR<FatiguedMapUpdateManyMutationInput, FatiguedMapUncheckedUpdateManyWithoutUserInput>
  }

  export type FatiguedMapScalarWhereInput = {
    AND?: FatiguedMapScalarWhereInput | FatiguedMapScalarWhereInput[]
    OR?: FatiguedMapScalarWhereInput[]
    NOT?: FatiguedMapScalarWhereInput | FatiguedMapScalarWhereInput[]
    userId?: StringFilter<"FatiguedMap"> | string
    mapId?: StringFilter<"FatiguedMap"> | string
    fatiguedAt?: DateTimeFilter<"FatiguedMap"> | Date | string
    expiresAt?: DateTimeFilter<"FatiguedMap"> | Date | string
  }

  export type MapFeaturesCreateWithoutMapInput = {
    totalJoins?: number
    totalLeaves?: number
    bounceCount?: number
    averageDuration?: number
    bounceRate?: number
    medianPlaytime?: number | null
    completionRate?: number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: number | null
    difficultyLabel?: string | null
    paceScore?: number | null
    paceLabel?: string | null
    earlyAbandonRate?: number | null
    stickyFactor?: number | null
    viralityFactor?: number | null
  }

  export type MapFeaturesUncheckedCreateWithoutMapInput = {
    totalJoins?: number
    totalLeaves?: number
    bounceCount?: number
    averageDuration?: number
    bounceRate?: number
    medianPlaytime?: number | null
    completionRate?: number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: number | null
    difficultyLabel?: string | null
    paceScore?: number | null
    paceLabel?: string | null
    earlyAbandonRate?: number | null
    stickyFactor?: number | null
    viralityFactor?: number | null
  }

  export type MapFeaturesCreateOrConnectWithoutMapInput = {
    where: MapFeaturesWhereUniqueInput
    create: XOR<MapFeaturesCreateWithoutMapInput, MapFeaturesUncheckedCreateWithoutMapInput>
  }

  export type FatiguedMapCreateWithoutMapInput = {
    fatiguedAt?: Date | string
    expiresAt: Date | string
    user: UserCreateNestedOneWithoutFatiguedMapsInput
  }

  export type FatiguedMapUncheckedCreateWithoutMapInput = {
    userId: string
    fatiguedAt?: Date | string
    expiresAt: Date | string
  }

  export type FatiguedMapCreateOrConnectWithoutMapInput = {
    where: FatiguedMapWhereUniqueInput
    create: XOR<FatiguedMapCreateWithoutMapInput, FatiguedMapUncheckedCreateWithoutMapInput>
  }

  export type FatiguedMapCreateManyMapInputEnvelope = {
    data: FatiguedMapCreateManyMapInput | FatiguedMapCreateManyMapInput[]
    skipDuplicates?: boolean
  }

  export type MapFeaturesUpsertWithoutMapInput = {
    update: XOR<MapFeaturesUpdateWithoutMapInput, MapFeaturesUncheckedUpdateWithoutMapInput>
    create: XOR<MapFeaturesCreateWithoutMapInput, MapFeaturesUncheckedCreateWithoutMapInput>
    where?: MapFeaturesWhereInput
  }

  export type MapFeaturesUpdateToOneWithWhereWithoutMapInput = {
    where?: MapFeaturesWhereInput
    data: XOR<MapFeaturesUpdateWithoutMapInput, MapFeaturesUncheckedUpdateWithoutMapInput>
  }

  export type MapFeaturesUpdateWithoutMapInput = {
    totalJoins?: IntFieldUpdateOperationsInput | number
    totalLeaves?: IntFieldUpdateOperationsInput | number
    bounceCount?: IntFieldUpdateOperationsInput | number
    averageDuration?: FloatFieldUpdateOperationsInput | number
    bounceRate?: FloatFieldUpdateOperationsInput | number
    medianPlaytime?: NullableFloatFieldUpdateOperationsInput | number | null
    completionRate?: NullableFloatFieldUpdateOperationsInput | number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: NullableFloatFieldUpdateOperationsInput | number | null
    difficultyLabel?: NullableStringFieldUpdateOperationsInput | string | null
    paceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    paceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    earlyAbandonRate?: NullableFloatFieldUpdateOperationsInput | number | null
    stickyFactor?: NullableFloatFieldUpdateOperationsInput | number | null
    viralityFactor?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type MapFeaturesUncheckedUpdateWithoutMapInput = {
    totalJoins?: IntFieldUpdateOperationsInput | number
    totalLeaves?: IntFieldUpdateOperationsInput | number
    bounceCount?: IntFieldUpdateOperationsInput | number
    averageDuration?: FloatFieldUpdateOperationsInput | number
    bounceRate?: FloatFieldUpdateOperationsInput | number
    medianPlaytime?: NullableFloatFieldUpdateOperationsInput | number | null
    completionRate?: NullableFloatFieldUpdateOperationsInput | number | null
    retentionCurve?: NullableJsonNullValueInput | InputJsonValue
    difficultyScore?: NullableFloatFieldUpdateOperationsInput | number | null
    difficultyLabel?: NullableStringFieldUpdateOperationsInput | string | null
    paceScore?: NullableFloatFieldUpdateOperationsInput | number | null
    paceLabel?: NullableStringFieldUpdateOperationsInput | string | null
    earlyAbandonRate?: NullableFloatFieldUpdateOperationsInput | number | null
    stickyFactor?: NullableFloatFieldUpdateOperationsInput | number | null
    viralityFactor?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type FatiguedMapUpsertWithWhereUniqueWithoutMapInput = {
    where: FatiguedMapWhereUniqueInput
    update: XOR<FatiguedMapUpdateWithoutMapInput, FatiguedMapUncheckedUpdateWithoutMapInput>
    create: XOR<FatiguedMapCreateWithoutMapInput, FatiguedMapUncheckedCreateWithoutMapInput>
  }

  export type FatiguedMapUpdateWithWhereUniqueWithoutMapInput = {
    where: FatiguedMapWhereUniqueInput
    data: XOR<FatiguedMapUpdateWithoutMapInput, FatiguedMapUncheckedUpdateWithoutMapInput>
  }

  export type FatiguedMapUpdateManyWithWhereWithoutMapInput = {
    where: FatiguedMapScalarWhereInput
    data: XOR<FatiguedMapUpdateManyMutationInput, FatiguedMapUncheckedUpdateManyWithoutMapInput>
  }

  export type UserCreateWithoutEventsInput = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    playerFeatures?: PlayerFeaturesCreateNestedOneWithoutUserInput
    socialAffinity1?: SocialAffinityCreateNestedManyWithoutUser1Input
    socialAffinity2?: SocialAffinityCreateNestedManyWithoutUser2Input
    fatiguedMaps?: FatiguedMapCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutEventsInput = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    playerFeatures?: PlayerFeaturesUncheckedCreateNestedOneWithoutUserInput
    socialAffinity1?: SocialAffinityUncheckedCreateNestedManyWithoutUser1Input
    socialAffinity2?: SocialAffinityUncheckedCreateNestedManyWithoutUser2Input
    fatiguedMaps?: FatiguedMapUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutEventsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutEventsInput, UserUncheckedCreateWithoutEventsInput>
  }

  export type UserUpsertWithoutEventsInput = {
    update: XOR<UserUpdateWithoutEventsInput, UserUncheckedUpdateWithoutEventsInput>
    create: XOR<UserCreateWithoutEventsInput, UserUncheckedCreateWithoutEventsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutEventsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutEventsInput, UserUncheckedUpdateWithoutEventsInput>
  }

  export type UserUpdateWithoutEventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    playerFeatures?: PlayerFeaturesUpdateOneWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUpdateManyWithoutUser1NestedInput
    socialAffinity2?: SocialAffinityUpdateManyWithoutUser2NestedInput
    fatiguedMaps?: FatiguedMapUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutEventsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    playerFeatures?: PlayerFeaturesUncheckedUpdateOneWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUncheckedUpdateManyWithoutUser1NestedInput
    socialAffinity2?: SocialAffinityUncheckedUpdateManyWithoutUser2NestedInput
    fatiguedMaps?: FatiguedMapUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutPlayerFeaturesInput = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventCreateNestedManyWithoutUserInput
    socialAffinity1?: SocialAffinityCreateNestedManyWithoutUser1Input
    socialAffinity2?: SocialAffinityCreateNestedManyWithoutUser2Input
    fatiguedMaps?: FatiguedMapCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutPlayerFeaturesInput = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventUncheckedCreateNestedManyWithoutUserInput
    socialAffinity1?: SocialAffinityUncheckedCreateNestedManyWithoutUser1Input
    socialAffinity2?: SocialAffinityUncheckedCreateNestedManyWithoutUser2Input
    fatiguedMaps?: FatiguedMapUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutPlayerFeaturesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutPlayerFeaturesInput, UserUncheckedCreateWithoutPlayerFeaturesInput>
  }

  export type UserUpsertWithoutPlayerFeaturesInput = {
    update: XOR<UserUpdateWithoutPlayerFeaturesInput, UserUncheckedUpdateWithoutPlayerFeaturesInput>
    create: XOR<UserCreateWithoutPlayerFeaturesInput, UserUncheckedCreateWithoutPlayerFeaturesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutPlayerFeaturesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutPlayerFeaturesInput, UserUncheckedUpdateWithoutPlayerFeaturesInput>
  }

  export type UserUpdateWithoutPlayerFeaturesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUpdateManyWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUpdateManyWithoutUser1NestedInput
    socialAffinity2?: SocialAffinityUpdateManyWithoutUser2NestedInput
    fatiguedMaps?: FatiguedMapUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutPlayerFeaturesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUncheckedUpdateManyWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUncheckedUpdateManyWithoutUser1NestedInput
    socialAffinity2?: SocialAffinityUncheckedUpdateManyWithoutUser2NestedInput
    fatiguedMaps?: FatiguedMapUncheckedUpdateManyWithoutUserNestedInput
  }

  export type GameMapCreateWithoutMapFeaturesInput = {
    id: string
    slug: string
    name: string
    ownerId?: string | null
    isPublished: boolean
    createdAt: Date | string
    updatedAt: Date | string
    fatiguedPlayers?: FatiguedMapCreateNestedManyWithoutMapInput
  }

  export type GameMapUncheckedCreateWithoutMapFeaturesInput = {
    id: string
    slug: string
    name: string
    ownerId?: string | null
    isPublished: boolean
    createdAt: Date | string
    updatedAt: Date | string
    fatiguedPlayers?: FatiguedMapUncheckedCreateNestedManyWithoutMapInput
  }

  export type GameMapCreateOrConnectWithoutMapFeaturesInput = {
    where: GameMapWhereUniqueInput
    create: XOR<GameMapCreateWithoutMapFeaturesInput, GameMapUncheckedCreateWithoutMapFeaturesInput>
  }

  export type GameMapUpsertWithoutMapFeaturesInput = {
    update: XOR<GameMapUpdateWithoutMapFeaturesInput, GameMapUncheckedUpdateWithoutMapFeaturesInput>
    create: XOR<GameMapCreateWithoutMapFeaturesInput, GameMapUncheckedCreateWithoutMapFeaturesInput>
    where?: GameMapWhereInput
  }

  export type GameMapUpdateToOneWithWhereWithoutMapFeaturesInput = {
    where?: GameMapWhereInput
    data: XOR<GameMapUpdateWithoutMapFeaturesInput, GameMapUncheckedUpdateWithoutMapFeaturesInput>
  }

  export type GameMapUpdateWithoutMapFeaturesInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    ownerId?: NullableStringFieldUpdateOperationsInput | string | null
    isPublished?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    fatiguedPlayers?: FatiguedMapUpdateManyWithoutMapNestedInput
  }

  export type GameMapUncheckedUpdateWithoutMapFeaturesInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    ownerId?: NullableStringFieldUpdateOperationsInput | string | null
    isPublished?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    fatiguedPlayers?: FatiguedMapUncheckedUpdateManyWithoutMapNestedInput
  }

  export type UserCreateWithoutSocialAffinity1Input = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventCreateNestedManyWithoutUserInput
    playerFeatures?: PlayerFeaturesCreateNestedOneWithoutUserInput
    socialAffinity2?: SocialAffinityCreateNestedManyWithoutUser2Input
    fatiguedMaps?: FatiguedMapCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSocialAffinity1Input = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventUncheckedCreateNestedManyWithoutUserInput
    playerFeatures?: PlayerFeaturesUncheckedCreateNestedOneWithoutUserInput
    socialAffinity2?: SocialAffinityUncheckedCreateNestedManyWithoutUser2Input
    fatiguedMaps?: FatiguedMapUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSocialAffinity1Input = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSocialAffinity1Input, UserUncheckedCreateWithoutSocialAffinity1Input>
  }

  export type UserCreateWithoutSocialAffinity2Input = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventCreateNestedManyWithoutUserInput
    playerFeatures?: PlayerFeaturesCreateNestedOneWithoutUserInput
    socialAffinity1?: SocialAffinityCreateNestedManyWithoutUser1Input
    fatiguedMaps?: FatiguedMapCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSocialAffinity2Input = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventUncheckedCreateNestedManyWithoutUserInput
    playerFeatures?: PlayerFeaturesUncheckedCreateNestedOneWithoutUserInput
    socialAffinity1?: SocialAffinityUncheckedCreateNestedManyWithoutUser1Input
    fatiguedMaps?: FatiguedMapUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSocialAffinity2Input = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSocialAffinity2Input, UserUncheckedCreateWithoutSocialAffinity2Input>
  }

  export type UserUpsertWithoutSocialAffinity1Input = {
    update: XOR<UserUpdateWithoutSocialAffinity1Input, UserUncheckedUpdateWithoutSocialAffinity1Input>
    create: XOR<UserCreateWithoutSocialAffinity1Input, UserUncheckedCreateWithoutSocialAffinity1Input>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSocialAffinity1Input = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSocialAffinity1Input, UserUncheckedUpdateWithoutSocialAffinity1Input>
  }

  export type UserUpdateWithoutSocialAffinity1Input = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUpdateManyWithoutUserNestedInput
    playerFeatures?: PlayerFeaturesUpdateOneWithoutUserNestedInput
    socialAffinity2?: SocialAffinityUpdateManyWithoutUser2NestedInput
    fatiguedMaps?: FatiguedMapUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSocialAffinity1Input = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUncheckedUpdateManyWithoutUserNestedInput
    playerFeatures?: PlayerFeaturesUncheckedUpdateOneWithoutUserNestedInput
    socialAffinity2?: SocialAffinityUncheckedUpdateManyWithoutUser2NestedInput
    fatiguedMaps?: FatiguedMapUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserUpsertWithoutSocialAffinity2Input = {
    update: XOR<UserUpdateWithoutSocialAffinity2Input, UserUncheckedUpdateWithoutSocialAffinity2Input>
    create: XOR<UserCreateWithoutSocialAffinity2Input, UserUncheckedCreateWithoutSocialAffinity2Input>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSocialAffinity2Input = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSocialAffinity2Input, UserUncheckedUpdateWithoutSocialAffinity2Input>
  }

  export type UserUpdateWithoutSocialAffinity2Input = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUpdateManyWithoutUserNestedInput
    playerFeatures?: PlayerFeaturesUpdateOneWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUpdateManyWithoutUser1NestedInput
    fatiguedMaps?: FatiguedMapUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSocialAffinity2Input = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUncheckedUpdateManyWithoutUserNestedInput
    playerFeatures?: PlayerFeaturesUncheckedUpdateOneWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUncheckedUpdateManyWithoutUser1NestedInput
    fatiguedMaps?: FatiguedMapUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutFatiguedMapsInput = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventCreateNestedManyWithoutUserInput
    playerFeatures?: PlayerFeaturesCreateNestedOneWithoutUserInput
    socialAffinity1?: SocialAffinityCreateNestedManyWithoutUser1Input
    socialAffinity2?: SocialAffinityCreateNestedManyWithoutUser2Input
  }

  export type UserUncheckedCreateWithoutFatiguedMapsInput = {
    id: string
    email: string
    username: string
    displayName?: string | null
    createdAt: Date | string
    updatedAt: Date | string
    events?: RawEventUncheckedCreateNestedManyWithoutUserInput
    playerFeatures?: PlayerFeaturesUncheckedCreateNestedOneWithoutUserInput
    socialAffinity1?: SocialAffinityUncheckedCreateNestedManyWithoutUser1Input
    socialAffinity2?: SocialAffinityUncheckedCreateNestedManyWithoutUser2Input
  }

  export type UserCreateOrConnectWithoutFatiguedMapsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutFatiguedMapsInput, UserUncheckedCreateWithoutFatiguedMapsInput>
  }

  export type GameMapCreateWithoutFatiguedPlayersInput = {
    id: string
    slug: string
    name: string
    ownerId?: string | null
    isPublished: boolean
    createdAt: Date | string
    updatedAt: Date | string
    mapFeatures?: MapFeaturesCreateNestedOneWithoutMapInput
  }

  export type GameMapUncheckedCreateWithoutFatiguedPlayersInput = {
    id: string
    slug: string
    name: string
    ownerId?: string | null
    isPublished: boolean
    createdAt: Date | string
    updatedAt: Date | string
    mapFeatures?: MapFeaturesUncheckedCreateNestedOneWithoutMapInput
  }

  export type GameMapCreateOrConnectWithoutFatiguedPlayersInput = {
    where: GameMapWhereUniqueInput
    create: XOR<GameMapCreateWithoutFatiguedPlayersInput, GameMapUncheckedCreateWithoutFatiguedPlayersInput>
  }

  export type UserUpsertWithoutFatiguedMapsInput = {
    update: XOR<UserUpdateWithoutFatiguedMapsInput, UserUncheckedUpdateWithoutFatiguedMapsInput>
    create: XOR<UserCreateWithoutFatiguedMapsInput, UserUncheckedCreateWithoutFatiguedMapsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutFatiguedMapsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutFatiguedMapsInput, UserUncheckedUpdateWithoutFatiguedMapsInput>
  }

  export type UserUpdateWithoutFatiguedMapsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUpdateManyWithoutUserNestedInput
    playerFeatures?: PlayerFeaturesUpdateOneWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUpdateManyWithoutUser1NestedInput
    socialAffinity2?: SocialAffinityUpdateManyWithoutUser2NestedInput
  }

  export type UserUncheckedUpdateWithoutFatiguedMapsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    username?: StringFieldUpdateOperationsInput | string
    displayName?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    events?: RawEventUncheckedUpdateManyWithoutUserNestedInput
    playerFeatures?: PlayerFeaturesUncheckedUpdateOneWithoutUserNestedInput
    socialAffinity1?: SocialAffinityUncheckedUpdateManyWithoutUser1NestedInput
    socialAffinity2?: SocialAffinityUncheckedUpdateManyWithoutUser2NestedInput
  }

  export type GameMapUpsertWithoutFatiguedPlayersInput = {
    update: XOR<GameMapUpdateWithoutFatiguedPlayersInput, GameMapUncheckedUpdateWithoutFatiguedPlayersInput>
    create: XOR<GameMapCreateWithoutFatiguedPlayersInput, GameMapUncheckedCreateWithoutFatiguedPlayersInput>
    where?: GameMapWhereInput
  }

  export type GameMapUpdateToOneWithWhereWithoutFatiguedPlayersInput = {
    where?: GameMapWhereInput
    data: XOR<GameMapUpdateWithoutFatiguedPlayersInput, GameMapUncheckedUpdateWithoutFatiguedPlayersInput>
  }

  export type GameMapUpdateWithoutFatiguedPlayersInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    ownerId?: NullableStringFieldUpdateOperationsInput | string | null
    isPublished?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    mapFeatures?: MapFeaturesUpdateOneWithoutMapNestedInput
  }

  export type GameMapUncheckedUpdateWithoutFatiguedPlayersInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    ownerId?: NullableStringFieldUpdateOperationsInput | string | null
    isPublished?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    mapFeatures?: MapFeaturesUncheckedUpdateOneWithoutMapNestedInput
  }

  export type RawEventCreateManyUserInput = {
    id?: string
    eventType: string
    timestamp?: Date | string
    payload: JsonNullValueInput | InputJsonValue
  }

  export type SocialAffinityCreateManyUser1Input = {
    id?: string
    userId2: string
    affinity?: number
    updatedAt?: Date | string
  }

  export type SocialAffinityCreateManyUser2Input = {
    id?: string
    userId1: string
    affinity?: number
    updatedAt?: Date | string
  }

  export type FatiguedMapCreateManyUserInput = {
    mapId: string
    fatiguedAt?: Date | string
    expiresAt: Date | string
  }

  export type RawEventUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
  }

  export type RawEventUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
  }

  export type RawEventUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    eventType?: StringFieldUpdateOperationsInput | string
    timestamp?: DateTimeFieldUpdateOperationsInput | Date | string
    payload?: JsonNullValueInput | InputJsonValue
  }

  export type SocialAffinityUpdateWithoutUser1Input = {
    id?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user2?: UserUpdateOneRequiredWithoutSocialAffinity2NestedInput
  }

  export type SocialAffinityUncheckedUpdateWithoutUser1Input = {
    id?: StringFieldUpdateOperationsInput | string
    userId2?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SocialAffinityUncheckedUpdateManyWithoutUser1Input = {
    id?: StringFieldUpdateOperationsInput | string
    userId2?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SocialAffinityUpdateWithoutUser2Input = {
    id?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user1?: UserUpdateOneRequiredWithoutSocialAffinity1NestedInput
  }

  export type SocialAffinityUncheckedUpdateWithoutUser2Input = {
    id?: StringFieldUpdateOperationsInput | string
    userId1?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SocialAffinityUncheckedUpdateManyWithoutUser2Input = {
    id?: StringFieldUpdateOperationsInput | string
    userId1?: StringFieldUpdateOperationsInput | string
    affinity?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FatiguedMapUpdateWithoutUserInput = {
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    map?: GameMapUpdateOneRequiredWithoutFatiguedPlayersNestedInput
  }

  export type FatiguedMapUncheckedUpdateWithoutUserInput = {
    mapId?: StringFieldUpdateOperationsInput | string
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FatiguedMapUncheckedUpdateManyWithoutUserInput = {
    mapId?: StringFieldUpdateOperationsInput | string
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FatiguedMapCreateManyMapInput = {
    userId: string
    fatiguedAt?: Date | string
    expiresAt: Date | string
  }

  export type FatiguedMapUpdateWithoutMapInput = {
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutFatiguedMapsNestedInput
  }

  export type FatiguedMapUncheckedUpdateWithoutMapInput = {
    userId?: StringFieldUpdateOperationsInput | string
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type FatiguedMapUncheckedUpdateManyWithoutMapInput = {
    userId?: StringFieldUpdateOperationsInput | string
    fatiguedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}