import { Inflectors } from "en-inflectors";

const FORM_KEYS = [
    "base",
    "thirdPerson",
    "past",
    "pastParticiple",
    "presentParticiple",
];

function buildInflections(lemma) {
    const inflector = new Inflectors(lemma);
    return {
        base: lemma,
        thirdPerson: inflector.toPresentS(),
        past: inflector.toPast(),
        pastParticiple: inflector.toPastParticiple(),
        presentParticiple: inflector.toGerund(),
    };
}

function applyParticle(forms, particle, lemma) {
    const baseForm = particle ? `${lemma} ${particle}` : lemma;
    const inflected = {};
    for (const key of FORM_KEYS) {
        const value = key === "base" ? baseForm : forms[key];
        if (!value) {
            inflected[key] = value;
            continue;
        }
        if (key === "base" || !particle) {
            inflected[key] = value;
            continue;
        }
        inflected[key] = `${value} ${particle}`;
    }
    return inflected;
}

export function createConjugatedEntry({ lemma, categories, particle = "", overrides = {} }) {
    if (!lemma || typeof lemma !== "string") {
        throw new Error("lemma must be a non-empty string");
    }
    const forms = { ...buildInflections(lemma), ...overrides };
    const inflectedForms = applyParticle(forms, particle.trim(), lemma);
    return {
        base: inflectedForms.base,
        categories,
        forms: inflectedForms,
    };
}

export function createManualEntry({ lemma, categories, particle = "", forms }) {
    if (!forms) {
        throw new Error("forms must be provided for manual entries");
    }
    const normalizedForms = { ...forms };
    for (const key of FORM_KEYS) {
        if (!normalizedForms[key]) {
            throw new Error(`forms.${key} is required for manual entries`);
        }
    }
    const inflectedForms = applyParticle(normalizedForms, particle.trim(), lemma);
    return {
        base: inflectedForms.base,
        categories,
        forms: inflectedForms,
    };
}

export { FORM_KEYS };
