import type { Locale } from "../config";
import { en } from "./en";
import { fr } from "./fr";
import { pt } from "./pt";

export type { Dictionary } from "./en";

export const DICTIONARIES = { en, fr, pt } satisfies Record<Locale, unknown>;
