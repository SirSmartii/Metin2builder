/* Stammdaten: Klassen, Bonus-Typen, Slots, Bonus-Pools, Geiststeine, Formel-Parameter.
   Quelle: offizielles de-/en-Wiki (Stand 11/2026). Im Admin-Menü vollständig überschreibbar. */
(function () {
  "use strict";

  const classes = {
    warrior: { name: "Krieger", icon: "🗡️", branches: { body: "Körper-Kampf", mental: "Mental-Kampf" }, wtypes: ["sword", "twohand"] },
    ninja: { name: "Ninja", icon: "🥷", branches: { blade: "Nahkampf", archery: "Fernkampf" }, wtypes: ["dagger", "sword", "bow"] },
    sura: { name: "Sura", icon: "🔥", branches: { weapon: "Magische Waffen", black: "Schwarze Magie" }, wtypes: ["sword"] },
    shaman: { name: "Schamane", icon: "🔮", branches: { dragon: "Drachenmacht", heal: "Heilung" }, wtypes: ["bell", "fan"] },
    lycan: { name: "Lykaner", icon: "🐺", branches: { instinct: "Instinkt" }, wtypes: ["claw"] },
  };

  // g: off = offensiv, def = defensiv, util = sonstiges; u: Einheit
  const T = (name, g, u) => ({ name, g, u: u == null ? "%" : u });
  const bonusTypes = {
    str: T("Stärke (STR)", "off", ""), dex: T("Beweglichkeit (DEX)", "off", ""), vit: T("Vitalität (VIT)", "def", ""), int: T("Intelligenz (INT)", "off", ""),
    av: T("Angriffswert", "off", ""), avp: T("Angriffswert %", "off"), mav: T("Magischer Angriffswert", "off", ""),
    meleeMagic: T("Magie-/Nahkampfangriff", "off"), magicAtk: T("Magischer Angriff %", "off"),
    sashAV: T("Schulterband: absorbierter Angriffswert", "off", ""), sashMAV: T("Schulterband: absorbierter mag. Angriffswert", "off", ""),
    leadership: T("Führung: Angriffswert", "off", ""),
    monster: T("Stark gegen Monster", "off"), stone: T("Stark gegen Metinsteine", "off"),
    bossDmg: T("Angriffsschaden gegen Bosse", "off"), skillBoss: T("Fertigkeitsschaden gegen Bosse", "off"),
    human: T("Stark gegen Halbmenschen", "off"), animal: T("Stark gegen Tiere", "off"), orc: T("Stark gegen Orks", "off"),
    mystic: T("Stark gegen Esoterische", "off"), undead: T("Stark gegen Untote", "off"), devil: T("Stark gegen Teufel", "off"),
    insect: T("Stark gegen Insekten", "off"), desert: T("Stark gegen Wüstenmonster", "off"), zodiac: T("Stark gegen Zodiakmonster", "off"),
    vsWarrior: T("Stark gegen Krieger", "off"), vsNinja: T("Stark gegen Ninjas", "off"), vsSura: T("Stark gegen Sura", "off"),
    vsShaman: T("Stark gegen Schamanen", "off"), vsLycan: T("Stark gegen Lykaner", "off"),
    elFire: T("Kraft des Feuers", "off"), elIce: T("Kraft des Eises", "off"), elWind: T("Kraft des Windes", "off"),
    elLightning: T("Kraft der Blitze", "off"), elEarth: T("Kraft der Erde", "off"), elDark: T("Kraft der Dunkelheit", "off"),
    avgDmg: T("Durchschnittsschaden", "off"), skillDmg: T("Fertigkeitsschaden", "off"),
    crit: T("Chance auf kritischen Treffer", "off"), pierce: T("Chance auf durchbohrenden Treffer", "off"),
    dmgBonus: T("Schaden (Bonus)", "off"), antiMagic: T("Magiebruch / Anti-Magie", "off"),
    wbreak: T("Bruch der Waffenverteidigung", "off"), blockPen: T("Blockdurchdringung", "off"),
    poison: T("Vergiftungschance", "off"), stun: T("Ohnmachtschance", "off"), slow: T("Verlangsamungschance", "off"),
    atkSpeed: T("Angriffsgeschwindigkeit", "util"), castSpeed: T("Zaubergeschwindigkeit", "util"), moveSpeed: T("Bewegungsgeschwindigkeit", "util"),

    def: T("Verteidigung", "def", ""), defPct: T("Verteidigung %", "def"), hp: T("Max. TP", "def", ""), hpPct: T("Max. TP %", "def"),
    resSword: T("Schwertverteidigung", "def"), resTwohand: T("Zweihandverteidigung", "def"), resDagger: T("Dolchverteidigung", "def"),
    resBell: T("Glockenverteidigung", "def"), resFan: T("Fächerverteidigung", "def"), resArrow: T("Pfeilwiderstand", "def"), resClaw: T("Abwehrchance gegen Krallen", "def"),
    resMagic: T("Magiewiderstand", "def"), resFire: T("Feuerwiderstand", "def"), resIce: T("Eiswiderstand", "def"), resWind: T("Windwiderstand", "def"),
    resLightning: T("Blitzwiderstand", "def"), resEarth: T("Erdwiderstand", "def"), resDark: T("Widerstand gegen Dunkelheit", "def"),
    resHuman: T("Widerstand gegen Halbmenschen", "def"), resMonster: T("Widerstand gegen Monster-Angriffe", "def"),
    resWarrior: T("Abwehr gegen Krieger", "def"), resNinja: T("Abwehr gegen Ninja", "def"), resSura: T("Abwehr gegen Sura", "def"),
    resShaman: T("Abwehr gegen Schamanen", "def"), resLycan: T("Abwehr gegen Lykaner", "def"),
    resAvg: T("Widerstand gegen Durchschnittsschaden", "def"), resSkill: T("Widerstand gegen Fertigkeiten", "def"),
    resCrit: T("Widerstand gegen kritische Treffer", "def"), resPierce: T("Widerstand gegen durchbohrende Treffer", "def"),
    block: T("Chance, Nahkampf-Angriff abzublocken", "def"), dodge: T("Chance, Pfeilangriff auszuweichen", "def"),
    reflect: T("Chance, Nahkampftreffer zu reflektieren", "def"), hpAbsorb: T("Schaden wird von TP absorbiert", "def"),
    spAbsorb: T("Schaden wird von MP absorbiert", "def"), hpRegen: T("TP-Regeneration", "def"), poisonRes: T("Giftwiderstand", "def"),

    sp: T("Max. MP", "util", ""), spRegen: T("MP-Regeneration", "util"), manaSteal: T("Chance auf Manaraub", "util"),
    exp: T("Chance auf EXP-Bonus", "util"), yang: T("Doppelte Menge Yang", "util"), itemDrop: T("Doppelte Menge Gegenstände", "util"),
    precision: T("Präzision", "util", ""), sungma: T("SungMa-Wille", "util", ""),
  };

  /* ---------- Bonus-Pools (Wertstufen) ---------- */
  const R20 = [2, 4, 6, 10, 20], H10 = [1, 2, 3, 5, 10], D15 = [2, 4, 6, 10, 15], C8 = [1, 2, 3, 5, 8], ST = [2, 4, 6, 8, 12];
  const races = () => ({ human: H10, animal: R20, orc: R20, mystic: R20, undead: R20, devil: R20 });
  const wresAll = () => ({ resSword: D15, resTwohand: D15, resDagger: D15, resBell: D15, resFan: D15, resArrow: D15, resClaw: D15 });
  const eres4 = () => ({ resMagic: D15, resLightning: D15, resWind: D15, resFire: D15 });
  const stats = () => ({ str: ST, dex: ST, vit: ST, int: ST });
  const HP = [500, 1000, 1500, 2000], SP = [10, 20, 30, 50, 80], RG = [4, 8, 12, 20, 30], DR = [2, 4, 6, 8, 20];
  const rareCommon = () => ({ av: [10, 20, 30, 40, 50], mav: [10, 20, 30, 40, 50], hp: [100, 200, 300, 400, 500], sp: [20, 40, 60, 80] });
  const K = (a, b, c) => { const o = { 0: a, 9: b }; if (c != null) o[15] = c; return o; };

  const pools = {
    weapon: Object.assign(races(), { pierce: H10, crit: H10, poison: C8, stun: C8, slow: C8, castSpeed: R20 }, stats()),
    armor: Object.assign(wresAll(), eres4(), { hpAbsorb: H10, spAbsorb: H10, hp: HP, sp: SP, reflect: [1, 2, 3, 6, 10], av: [5, 10, 15, 30, 50], castSpeed: R20 }),
    helmet: Object.assign(races(), eres4(), { poison: C8, spAbsorb: H10, hpRegen: RG, spRegen: RG, atkSpeed: C8, dodge: D15 }),
    shield: Object.assign(races(), { reflect: [1, 2, 3, 6, 10], block: [2, 4, 6, 8, 15], exp: DR, yang: DR }, stats()),
    shoes: Object.assign(wresAll(), { crit: H10, stun: C8, slow: C8, hp: HP, sp: SP, exp: DR, atkSpeed: C8, yang: DR, dodge: D15 }),
    bracelet: Object.assign(races(), eres4(), { pierce: H10, hpAbsorb: H10, manaSteal: H10, hp: HP, sp: SP, itemDrop: DR, blockPen: H10 }),
    earrings: Object.assign(races(), wresAll(), { manaSteal: H10, poisonRes: [1, 2, 3, 4, 5], itemDrop: DR, moveSpeed: R20 }),
    necklace: Object.assign(wresAll(), { stun: C8, pierce: H10, crit: H10, spAbsorb: H10, manaSteal: H10, hp: HP, sp: SP, hpRegen: RG, spRegen: RG, exp: DR, yang: DR }),
    talisman: { insect: [10, 15, 20, 30], desert: [10, 15, 20, 30], zodiac: [10, 15, 20, 30], human: [1, 2, 3, 5], wbreak: [1, 2, 3, 4, 5], resIce: [5, 10, 15, 20, 25], resEarth: [5, 10, 15, 20, 25], resDark: [5, 10, 15, 20, 25], resHuman: H10, defPct: [1, 2, 3, 4, 5], stun: C8 },
    gloves: Object.assign({ resHuman: H10, hpAbsorb: H10, spAbsorb: H10, reflect: [1, 2, 3, 6, 10], poisonRes: [1, 2, 3, 4, 5], sp: SP, poison: C8, stun: C8, slow: C8, precision: ST, blockPen: H10 }, stats()),

    r_weapon: Object.assign(rareCommon(), { stone: [3, 4, 5, 6, 7, 8] }),
    r_armor: Object.assign(rareCommon(), { resHuman: [1, 2, 3, 4, 5] }),
    r_common: rareCommon(),
    r_necklace: Object.assign(rareCommon(), { stone: [3, 4, 5, 6, 7, 8], bossDmg: [1, 2, 3, 4, 5], skillBoss: [1, 2, 3, 4, 5] }),
    r_gloves: { bossDmg: [1, 2, 3, 4, 5], skillBoss: [1, 2, 3, 4, 5], stone: [3, 4, 5, 6, 7, 8], sungma: [5, 10, 15] },
    r_talisman: rareCommon(),

    // Eingebaute Zufallsboni (Wert je Verbesserungsstufe, höchste Variante)
    dss: { avgDmg: [10, 20, 30, 40, 50, 60] },
    fks: { skillDmg: [5, 10, 15, 20, 25, 30] },
    serpW1: { avgDmg: K(4, 19, 40), human: K(3, 15, 30), devil: K(3, 15, 30), animal: K(3, 15, 30), undead: K(3, 15, 30), orc: K(3, 15, 30), mystic: K(3, 15, 30) },
    serpW2: { monster: K(2, 13, 25), insect: K(3, 15, 30), zodiac: K(3, 15, 30), atkSpeed: K(16, 26, 45), sungma: K(6, 26, 47) },
    serpW3: { skillDmg: K(4, 19, 40), stone: K(1, 9, 18), desert: K(3, 15, 30), castSpeed: K(3, 15, 30), stun: K(2, 13, 25), slow: K(2, 13, 25), precision: K(2, 13, 25) },
    moonW1: { avgDmg: K(6, 23, 48), human: K(5, 19, 33), devil: K(5, 19, 33), animal: K(5, 19, 33), undead: K(5, 19, 33), orc: K(5, 19, 33), mystic: K(5, 19, 33) },
    moonW2: { monster: K(5, 19, 33), insect: K(5, 19, 33), zodiac: K(5, 19, 33), atkSpeed: K(19, 30, 48), sungma: K(8, 28, 50) },
    moonW3: { skillDmg: K(6, 23, 48), stone: K(5, 19, 33), desert: K(5, 19, 33), castSpeed: K(5, 19, 33), stun: K(5, 19, 33), slow: K(5, 19, 33), precision: K(5, 19, 33) },
    serpA1: { hp: K(1775, 4400, 6500), resSkill: K(1, 9, 18), resAvg: K(1, 9, 18), poisonRes: K(2, 13, 25) },
    serpA3: { resMonster: K(1, 9, 18), monster: K(2, 9, 18), hpAbsorb: K(2, 13, 25), resMagic: K(3, 15, 30), moveSpeed: K(-6, 6, 25) },
    rubA2: { monster: K(1, 7), resMonster: K(1, 7), resMagic: K(1, 11), hpAbsorb: K(1, 11), moveSpeed: K(-10, 5) },

    // Kostüme: gleiche Pools wie der zugehörige Slot
    c_weapon: Object.assign(races(), wresAll(), { hp: HP, sp: SP, castSpeed: R20, atkSpeed: C8, moveSpeed: R20, poison: C8, stun: C8, slow: C8, dodge: D15, pierce: H10, crit: H10, exp: DR, yang: DR }, stats()),

    // Schulterband (max. 25 % einer Waffe) und Aura (max. 25 % von Schmuck/Schild)
    sash: { sashAV: [50, 100, 150, 200, 250], sashMAV: [50, 100, 150, 200, 240], avgDmg: [3, 6, 10, 12, 15], skillDmg: [3, 6, 10, 12], human: [1, 2, 5, 7], animal: [2, 5, 8], orc: [2, 5, 8], mystic: [2, 5, 8], undead: [2, 5, 8], devil: [2, 5, 8], monster: [2, 4, 6, 8], stone: [1, 2, 4, 8], crit: [1, 2], pierce: [1, 2], str: [1, 2, 3], dex: [1, 2, 3], int: [1, 2, 3], elFire: [2, 4, 6], elIce: [2, 4, 6], elWind: [2, 4, 6], elLightning: [2, 4, 6], elEarth: [2, 4, 6], elDark: [2, 4, 6] },
    aura: { crit: [1, 2], pierce: [1, 2, 5], human: [1, 2], animal: [1, 2, 5], orc: [1, 2, 5], mystic: [1, 2, 5], undead: [1, 2, 5], devil: [1, 2, 5], avgDmg: [1], skillDmg: [1], str: [1, 2, 3], dex: [1, 2, 3], int: [1, 2, 3], vit: [1, 2, 3], resSword: [1, 2, 3], resTwohand: [1, 2, 3], resDagger: [1, 2, 3], resBell: [1, 2, 3], resFan: [1, 2, 3], resArrow: [1, 2, 3], resClaw: [1, 2, 3], resMagic: [1, 2, 3], hp: [100, 250, 500], block: [1, 2, 3] },
    pet: { avp: [2, 4, 6, 8, 11, 16], magicAtk: [2, 4, 6, 8, 11, 16], pierce: [3, 5, 8, 10, 13], monster: [3, 5, 8, 12], antiMagic: [3, 5, 8, 10, 14], block: [4, 8, 12, 15], hpPct: [2, 5, 8, 12], defPct: [2, 4, 6, 8], resWarrior: [4, 8, 12, 14], resNinja: [4, 8, 12, 14], resSura: [4, 8, 12, 14], resShaman: [4, 8, 12, 14], resLycan: [4, 8, 12, 14] },
    mount: { monster: [3, 5, 15, 20], stone: [5, 8, 10], av: [30, 100, 200], def: [50, 75, 100, 125, 150], hp: [250, 500, 1500], crit: [10], meleeMagic: [7, 15], defPct: [10] },

    // Drachensteinalchemie: Extra-Boni je Stein (Mythisch, Exzellent, Stufe 6)
    ds_diamant: { skillDmg: [8, 12, 16, 20, 24], resSkill: [8, 12, 16, 20, 24], mav: [8, 12, 16, 20, 24] },
    ds_rubin: { avgDmg: [8, 12, 16, 20, 24], resAvg: [8, 12, 16, 20, 24], def: [80, 160, 240, 320], av: [120, 240, 360, 480] },
    ds_jade: { hp: [1200, 2400, 3600, 4800], hpPct: [8, 16, 24, 32], hpAbsorb: [4, 8, 12, 16], hpRegen: [4, 8, 12, 16] },
    ds_saphir: { vsWarrior: [8, 16, 24], vsNinja: [8, 16, 24], vsSura: [8, 16, 24], vsShaman: [8, 16, 24], vsLycan: [8, 16, 24], resWarrior: [8, 16, 24], resNinja: [8, 16, 24], resSura: [8, 16, 24], resShaman: [8, 16, 24], resLycan: [8, 16, 24] },
    ds_granat: { sp: [600, 1200, 1800, 2400], spRegen: [4, 8, 12, 16], spAbsorb: [4, 8, 12, 16] },
    ds_onyx: { dodge: [4, 8, 12, 16], resCrit: [4, 8, 12, 16], resPierce: [4, 8, 12, 16], reflect: [4, 8, 12, 16], block: [4, 8, 12, 16] },
    ds_amethyst: { stone: [2, 4, 6, 8], sungma: [4, 8, 12, 16] },
  };
  pools.c_armor = pools.armor;
  pools.c_hair = pools.helmet;
  // Freie Zeilen: jeder Bonus mit großzügigem Rahmen
  pools.custom = {};
  Object.keys(bonusTypes).forEach((id) => { pools.custom[id] = bonusTypes[id].u === "" ? [10, 50, 100, 500] : [5, 10, 20, 50]; });

  /* ---------- Slots ---------- */
  const slots = [
    { id: "weapon", name: "Waffe", icon: "⚔️", group: "gear", kind: "item", lines: 5, pool: "weapon", rare: 2, rarePool: "r_weapon", stoneKind: "weapon" },
    { id: "armor", name: "Rüstung", icon: "🥋", group: "gear", kind: "item", lines: 5, pool: "armor", rare: 2, rarePool: "r_armor", stoneKind: "armor" },
    { id: "helmet", name: "Helm", icon: "⛑️", group: "gear", kind: "item", lines: 5, pool: "helmet", rare: 2, rarePool: "r_common" },
    { id: "shield", name: "Schild", icon: "🛡️", group: "gear", kind: "item", lines: 5, pool: "shield", rare: 2, rarePool: "r_common" },
    { id: "shoes", name: "Schuhe", icon: "🥾", group: "gear", kind: "item", lines: 5, pool: "shoes", rare: 2, rarePool: "r_common", stoneKind: "shoes" },
    { id: "bracelet", name: "Armband", icon: "📿", group: "gear", kind: "item", lines: 5, pool: "bracelet", rare: 2, rarePool: "r_common" },
    { id: "earrings", name: "Ohrringe", icon: "💎", group: "gear", kind: "item", lines: 5, pool: "earrings", rare: 2, rarePool: "r_common" },
    { id: "necklace", name: "Halskette", icon: "🧿", group: "gear", kind: "item", lines: 5, pool: "necklace", rare: 2, rarePool: "r_necklace" },
    { id: "gloves", name: "Handschuhe", icon: "🧤", group: "gear", kind: "item", lines: 5, pool: "gloves", rare: 2, rarePool: "r_gloves" },
    { id: "belt", name: "Gürtel", icon: "🎗️", group: "gear", kind: "item", lines: 0 },
    { id: "talisman", name: "Talisman", icon: "🔱", group: "gear", kind: "item", lines: 5, pool: "talisman", rare: 2, rarePool: "r_talisman" },

    { id: "costume", name: "Kostüm", icon: "👘", group: "extra", kind: "bonus", lines: 3, pool: "c_armor" },
    { id: "hair", name: "Frisur", icon: "💇", group: "extra", kind: "bonus", lines: 3, pool: "c_hair" },
    { id: "wskin", name: "Waffenskin", icon: "✨", group: "extra", kind: "bonus", lines: 3, pool: "c_weapon" },
    { id: "sash", name: "Schulterband", icon: "🎀", group: "extra", kind: "bonus", lines: 8, pool: "sash", note: "Bis zu 25 % der absorbierten Waffe (Grundwerte und Boni)." },
    { id: "aura", name: "Aura", icon: "🌟", group: "extra", kind: "bonus", lines: 6, pool: "aura", note: "Bis zu 25 % von Armband, Halskette, Ohrringen oder Schild." },
    { id: "pet", name: "Pet", icon: "🐉", group: "extra", kind: "bonus", lines: 4, pool: "pet", note: "Pet-Fertigkeiten (Berserker gibt Angriffswert % und mag. Angriff %)." },
    { id: "mount", name: "Reittier", icon: "🐎", group: "extra", kind: "bonus", lines: 2, pool: "mount" },

    { id: "ds_diamant", name: "Drachendiamant", icon: "💠", group: "alchemy", kind: "bonus", lines: 3, pool: "ds_diamant", base: { int: 16, resIce: 16, elIce: 16 } },
    { id: "ds_rubin", name: "Drachenrubin", icon: "🔴", group: "alchemy", kind: "bonus", lines: 3, pool: "ds_rubin", base: { str: 16, resFire: 16, elFire: 16 } },
    { id: "ds_jade", name: "Drachenjade", icon: "🟢", group: "alchemy", kind: "bonus", lines: 3, pool: "ds_jade", base: { sp: 800, resWind: 16, elWind: 16 } },
    { id: "ds_saphir", name: "Drachensaphir", icon: "🔵", group: "alchemy", kind: "bonus", lines: 3, pool: "ds_saphir", base: { dex: 16, resEarth: 16, elEarth: 16 } },
    { id: "ds_granat", name: "Drachengranat", icon: "🟠", group: "alchemy", kind: "bonus", lines: 3, pool: "ds_granat", base: { hp: 2400, resLightning: 16, elLightning: 16 } },
    { id: "ds_onyx", name: "Drachenonyx", icon: "⚫", group: "alchemy", kind: "bonus", lines: 3, pool: "ds_onyx", base: { vit: 16, resDark: 16, elDark: 16 } },
    { id: "ds_amethyst", name: "Drachenamethyst", icon: "🟣", group: "alchemy", kind: "bonus", lines: 2, pool: "ds_amethyst", base: { devil: 16, precision: 16, sungma: 16 } },

    { id: "custom", name: "Eigene Boni", icon: "➕", group: "extra", kind: "bonus", lines: 10, pool: "custom", free: true, note: "Freie Zeilen für alles, was dein Server zusätzlich hat (Runen, Sets, Titel …)." },
  ];

  /* ---------- Schalter: Biologe, Buffs, Verbrauchsgüter ---------- */
  const toggles = [
    { id: "bio60", group: "Biologe", name: "Biologe Lv 60: Angriffswert +50", b: { av: 50 } },
    { id: "bio50", group: "Biologe", name: "Biologe Lv 50: Verteidigung +60", b: { def: 60 } },
    { id: "bio80", group: "Biologe", name: "Biologe Lv 80: Gesamtschaden +10 % (nicht Magie)", b: { avp: 10 } },
    { id: "bio70", group: "Biologe", name: "Biologe Lv 70: Schadensreduzierung 10 %", b: { resAvg: 10 } },
    { id: "bio90", group: "Biologe", name: "Biologe Lv 90: +8 % Schaden gegen Spieler", b: { human: 8 } },
    { id: "bio85", group: "Biologe", name: "Biologe Lv 85: 10 % Abwehr gegen Spieler", b: { resHuman: 10 } },
    { id: "bio92a", group: "Biologe", name: "Seon-Pyeong 1: Angriffswert +51", b: { av: 51 } },
    { id: "bio92b", group: "Biologe", name: "Seon-Pyeong 1: Trefferpunkte +1.000", b: { hp: 1000 } },
    { id: "bio94a", group: "Biologe", name: "Seon-Pyeong 2: Angriffswert +60", b: { av: 60 } },
    { id: "bio94b", group: "Biologe", name: "Seon-Pyeong 2: Trefferpunkte +1.100", b: { hp: 1100 } },
    { id: "ds_set", group: "Alchemie", name: "Mythischer Setbonus (6 Steine)", b: { str: 3, dex: 3, int: 3, vit: 3, avgDmg: 5, skillDmg: 5, av: 90, def: 60, mav: 5, elFire: 3, elIce: 3, elWind: 3, elEarth: 3, elLightning: 3, elDark: 3 } },
    { id: "tau_red", group: "Tau & Wasser", name: "Roter Tau: krit. Treffer +20 %", b: { crit: 20 } },
    { id: "tau_orange", group: "Tau & Wasser", name: "Oranger Tau: durchb. Treffer +20 %", b: { pierce: 20 } },
    { id: "tau_blue", group: "Tau & Wasser", name: "Blauer Tau: Angriffswert +120", b: { av: 120 } },
    { id: "tau_white", group: "Tau & Wasser", name: "Weißer Tau: Verteidigung +200", b: { def: 200 } },
    { id: "w_dok", group: "Tau & Wasser", name: "Dok-Wasser: krit. Treffer +10 %", b: { crit: 10 } },
    { id: "w_sim", group: "Tau & Wasser", name: "Sim-Wasser: durchb. Treffer +10 %", b: { pierce: 10 } },
    { id: "w_zin", group: "Tau & Wasser", name: "Zin-Wasser: Angriffswert +50", b: { av: 50 } },
    { id: "dg_atk", group: "Buffs", name: "Drachengott-Angriff: Magie-/Nahkampfangriff +20 %", b: { meleeMagic: 20 } },
    { id: "segen_macht", group: "Buffs", name: "Segen der Macht: Fertigkeitsschaden +40 %, Metinsteine +10 %", b: { skillDmg: 40, stone: 10 } },
    { id: "ring", group: "Buffs", name: "Ring der Willenskraft: Stark gegen Monster +30 %", b: { monster: 30, hpPct: 10 } },
    { id: "tiger", group: "Buffs", name: "Tigerknochenohrring: Angriffswert +200", b: { av: 200 } },
    { id: "fish", group: "Buffs", name: "Aal + Rotfeder: STR +10, DEX +10", b: { str: 10, dex: 10 } },
    { id: "el_fire", group: "Elixiere", name: "Flammenkraft-Elixier: Kraft des Feuers +20 %", b: { elFire: 20 } },
    { id: "el_ice", group: "Elixiere", name: "Frostkraft-Elixier: Kraft des Eises +20 %", b: { elIce: 20 } },
    { id: "el_light", group: "Elixiere", name: "Donnerkraft-Elixier: Kraft der Blitze +20 %", b: { elLightning: 20 } },
    { id: "el_wind", group: "Elixiere", name: "Nordwindkraft-Elixier: Kraft des Windes +20 %", b: { elWind: 20 } },
    { id: "el_earth", group: "Elixiere", name: "Erdkraft-Elixier: Kraft der Erde +20 %", b: { elEarth: 20 } },
    { id: "el_dark", group: "Elixiere", name: "Finsterkraft-Elixier: Kraft der Dunkelheit +20 %", b: { elDark: 20 } },
  ];

  /* ---------- Geiststeine (+0 … +4) ---------- */
  const stones = [
    { id: "s_monster", name: "Stein der Monster", kind: "weapon", bonus: "monster", values: [1, 2, 3, 5, 8] },
    { id: "s_monster_g", name: "Groß. St. d. Monster", kind: "weapon", bonus: "monster", values: [12], excl: "s_monster" },
    { id: "s_pierce", name: "Stein des Durchbruchs", kind: "weapon", bonus: "pierce", values: [1, 2, 3, 5, 8] },
    { id: "s_crit", name: "Stein des Todesstoß", kind: "weapon", bonus: "crit", values: [1, 2, 3, 5, 8] },
    { id: "s_cast", name: "Stein der Wiederkehr", kind: "weapon", bonus: "castSpeed", values: [5, 8, 12, 17, 25] },
    { id: "s_vsWarrior", name: "Stein gegen Krieger", kind: "weapon", bonus: "vsWarrior", values: [5, 8, 12, 17, 25] },
    { id: "s_vsNinja", name: "Stein gegen Ninja", kind: "weapon", bonus: "vsNinja", values: [5, 8, 12, 17, 25] },
    { id: "s_vsSura", name: "Stein gegen Sura", kind: "weapon", bonus: "vsSura", values: [5, 8, 12, 17, 25] },
    { id: "s_vsShaman", name: "Stein gegen Schamanen", kind: "weapon", bonus: "vsShaman", values: [5, 8, 12, 17, 25] },
    { id: "s_vsLycan", name: "Stein gegen Lykaner", kind: "weapon", bonus: "vsLycan", values: [5, 8, 12, 17, 25] },
    { id: "s_anti", name: "Magiebruch-Stein", kind: "weapon", bonus: "antiMagic", values: [5, 8, 12, 17, 25] },
    { id: "s_hp", name: "Stein der Lebenskraft", kind: "armor", bonus: "hp", values: [50, 100, 150, 200, 300] },
    { id: "s_def", name: "Stein des Schutzes", kind: "armor", bonus: "def", values: [2, 4, 6, 10, 15] },
    { id: "s_haste", name: "Stein der Hast", kind: "armor", bonus: "moveSpeed", values: [5, 10, 15, 20, 30] },
    { id: "s_block", name: "Stein des Ausweichens", kind: "armor", bonus: "block", values: [1, 2, 3, 5, 8] },
    { id: "s_dodge", name: "Stein des Duckens", kind: "armor", bonus: "dodge", values: [1, 2, 3, 5, 8] },
    { id: "s_sp", name: "Stein der Magie", kind: "armor", bonus: "sp", values: [30, 60, 90, 120, 150] },
    { id: "s_moon", name: "Stein des Mondes", kind: "shoes", bonus: "atkSpeed", values: [1, 2, 3, 5, 8] },
    { id: "s_poisonres", name: "Stein des Gifts", kind: "shoes", bonus: "poisonRes", values: [1, 2, 3, 5, 8] },
    { id: "s_exp", name: "Stein der Erfahrung", kind: "shoes", bonus: "exp", values: [1, 3, 6, 9, 15] },
    { id: "s_el_fire", name: "Stein der Elemente (Feuer)", kind: "shoes", bonus: "elFire", values: [1, 2, 3, 5, 8], fam: "el" },
    { id: "s_el_ice", name: "Stein der Elemente (Eis)", kind: "shoes", bonus: "elIce", values: [1, 2, 3, 5, 8], fam: "el" },
    { id: "s_el_wind", name: "Stein der Elemente (Wind)", kind: "shoes", bonus: "elWind", values: [1, 2, 3, 5, 8], fam: "el" },
    { id: "s_el_light", name: "Stein der Elemente (Blitz)", kind: "shoes", bonus: "elLightning", values: [1, 2, 3, 5, 8], fam: "el" },
    { id: "s_el_earth", name: "Stein der Elemente (Erde)", kind: "shoes", bonus: "elEarth", values: [1, 2, 3, 5, 8], fam: "el" },
    { id: "s_el_dark", name: "Stein der Elemente (Dunkelheit)", kind: "shoes", bonus: "elDark", values: [1, 2, 3, 5, 8], fam: "el" },
  ];

  const params = {
    elemMatch: 50,          // Element trifft Monster desselben Elements: (Kraft − Widerstand) × 0,5 %
    elemOff: 5,             // Element ohne passendes Monster: Kraft × 0,05 %
    dmgBonusCapPct: 20,     // Schaden (Bonus): höchstens 20 %
    dmgBonusCapFlat: 300,   // … und höchstens +300 Schaden
    finalMult: 1,           // frei: Server-Multiplikator auf den Endschaden
    skillPowerMult: 1,      // frei: Multiplikator auf die Fertigkeitskraft
    defPerVit: 1,           // eigene Verteidigung je VIT (Schätzung)
    maxStat: 90,
    classes: {
      warrior: { hpBase: 600, hpPerLv: 40, hpPerVit: 40 }, ninja: { hpBase: 650, hpPerLv: 20, hpPerVit: 40 },
      sura: { hpBase: 650, hpPerLv: 22, hpPerVit: 40 }, shaman: { hpBase: 700, hpPerLv: 20, hpPerVit: 30 },
      lycan: { hpBase: 600, hpPerLv: 40, hpPerVit: 40 },
    },
  };

  window.M2DEFAULTS = function () {
    const it = window.M2ITEMS;
    return JSON.parse(JSON.stringify({ version: 1, classes, bonusTypes, pools, slots, toggles, stones, params, items: it.items, targets: it.targets }));
  };
})();
