/**
 * Lossless object-graph (de)serialization.
 *
 * The world is one large object graph in which the same object is referenced from many places
 * (a fixture sits in a group table, a round and a bracket at once). A plain JSON.stringify would
 * duplicate those objects and break identity, so the graph is written with explicit references:
 *   - objects referenced more than once go in a shared `nodes` table and are referenced as {"$r": index};
 *     objects referenced once are inlined.
 *   - `undefined` array entries are written as {"$u": 1}.
 * Anything that cannot be represented exactly (functions, Maps, NaN, class instances…) makes
 * saving fail loudly instead of silently dropping data.
 */

type Kind = "array" | "plain";

function classify(value: object, where: string): Kind {
  if (Array.isArray(value)) return "array";
  const proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype || proto === null) return "plain";
  const name = (proto as { constructor?: { name?: string } })?.constructor?.name ?? "unknown";
  throw new Error(`Cannot save a value of type "${name}" (at "${where}").`);
}
// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

export function serializeGraph(root: unknown): { root: unknown; nodes: unknown[] } {
  // Pass 1: count how often each object is reached, and reject unsupported values.
  const counts = new Map<object, number>();

  const visit = (value: unknown, where: string): void => {
    const type = typeof value;
    if (value === null || value === undefined || type === "string" || type === "boolean") return;
    if (type === "number") {
      if (!Number.isFinite(value as number)) throw new Error(`Cannot save non-finite number at "${where}".`);
      return;
    }
    if (type !== "object") throw new Error(`Cannot save a ${type} value (at "${where}").`);

    const object = value as Record<string, unknown>;
    const seen = counts.get(object);
    counts.set(object, (seen ?? 0) + 1);
    if (seen !== undefined) return;

    const kind = classify(object, where);
    if (kind === "array") {
      const array = object as unknown as unknown[];
      for (let i = 0; i < array.length; i++) visit(array[i], where);
    } else {
      for (const key of Object.keys(object)) {
        if (key.startsWith("$")) throw new Error(`Cannot save property "${key}" (at "${where}").`);
        visit(object[key], key);
      }
    }
  };
  visit(root, "world");

  // Pass 2: encode.
  const nodes: unknown[] = [];
  const ids = new Map<object, number>();

  const encode = (value: unknown): unknown => {
    if (value === undefined) return { $u: 1 };
    if (value === null || typeof value !== "object") return value;
    const object = value as object;
    const shared = (counts.get(object) as number) > 1;
    if (!shared) return encodeBody(object);

    let id = ids.get(object);
    if (id === undefined) {
      id = nodes.length;
      ids.set(object, id);
      nodes.push(null); // reserve the slot first so cycles resolve to this id
      nodes[id] = encodeBody(object);
    }
    return { $r: id };
  };

  const encodeBody = (object: object): unknown => {
    if (Array.isArray(object)) {
      const out: unknown[] = new Array(object.length);
      for (let i = 0; i < object.length; i++) out[i] = encode(object[i]);
      return out;
    }
    const record = object as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      const child = record[key];
      if (child === undefined) continue; // absent and undefined are equivalent for objects
      out[key] = encode(child);
    }
    return out;
  };

  return { root: encode(root), nodes };
}

// ---------------------------------------------------------------------------
// Deserialize
// ---------------------------------------------------------------------------

export function deserializeGraph(encodedRoot: unknown, nodes: unknown[]): unknown {
  const resolved: unknown[] = new Array(nodes.length);
  const done: boolean[] = new Array(nodes.length).fill(false);

  const decode = (value: unknown): unknown => {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return decodeArray(value, []);

    const record = value as Record<string, unknown>;
    if ("$u" in record) return undefined;
    if ("$r" in record) return reference(record.$r);
    return decodeObject(record, undefined);
  };

  const decodeArray = (raw: unknown[], target: unknown[]): unknown[] => {
    for (let i = 0; i < raw.length; i++) target[i] = decode(raw[i]);
    return target;
  };

  const decodeObject = (raw: Record<string, unknown>, target: object | undefined): object => {
    let out: Record<string, unknown>;
    if (target) {
      out = target as Record<string, unknown>;
    } else {
      out = {};
    }
    for (const key of Object.keys(raw)) {
      if (key === "$class") throw new Error(`Unknown saved class "${String(raw.$class)}".`);
      out[key] = decode(raw[key]);
    }
    return out;
  };

  const reference = (idValue: unknown): unknown => {
    const id = idValue as number;
    if (!Number.isInteger(id) || id < 0 || id >= nodes.length) throw new Error("Save file contains an invalid reference.");
    if (done[id]) return resolved[id];

    const raw = nodes[id];
    if (Array.isArray(raw)) {
      const target: unknown[] = [];
      resolved[id] = target;
      done[id] = true;
      decodeArray(raw, target);
    } else if (raw && typeof raw === "object") {
      const record = raw as Record<string, unknown>;
      if (record.$class !== undefined) throw new Error(`Unknown saved class "${String(record.$class)}".`);
      const target: object = {};
      resolved[id] = target;
      done[id] = true;
      decodeObject(record, target);
    } else {
      throw new Error("Save file contains a malformed node.");
    }
    return resolved[id];
  };

  return decode(encodedRoot);
}

// ---------------------------------------------------------------------------
// Structural comparison (used to prove a save loses nothing)
// ---------------------------------------------------------------------------

/**
 * Checks that two object graphs are isomorphic: same values, same prototypes, and the
 * same sharing/cycle structure. Returns the path of the first difference, or null.
 */
export function compareGraphs(a: unknown, b: unknown): string | null {
  const forward = new Map<object, object>();
  const backward = new Map<object, object>();

  const compare = (x: unknown, y: unknown, path: string): string | null => {
    if (x === undefined && y === undefined) return null;
    if (x === null || y === null || typeof x !== "object" || typeof y !== "object") {
      return Object.is(x, y) || (x === y) ? null : `${path}: ${String(x)} !== ${String(y)}`;
    }

    const mappedX = forward.get(x);
    const mappedY = backward.get(y);
    if (mappedX !== undefined || mappedY !== undefined) {
      return mappedX === y && mappedY === x ? null : `${path}: shared-reference structure differs`;
    }
    forward.set(x, y);
    backward.set(y, x);

    if (Object.getPrototypeOf(x) !== Object.getPrototypeOf(y)) return `${path}: different types`;

    if (Array.isArray(x)) {
      const arrayY = y as unknown[];
      if (x.length !== arrayY.length) return `${path}: array length ${x.length} !== ${arrayY.length}`;
      for (let i = 0; i < x.length; i++) {
        const diff = compare(x[i], arrayY[i], `${path}[${i}]`);
        if (diff) return diff;
      }
      return null;
    }

    const recordX = x as Record<string, unknown>;
    const recordY = y as Record<string, unknown>;
    const keysX = Object.keys(recordX).filter(key => recordX[key] !== undefined);
    const keysY = Object.keys(recordY).filter(key => recordY[key] !== undefined);
    if (keysX.length !== keysY.length) {
      const missing = keysX.find(key => !(key in recordY)) ?? keysY.find(key => !(key in recordX));
      return `${path}: property sets differ (${missing ?? "count"})`;
    }
    for (const key of keysX) {
      if (recordY[key] === undefined) return `${path}.${key}: missing after load`;
      const diff = compare(recordX[key], recordY[key], `${path}.${key}`);
      if (diff) return diff;
    }
    return null;
  };

  return compare(a, b, "world");
}

