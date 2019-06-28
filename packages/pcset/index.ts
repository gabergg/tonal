import { compact, range, rotate } from "@tonaljs/array";
import {
  Interval,
  interval,
  IntervalName,
  note,
  Note,
  NoteName,
  NoTonal,
  Tonal
} from "@tonaljs/tonal";

/**
 * The properties of a pitch class set
 * @param {number} num - a number between 1 and 4095 (both included) that
 * uniquely identifies the set. It's the decimal number of the chrom.
 * @param {string} chroma - a string representation of the set: a 12-char string
 * with either "1" or "0" as characters, representing a pitch class or not
 * for the given position in the octave. For example, a "1" at index 0 means 'C',
 * a "1" at index 2 means 'D', and so on...
 * @param {string} normalized - the chroma but shifted to the first 1
 * @param {number} length - the number of notes of the pitch class set
 * @param {IntervalName[]} intervals - the intervals of the pitch class set
 * *starting from C*
 */
export interface Pcset extends Tonal {
  readonly num: number;
  readonly chroma: PcsetChroma;
  readonly normalized: PcsetChroma;
  readonly length: number;
}

export const EmptyPcset: Pcset = {
  empty: true,
  name: "",
  num: 0,
  chroma: "000000000000",
  normalized: "000000000000",
  length: 0
};

export type PcsetChroma = string;
export type PcsetNum = number;

/**
 * A definition of a pitch class set. It could be:
 * - The pitch class set chroma (a 12-length string with only 1s or 0s)
 * - The pitch class set number (an integer between 1 and 4095)
 * - An array of note names
 * - An array of interval names
 */
export type Set = Pcset | PcsetChroma | PcsetNum | NoteName[] | IntervalName[];

function toChroma(set: any[]): PcsetChroma {
  if (set.length === 0) {
    return EmptyPcset.chroma;
  }

  let pitch: Note | Interval | NoTonal;
  const binary = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < set.length; i++) {
    pitch = note(set[i]);
    // tslint:disable-next-line: curly
    if (pitch.empty) pitch = interval(set[i]);
    // tslint:disable-next-line: curly
    if (!pitch.empty) binary[pitch.chroma] = 1;
  }
  return binary.join("");
}

const REGEX = /^[01]{12}$/;
/**
 * Test if the given string is a pitch class set chroma.
 * @param {string} chroma - the pitch class set chroma
 * @return {boolean} true if its a valnum pcset chroma
 * @example
 * Pcset.isChroma("101010101010") // => true
 * Pcset.isChroma("101001") // => false
 */
export function isChroma(set: any): set is PcsetChroma {
  return REGEX.test(set);
}

const isPcsetNum = (set: any): set is PcsetNum =>
  typeof set === "number" && set >= 0 && set <= 4095;

const isPcset = (set: any): set is Pcset => set && isChroma(set.chroma);

const cache: { [key in string]: Pcset } = { [EmptyPcset.chroma]: EmptyPcset };

export function pcset(src: Set): Pcset {
  const chroma: PcsetChroma = isChroma(src)
    ? src
    : isPcsetNum(src)
    ? Number(src).toString(2)
    : Array.isArray(src)
    ? toChroma(src)
    : isPcset(src)
    ? src.chroma
    : EmptyPcset.chroma;

  return (cache[chroma] = cache[chroma] || properties(chroma));
}

export function pcsetProp(key: keyof Pcset) {
  return (src: Set) => {
    const s = pcset(src);
    return s ? s[key] : null;
  };
}

const normalize = (chroma: PcsetChroma): PcsetChroma => {
  const first = chroma.indexOf("1");
  return chroma.slice(first, 12) + chroma.slice(0, first);
};

function properties(chroma: PcsetChroma): Pcset {
  const num = parseInt(chroma, 2);
  const normalized = normalize(chroma);

  const pcs = chroma.split("");
  let length = 0;
  for (let i = 0; i < 12; i++) {
    // tslint:disable-next-line: curly
    if (chroma.charAt(i) === "1") length++;
  }
  return { empty: false, name: "", num, chroma, normalized, length };
}

const IVLS = "1P 2m 2M 3m 3M 4P 5d 5P 6m 6M 7m 7M".split(" ");
/**
 * Get the intervals of a pcset *starting from C*
 * @param {Set} set - the pitch class set
 * @return {IntervalName[]} an array of interval names or an empty array
 * if not a valid pitch class set
 */
export function intervals(src: Set): IntervalName[] {
  const intervals: IntervalName[] = [];
  const set = pcset(src);

  const chroma = set.chroma;
  for (let i = 0; i < 12; i++) {
    // tslint:disable-next-line:curly
    if (chroma.charAt(i) === "1") intervals.push(IVLS[i]);
  }
  return intervals;
}

let all: PcsetChroma[];

/**
 * Get a list of all possible pitch class sets (all possible chromas) *having
 * C as root*. There are 2048 different chromas. If you want them with another
 * note you have to transpose it
 *
 * @see http://allthescales.org/
 * @return {Array<PcsetChroma>} an array of possible chromas from '10000000000' to '11111111111'
 */
export function chromaList(): PcsetChroma[] {
  all = all || range(2048, 4095).map(n => n.toString(2));
  return all.slice();
}

/**
 * @deprecated
 * @use chromaList
 * @example
 * chromaList().filter(chroma => pcset(chroma).length === 5)
 */
export const chromas = (num?: number) =>
  num === undefined
    ? chromaList()
    : chromaList().filter(chroma => pcset(chroma).length === num);

/**
 * Given a a list of notes or a pcset chroma, produce the rotations
 * of the chroma discarding the ones that starts with "0"
 *
 * This is used, for example, to get all the modes of a scale.
 *
 * @param {Array|string} set - the list of notes or pitchChr of the set
 * @param {boolean} normalize - (Optional, true by default) remove all
 * the rotations that starts with "0"
 * @return {Array<string>} an array with all the modes of the chroma
 *
 * @example
 * Pcset.modes(["C", "D", "E"]).map(Pcset.intervals)
 */
export function modes(set: Set, normalize = true): PcsetChroma[] {
  const pcs = pcset(set);

  const binary = pcs.chroma.split("");
  return compact(
    binary.map((_, i) => {
      const r = rotate(i, binary);
      return normalize && r[0] === "0" ? null : r.join("");
    })
  );
}

const num = (set: Set): number => {
  const s = pcset(set);
  return s ? s.num : NaN;
};
/**
 * Test if two pitch class sets are numentical
 *
 * @param {Array|string} set1 - one of the pitch class sets
 * @param {Array|string} set2 - the other pitch class set
 * @return {boolean} true if they are equal
 * @example
 * Pcset.isEqual(["c2", "d3"], ["c5", "d2"]) // => true
 */
export function isEqual(s1: Set, s2: Set) {
  return num(s1) === num(s2);
}

/**
 * Create a function that test if a collection of notes is a
 * subset of a given set
 *
 * The function is curryfied.
 *
 * @param {PcsetChroma|NoteName[]} set - the superset to test against (chroma or
 * list of notes)
 * @return{function(PcsetChroma|NoteNames[]): boolean} a function accepting a set
 * to test against (chroma or list of notes)
 * @example
 * const inCMajor = Pcset.isSubsetOf(["C", "E", "G"])
 * inCMajor(["e6", "c4"]) // => true
 * inCMajor(["e6", "c4", "d3"]) // => false
 */
export function isSubsetOf(set: Set) {
  const s = pcset(set).num;

  return (notes: Set | Pcset) => {
    const o = pcset(notes).num;
    // tslint:disable-next-line: no-bitwise
    return s !== o && (o & s) === o;
  };
}

/**
 * Create a function that test if a collection of notes is a
 * superset of a given set (it contains all notes and at least one more)
 *
 * @param {Set} set - an array of notes or a chroma set string to test against
 * @return {(subset: Set): boolean} a function that given a set
 * returns true if is a subset of the first one
 * @example
 * const extendsCMajor = Pcset.isSupersetOf(["C", "E", "G"])
 * extendsCMajor(["e6", "a", "c4", "g2"]) // => true
 * extendsCMajor(["c6", "e4", "g3"]) // => false
 */
export function isSupersetOf(set: Set) {
  const s = pcset(set).num;
  return (notes: Set) => {
    const o = pcset(notes).num;
    // tslint:disable-next-line: no-bitwise
    return s !== o && (o | s) === o;
  };
}

/**
 * Test if a given pitch class set includes a note
 *
 * @param {Array<string>} set - the base set to test against
 * @param {string} note - the note to test
 * @return {boolean} true if the note is included in the pcset
 *
 * Can be partially applied
 *
 * @example
 * const isNoteInCMajor = isNoteIncludedInSet(['C', 'E', 'G'])
 * isNoteInCMajor('C4') // => true
 * isNoteInCMajor('C#4') // => false
 */
export function isNoteIncludedInSet(set: Set) {
  const s = pcset(set);

  return (noteName: NoteName): boolean => {
    const n = note(noteName);
    return s && !n.empty && s.chroma.charAt(n.chroma) === "1";
  };
}

/** @deprecated use: isNoteIncludedIn */
export const includes = isNoteIncludedInSet;

/**
 * Filter a list with a pitch class set
 *
 * @param {Array|string} set - the pitch class set notes
 * @param {Array|string} notes - the note list to be filtered
 * @return {Array} the filtered notes
 *
 * @example
 * Pcset.filter(["C", "D", "E"], ["c2", "c#2", "d2", "c3", "c#3", "d3"]) // => [ "c2", "d2", "c3", "d3" ])
 * Pcset.filter(["C2"], ["c2", "c#2", "d2", "c3", "c#3", "d3"]) // => [ "c2", "c3" ])
 */
export function filter(set: Set) {
  const isIncluded = isNoteIncludedInSet(set);
  return (notes: NoteName[]) => {
    return notes.filter(isIncluded);
  };
}

/**
 * @deprecated
 * @use pcset
 * @example
 * pcset(['C', 'D', 'E']).chroma
 */
export function chroma(set: Set | Pcset): PcsetChroma | null {
  const s = pcset(set);
  return s ? s.chroma : null;
}