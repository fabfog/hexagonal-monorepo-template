import { SERIALIZE, type ISerializable } from "@domain/core/utils";

type Primitive = string | number | boolean | bigint | symbol | null | undefined;
type AnyFunction = (...args: unknown[]) => unknown;

interface SerializableArray extends Array<SerializableValue> {
  readonly __serializableArrayBrand?: never;
}
interface SerializableObject {
  [key: string | number | symbol]: SerializableValue;
}

type SerializableValue =
  | Primitive
  | Date
  | Map<SerializableValue, SerializableValue>
  | Set<SerializableValue>
  | ISerializable<unknown>
  | SerializableArray
  | SerializableObject;

type NonFunctionKeys<T> = {
  [K in keyof T]-?: T[K] extends AnyFunction ? never : K;
}[keyof T];

export type DeepMapped<T> = T extends AnyFunction
  ? never
  : T extends ISerializable<infer O>
    ? DeepMapped<O>
    : T extends Date
      ? string
      : T extends Map<infer K, infer V>
        ? [DeepMapped<K>, DeepMapped<V>][]
        : T extends Set<infer U>
          ? DeepMapped<U>[]
          : T extends readonly (infer U)[]
            ? DeepMapped<U>[]
            : T extends object
              ? {
                  [K in NonFunctionKeys<T> as K extends symbol ? never : K]: DeepMapped<T[K]>;
                }
              : T;

/** Only when traversing plain-object property values may functions be omitted (e.g. methods). */
type MapContext = "default" | "objectProperty";

const isSerializable = (value: unknown): value is ISerializable<unknown> =>
  typeof value === "object" &&
  value !== null &&
  SERIALIZE in value &&
  typeof (value as ISerializable<unknown>)[SERIALIZE] === "function";

const SKIP = Symbol("skip-non-serializable-function");

const FUNCTION_NOT_ALLOWED_MSG =
  "Functions are not serializable outside plain object properties (e.g. not in Array, Map, or Set).";

const mapSerializableValue = (
  value: unknown,
  seen: WeakSet<object>,
  ctx: MapContext = "default"
): unknown => {
  if (typeof value === "function") {
    if (ctx === "objectProperty") return SKIP;
    throw new TypeError(FUNCTION_NOT_ALLOWED_MSG);
  }
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();

  if (isSerializable(value)) {
    return mapSerializableValue(value[SERIALIZE](), seen, "default");
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapSerializableValue(item, seen, "default"));
  }

  if (value instanceof Map) {
    if (seen.has(value)) {
      throw new TypeError("Circular structure detected during DTO mapping.");
    }
    seen.add(value);
    try {
      const mappedEntries: [unknown, unknown][] = [];
      for (const [k, v] of value.entries()) {
        mappedEntries.push([
          mapSerializableValue(k, seen, "default"),
          mapSerializableValue(v, seen, "default"),
        ]);
      }
      return mappedEntries;
    } finally {
      seen.delete(value);
    }
  }

  if (value instanceof Set) {
    if (seen.has(value)) {
      throw new TypeError("Circular structure detected during DTO mapping.");
    }
    seen.add(value);
    try {
      return Array.from(value, (item) => mapSerializableValue(item, seen, "default"));
    } finally {
      seen.delete(value);
    }
  }

  if (seen.has(value)) {
    throw new TypeError("Circular structure detected during DTO mapping.");
  }

  seen.add(value);
  const mapped: Record<string | number | symbol, unknown> = {};
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol") continue;
      const mappedValue = mapSerializableValue(
        (value as Record<PropertyKey, unknown>)[key as PropertyKey],
        seen,
        "objectProperty"
      );
      if (mappedValue === SKIP) continue;
      mapped[key] = mappedValue;
    }
    return mapped;
  } finally {
    seen.delete(value);
  }
};

/**
 * Recursively maps domain objects that implement {@link SERIALIZE}, plus plain
 * objects/arrays and built-ins {@link Date}, {@link Map}, {@link Set}, to a
 * JSON-friendly shape (e.g. `Date` → ISO string; `Map`/`Set` → arrays).
 *
 * Function values on **plain object properties** are omitted (methods). Functions
 * anywhere inside **Array**, **Map**, or **Set** (including as serialized payload
 * roots) throw — they are not valid DTO data.
 */
export function mapSerializableToDTO<T>(input: T): DeepMapped<T> {
  if (typeof input === "function") {
    throw new TypeError("Functions are not serializable.");
  }
  return mapSerializableValue(input, new WeakSet(), "default") as DeepMapped<T>;
}
