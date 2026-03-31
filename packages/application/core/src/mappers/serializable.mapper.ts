import { SERIALIZE, type ISerializable } from "@domain/core/utils";

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

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

export type DeepMapped<T> =
  T extends ISerializable<infer O>
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
              ? { [K in keyof T]: DeepMapped<T[K]> }
              : T;

const isSerializable = (value: unknown): value is ISerializable<unknown> =>
  typeof value === "object" &&
  value !== null &&
  SERIALIZE in value &&
  typeof (value as ISerializable<unknown>)[SERIALIZE] === "function";

const mapSerializableValue = (value: unknown, seen: WeakSet<object>): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();

  if (isSerializable(value)) {
    return mapSerializableValue(value[SERIALIZE](), seen);
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapSerializableValue(item, seen));
  }

  if (value instanceof Map) {
    if (seen.has(value)) {
      throw new TypeError("Circular structure detected during DTO mapping.");
    }
    seen.add(value);
    try {
      return Array.from(value.entries(), ([k, v]) => [
        mapSerializableValue(k, seen),
        mapSerializableValue(v, seen),
      ]);
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
      return Array.from(value, (item) => mapSerializableValue(item, seen));
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
      const typedKey = key as keyof typeof value;
      mapped[key] = mapSerializableValue(
        (value as Record<PropertyKey, unknown>)[typedKey as PropertyKey],
        seen
      );
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
 */
export function mapSerializableToDTO<T>(input: T): DeepMapped<T> {
  return mapSerializableValue(input, new WeakSet()) as DeepMapped<T>;
}
