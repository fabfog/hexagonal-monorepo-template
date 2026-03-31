import { describe, it, expect } from "vitest";
import { SERIALIZE, type ISerializable } from "@domain/core/utils";
import { mapSerializableToDTO } from "./serializable.mapper";

describe("mapSerializableToDTO", () => {
  describe("primitives", () => {
    it("returns null and undefined as-is", () => {
      expect(mapSerializableToDTO(null)).toBeNull();
      expect(mapSerializableToDTO(undefined)).toBeUndefined();
    });

    it("returns string, number, boolean, bigint unchanged", () => {
      expect(mapSerializableToDTO("x")).toBe("x");
      expect(mapSerializableToDTO(42)).toBe(42);
      expect(mapSerializableToDTO(true)).toBe(true);
      expect(mapSerializableToDTO(false)).toBe(false);
      expect(mapSerializableToDTO(BigInt(7))).toBe(BigInt(7));
    });
  });

  describe("Date", () => {
    it("serializes to ISO string", () => {
      const d = new Date("2024-06-15T12:30:00.000Z");
      expect(mapSerializableToDTO(d)).toBe(d.toISOString());
    });

    it("serializes Date nested in plain object", () => {
      const d = new Date(0);
      expect(
        mapSerializableToDTO({
          createdAt: d,
        })
      ).toEqual({
        createdAt: d.toISOString(),
      });
    });
  });

  describe("Map", () => {
    it("serializes to array of [key, value] pairs with nested mapping", () => {
      const inner = new (class implements ISerializable<{ n: number }> {
        [SERIALIZE]() {
          return { n: 1 };
        }
      })();

      const m = new Map<string, unknown>([
        ["a", 1],
        ["b", inner],
      ]);

      expect(mapSerializableToDTO(m)).toEqual([
        ["a", 1],
        ["b", { n: 1 }],
      ]);
    });

    it("serializes Map keys through the same rules (e.g. Date key)", () => {
      const k = new Date(0);
      const m = new Map([[k, "ok"]]);
      expect(mapSerializableToDTO(m)).toEqual([[k.toISOString(), "ok"]]);
    });
  });

  describe("Set", () => {
    it("serializes to array with nested values", () => {
      const vo = new (class implements ISerializable<string> {
        [SERIALIZE]() {
          return "vo";
        }
      })();

      const s = new Set([1, vo, "x"]);
      expect(mapSerializableToDTO(s)).toEqual([1, "vo", "x"]);
    });
  });

  describe("ISerializable (SERIALIZE symbol)", () => {
    it("unwraps [SERIALIZE]() and maps the payload recursively", () => {
      class Leaf implements ISerializable<string> {
        constructor(private readonly v: string) {}
        [SERIALIZE]() {
          return this.v;
        }
      }

      class Branch implements ISerializable<{ label: string; leaf: Leaf }> {
        constructor(
          private readonly label: string,
          private readonly leaf: Leaf
        ) {}
        [SERIALIZE]() {
          return { label: this.label, leaf: this.leaf };
        }
      }

      const out = mapSerializableToDTO(new Branch("x", new Leaf("y")));

      expect(out).toEqual({
        label: "x",
        leaf: "y",
      });
    });

    it("supports root input that is a plain object containing serializable instances", () => {
      class Id implements ISerializable<string> {
        constructor(private readonly id: string) {}
        [SERIALIZE]() {
          return this.id;
        }
      }

      const out = mapSerializableToDTO({
        id: new Id("abc"),
        count: 2,
      });

      expect(out).toEqual({ id: "abc", count: 2 });
    });
  });

  describe("arrays and plain objects", () => {
    it("maps arrays element-wise", () => {
      expect(mapSerializableToDTO([1, "a", null])).toEqual([1, "a", null]);
    });

    it("maps nested structures", () => {
      expect(
        mapSerializableToDTO({
          a: [{ b: 1 }],
          c: new Date(0),
        })
      ).toEqual({
        a: [{ b: 1 }],
        c: new Date(0).toISOString(),
      });
    });

    it("includes symbol keys from Reflect.ownKeys", () => {
      const sym = Symbol("s");
      const input: Record<PropertyKey, number> = {};
      input[sym] = 99;
      input.a = 1;

      const out = mapSerializableToDTO(input) as Record<PropertyKey, unknown>;
      expect(out.a).toBe(1);
      expect(out[sym]).toBe(99);
    });
  });

  describe("circular references", () => {
    it("throws on circular plain object graph", () => {
      const a: Record<string, unknown> = { name: "a" };
      a.self = a;

      expect(() => mapSerializableToDTO(a)).toThrow(
        "Circular structure detected during DTO mapping."
      );
    });

    it("visits the same object twice when referenced from multiple branches (no cycle; duplicates output)", () => {
      const shared = { x: 1 };
      const root = { a: shared, b: shared };

      expect(mapSerializableToDTO(root)).toEqual({
        a: { x: 1 },
        b: { x: 1 },
      });
    });

    it("throws when a Map references itself as a value", () => {
      const m = new Map<string, unknown>();
      m.set("self", m);

      expect(() => mapSerializableToDTO(m)).toThrow(
        "Circular structure detected during DTO mapping."
      );
    });

    it("throws when a Set references itself (as object in set is unusual; use object cycle)", () => {
      const s = new Set<unknown>();
      s.add(s);

      expect(() => mapSerializableToDTO(s)).toThrow(
        "Circular structure detected during DTO mapping."
      );
    });
  });
});
