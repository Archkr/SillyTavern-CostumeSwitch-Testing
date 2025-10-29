export const extensionName = "SillyTavern-CostumeSwitch-Testing";
export const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
export const logPrefix = "[CostumeSwitch]";

export const PRESETS = {
    'novel': {
        name: "Novel Style (Recommended)",
        description: "A balanced setting for narrative or story-based roleplay. Excels at detecting speakers from dialogue and actions.",
        settings: {
            detectAttribution: true,
            detectAction: true,
            detectVocative: false,
            detectPossessive: true,
            detectPronoun: true,
            detectGeneral: false,
            enableSceneRoster: true,
            detectionBias: 0,
        },
    },
    'script': {
        name: "Script / Chat Mode",
        description: "A simple, highly accurate mode for chats that use a clear `Name: \"Dialogue\"` format. Disables complex narrative detection.",
        settings: {
            detectAttribution: false,
            detectAction: false,
            detectVocative: false,
            detectPossessive: false,
            detectPronoun: false,
            detectGeneral: false,
            enableSceneRoster: false,
            detectionBias: 100,
        },
    },
    'group': {
        name: "Group Chat / Ensemble Cast",
        description: "Optimized for chaotic scenes with many characters. Uses the Scene Roster to prioritize recently active participants.",
        settings: {
            detectAttribution: true,
            detectAction: true,
            detectVocative: true,
            detectPossessive: true,
            detectPronoun: true,
            detectGeneral: false,
            enableSceneRoster: true,
            detectionBias: -20,
        },
    },
};

export const SCORE_WEIGHT_KEYS = [
    'prioritySpeakerWeight',
    'priorityAttributionWeight',
    'priorityActionWeight',
    'priorityPronounWeight',
    'priorityVocativeWeight',
    'priorityPossessiveWeight',
    'priorityNameWeight',
    'rosterBonus',
    'rosterPriorityDropoff',
    'distancePenaltyWeight',
];

export const SCORE_WEIGHT_LABELS = {
    prioritySpeakerWeight: 'Speaker',
    priorityAttributionWeight: 'Attribution',
    priorityActionWeight: 'Action',
    priorityPronounWeight: 'Pronoun',
    priorityVocativeWeight: 'Vocative',
    priorityPossessiveWeight: 'Possessive',
    priorityNameWeight: 'General Name',
    rosterBonus: 'Roster Bonus',
    rosterPriorityDropoff: 'Roster Drop-off',
    distancePenaltyWeight: 'Distance Penalty',
};

export const DEFAULT_SCORE_PRESETS = {
    'Balanced Baseline': {
        description: 'Matches the default scoring behaviour with a steady roster bonus.',
        builtIn: true,
        weights: {
            prioritySpeakerWeight: 5,
            priorityAttributionWeight: 4,
            priorityActionWeight: 3,
            priorityPronounWeight: 2,
            priorityVocativeWeight: 2,
            priorityPossessiveWeight: 1,
            priorityNameWeight: 0,
            rosterBonus: 150,
            rosterPriorityDropoff: 0.5,
            distancePenaltyWeight: 1,
        },
    },
    'Dialogue Spotlight': {
        description: 'Favors explicit dialogue cues and attribution-heavy scenes.',
        builtIn: true,
        weights: {
            prioritySpeakerWeight: 6,
            priorityAttributionWeight: 5,
            priorityActionWeight: 2.5,
            priorityPronounWeight: 1.5,
            priorityVocativeWeight: 2.5,
            priorityPossessiveWeight: 1,
            priorityNameWeight: 0,
            rosterBonus: 140,
            rosterPriorityDropoff: 0.35,
            distancePenaltyWeight: 1.1,
        },
    },
    'Action Tracker': {
        description: 'Boosts action verbs and keeps recent actors in the roster for fast scenes.',
        builtIn: true,
        weights: {
            prioritySpeakerWeight: 4.5,
            priorityAttributionWeight: 3.5,
            priorityActionWeight: 4,
            priorityPronounWeight: 2.5,
            priorityVocativeWeight: 2,
            priorityPossessiveWeight: 1.5,
            priorityNameWeight: 0.5,
            rosterBonus: 170,
            rosterPriorityDropoff: 0.25,
            distancePenaltyWeight: 0.8,
        },
    },
    'Pronoun Guardian': {
        description: 'Keeps pronoun hand-offs sticky and penalizes distant matches more heavily.',
        builtIn: true,
        weights: {
            prioritySpeakerWeight: 4.5,
            priorityAttributionWeight: 3.5,
            priorityActionWeight: 3,
            priorityPronounWeight: 3.5,
            priorityVocativeWeight: 2,
            priorityPossessiveWeight: 1.2,
            priorityNameWeight: 0,
            rosterBonus: 160,
            rosterPriorityDropoff: 0.4,
            distancePenaltyWeight: 1.4,
        },
    },
};

export const BUILTIN_SCORE_PRESET_KEYS = new Set(Object.keys(DEFAULT_SCORE_PRESETS));

export const DEFAULT_PRONOUNS = ['he', 'she', 'they'];

export const EXTENDED_PRONOUNS = [
    'thee', 'thou', 'thy', 'thine', 'yon', 'ye',
    'xe', 'xem', 'xyr', 'ze', 'zir', 'theyre',
    'ya', "ya'll", "y'all", 'yer', 'yourselves',
    'watashi', 'boku', 'ore', 'anata', 'kanojo', 'kare',
    'zie', 'zir', 'it', 'its', 'someone', 'something',
];

export const EXTENDED_ATTRIBUTION_VERBS = [
    'intoned', 'proclaimed', 'recited', 'declared', 'pronounced',
    'transmitted', 'pinged', 'reported', 'uploaded',
    'muttered', 'rasped', 'drawled', 'grumbled',
    'whispered', 'murmured', 'breathed', 'confessed', 'promised', 'sighed',
    'hissed', 'croaked', 'whimpered', 'moaned',
    'spat', 'barked', 'hollered', 'whooped',
    'shouted', 'pleaded', 'exclaimed', 'yelled',
];

export const EXTENDED_ACTION_VERBS = [
    'brandished', 'summoned', 'conjured', 'smote', 'unsheathed', 'teleported',
    'calibrated', 'recalibrated', 'synced', 'overclocked', 'hacked', 'booted',
    'lurched', 'leaned', 'nursed', 'shadowed', 'tailed', 'poured',
    'caressed', 'embraced', 'kissed', 'lingered', 'blushed', 'cradled',
    'slithered', 'crept', 'stalked', 'screeched', 'shuddered',
    'lassoed', 'saddled', 'spurred', 'tilted', 'spat', 'squared',
    'transformed', 'charged', 'sparked', 'posed', 'radiated',
];

export const COVERAGE_TOKEN_REGEX = /[\p{L}\p{M}']+/gu;

export const UNICODE_WORD_PATTERN = '[\\p{L}\\p{M}\\p{N}_]';
export const WORD_CHAR_REGEX = /[\\p{L}\\p{M}\\p{N}]/u;

export const QUOTE_PAIRS = [
    { open: '"', close: '"', symmetric: true },
    { open: '＂', close: '＂', symmetric: true },
    { open: '“', close: '”' },
    { open: '„', close: '”' },
    { open: '‟', close: '”' },
    { open: '«', close: '»' },
    { open: '‹', close: '›' },
    { open: '「', close: '」' },
    { open: '『', close: '』' },
    { open: '｢', close: '｣' },
    { open: '《', close: '》' },
    { open: '〈', close: '〉' },
    { open: '﹁', close: '﹂' },
    { open: '﹃', close: '﹄' },
    { open: '〝', close: '〞' },
    { open: '‘', close: '’' },
    { open: '‚', close: '’' },
    { open: '‛', close: '’' },
    { open: '\'', close: '\'', symmetric: true, apostropheSensitive: true },
];

export const QUOTE_OPENERS = new Map();
export const QUOTE_CLOSERS = new Map();

for (const pair of QUOTE_PAIRS) {
    const info = {
        close: pair.close,
        symmetric: Boolean(pair.symmetric),
        apostropheSensitive: Boolean(pair.apostropheSensitive),
    };
    QUOTE_OPENERS.set(pair.open, info);
    if (info.symmetric) {
        continue;
    }
    if (!QUOTE_CLOSERS.has(pair.close)) {
        QUOTE_CLOSERS.set(pair.close, []);
    }
    QUOTE_CLOSERS.get(pair.close).push(pair.open);
}

export const PROFILE_DEFAULTS = {
    patterns: [],
    ignorePatterns: [],
    vetoPatterns: ["OOC:", "(OOC)"],
    defaultCostume: "",
    debug: false,
    globalCooldownMs: 1200,
    perTriggerCooldownMs: 250,
    failedTriggerCooldownMs: 10000,
    maxBufferChars: 3000,
    repeatSuppressMs: 800,
    tokenProcessThreshold: 60,
    mappings: [],
    detectAttribution: true,
    detectAction: true,
    detectVocative: true,
    detectPossessive: true,
    detectPronoun: true,
    detectGeneral: false,
    pronounVocabulary: [...DEFAULT_PRONOUNS],
    attributionVerbs: ["acknowledged", "added", "admitted", "advised", "affirmed", "agreed", "announced", "answered", "argued", "asked", "barked", "began", "bellowed", "blurted", "boasted", "bragged", "called", "chirped", "commanded", "commented", "complained", "conceded", "concluded", "confessed", "confirmed", "continued", "countered", "cried", "croaked", "crowed", "declared", "decreed", "demanded", "denied", "drawled", "echoed", "emphasized", "enquired", "enthused", "estimated", "exclaimed", "explained", "gasped", "insisted", "instructed", "interjected", "interrupted", "joked", "lamented", "lied", "maintained", "moaned", "mumbled", "murmured", "mused", "muttered", "nagged", "nodded", "noted", "objected", "offered", "ordered", "perked up", "pleaded", "prayed", "predicted", "proclaimed", "promised", "proposed", "protested", "queried", "questioned", "quipped", "rambled", "reasoned", "reassured", "recited", "rejoined", "remarked", "repeated", "replied", "responded", "retorted", "roared", "said", "scolded", "scoffed", "screamed", "shouted", "sighed", "snapped", "snarled", "spoke", "stammered", "stated", "stuttered", "suggested", "surmised", "tapped", "threatened", "turned", "urged", "vowed", "wailed", "warned", "whimpered", "whispered", "wondered", "yelled"],
    actionVerbs: ["adjust", "adjusted", "appear", "appeared", "approach", "approached", "arrive", "arrived", "blink", "blinked", "bow", "bowed", "charge", "charged", "chase", "chased", "climb", "climbed", "collapse", "collapsed", "crawl", "crawled", "crept", "crouch", "crouched", "dance", "danced", "dart", "darted", "dash", "dashed", "depart", "departed", "dive", "dived", "dodge", "dodged", "drag", "dragged", "drift", "drifted", "drop", "dropped", "emerge", "emerged", "enter", "entered", "exit", "exited", "fall", "fell", "flee", "fled", "flinch", "flinched", "float", "floated", "fly", "flew", "follow", "followed", "freeze", "froze", "frown", "frowned", "gesture", "gestured", "giggle", "giggled", "glance", "glanced", "grab", "grabbed", "grasp", "grasped", "grin", "grinned", "groan", "groaned", "growl", "growled", "grumble", "grumbled", "grunt", "grunted", "hold", "held", "hit", "hop", "hopped", "hurry", "hurried", "jerk", "jerked", "jog", "jogged", "jump", "jumped", "kneel", "knelt", "laugh", "laughed", "lean", "leaned", "leap", "leapt", "left", "limp", "limped", "look", "looked", "lower", "lowered", "lunge", "lunged", "march", "marched", "motion", "motioned", "move", "moved", "nod", "nodded", "observe", "observed", "pace", "paced", "pause", "paused", "point", "pointed", "pop", "popped", "position", "positioned", "pounce", "pounced", "push", "pushed", "race", "raced", "raise", "raised", "reach", "reached", "retreat", "retreated", "rise", "rose", "run", "ran", "rush", "rushed", "sit", "sat", "scramble", "scrambled", "set", "shift", "shifted", "shake", "shook", "shrug", "shrugged", "shudder", "shuddered", "sigh", "sighed", "sip", "sipped", "slip", "slipped", "slump", "slumped", "smile", "smiled", "snort", "snorted", "spin", "spun", "sprint", "sprinted", "stagger", "staggered", "stare", "stared", "step", "stepped", "stand", "stood", "straighten", "straightened", "stumble", "stumbled", "swagger", "swaggered", "swallow", "swallowed", "swap", "swapped", "swing", "swung", "tap", "tapped", "throw", "threw", "tilt", "tilted", "tiptoe", "tiptoed", "take", "took", "toss", "tossed", "trudge", "trudged", "turn", "turned", "twist", "twisted", "vanish", "vanished", "wake", "woke", "walk", "walked", "wander", "wandered", "watch", "watched", "wave", "waved", "wince", "winced", "withdraw", "withdrew"],
    detectionBias: 0,
    enableSceneRoster: true,
    sceneRosterTTL: 5,
    prioritySpeakerWeight: 5,
    priorityAttributionWeight: 4,
    priorityActionWeight: 3,
    priorityPronounWeight: 2,
    priorityVocativeWeight: 2,
    priorityPossessiveWeight: 1,
    priorityNameWeight: 0,
    rosterBonus: 150,
    rosterPriorityDropoff: 0.5,
    distancePenaltyWeight: 1,
};

export const KNOWN_PRONOUNS = new Set([
    ...DEFAULT_PRONOUNS,
    ...EXTENDED_PRONOUNS,
    ...PROFILE_DEFAULTS.pronounVocabulary,
].map(value => String(value).toLowerCase()));

export const KNOWN_ATTRIBUTION_VERBS = new Set([
    ...PROFILE_DEFAULTS.attributionVerbs,
    ...EXTENDED_ATTRIBUTION_VERBS,
].map(value => String(value).toLowerCase()));

export const KNOWN_ACTION_VERBS = new Set([
    ...PROFILE_DEFAULTS.actionVerbs,
    ...EXTENDED_ACTION_VERBS,
].map(value => String(value).toLowerCase()));

export const DEFAULTS = {
    enabled: true,
    profiles: {
        'Default': structuredClone(PROFILE_DEFAULTS),
    },
    activeProfile: 'Default',
    scorePresets: structuredClone(DEFAULT_SCORE_PRESETS),
    activeScorePreset: 'Balanced Baseline',
    focusLock: { character: null },
};

export const MAX_TRACKED_MESSAGES = 24;

export const TAB_STORAGE_KEY = `${extensionName}-active-tab`;

export const PRIORITY_FIELD_MAP = {
    speaker: 'prioritySpeakerWeight',
    attribution: 'priorityAttributionWeight',
    action: 'priorityActionWeight',
    pronoun: 'priorityPronounWeight',
    vocative: 'priorityVocativeWeight',
    possessive: 'priorityPossessiveWeight',
    name: 'priorityNameWeight',
};

export const EMPTY_TOP_CHARACTERS_MESSAGE = 'No character detections available for the last message.';
