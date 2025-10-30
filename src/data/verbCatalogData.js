import { createRequire } from "module";
import { createConjugatedEntry } from "./verbEntryHelpers.js";

const require = createRequire(import.meta.url);
const baseCatalog = require("./verbCatalog.json");

const ACTION_EXTENDED_ONLY = {
    attribution: {
        default: false,
        extended: false,
    },
    action: {
        default: false,
        extended: true,
    },
};

const ACTION_DEFAULT_AND_EXTENDED = {
    attribution: {
        default: false,
        extended: false,
    },
    action: {
        default: true,
        extended: true,
    },
};

const ATTRIBUTION_EXTENDED_ONLY = {
    attribution: {
        default: false,
        extended: true,
    },
    action: {
        default: false,
        extended: false,
    },
};

const curatedPhrasalVerbs = [
    createConjugatedEntry({
        lemma: "perk",
        particle: "up",
        categories: ACTION_DEFAULT_AND_EXTENDED,
    }),
    createConjugatedEntry({
        lemma: "lash",
        particle: "out",
        categories: ACTION_EXTENDED_ONLY,
    }),
    createConjugatedEntry({
        lemma: "drift",
        particle: "off",
        categories: ACTION_EXTENDED_ONLY,
    }),
    createConjugatedEntry({
        lemma: "double",
        particle: "down",
        categories: ACTION_EXTENDED_ONLY,
    }),
    createConjugatedEntry({
        lemma: "trail",
        particle: "off",
        categories: ATTRIBUTION_EXTENDED_ONLY,
    }),
    createConjugatedEntry({
        lemma: "point",
        particle: "out",
        categories: ATTRIBUTION_EXTENDED_ONLY,
    }),
    createConjugatedEntry({
        lemma: "fall",
        particle: "apart",
        categories: ACTION_EXTENDED_ONLY,
    }),
    createConjugatedEntry({
        lemma: "lie",
        particle: "down",
        categories: ACTION_EXTENDED_ONLY,
        overrides: {
            past: "lay",
            pastParticiple: "lain",
        },
    }),
];

const curatedIrregularVerbs = [
    createConjugatedEntry({
        lemma: "arise",
        categories: ACTION_EXTENDED_ONLY,
    }),
    createConjugatedEntry({
        lemma: "befall",
        categories: ACTION_EXTENDED_ONLY,
    }),
    createConjugatedEntry({
        lemma: "overcome",
        categories: ACTION_EXTENDED_ONLY,
    }),
    createConjugatedEntry({
        lemma: "withstand",
        categories: ACTION_EXTENDED_ONLY,
    }),
];

export default [
    ...baseCatalog,
    ...curatedPhrasalVerbs,
    ...curatedIrregularVerbs,
];
