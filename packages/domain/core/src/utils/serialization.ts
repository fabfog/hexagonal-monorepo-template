export const SERIALIZE = Symbol.for("@domain/core/serialize");

export interface ISerializable<TSerialized = unknown> {
  [SERIALIZE](): TSerialized;
}
