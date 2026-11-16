/* Gegenstände und Ziele (offizielle Werte, de-wiki Stand 11/2026; Monsterwerte aus der Tabelle des Wiki-Schadenssimulators).
   Mit "est" markierte Werte sind Schätzungen, weil das Wiki sie (noch) nicht nennt. Alles im Admin-Menü änderbar. */
(function () {
  "use strict";
  const items = [];
  const slug = (s) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const kp3 = (a) => { const o = { 0: a[0], 9: a[1] }; if (a[2] != null) o[15] = a[2]; return o; };

  /* ---------- Waffen ---------- */
  const WCLS = { sword: ["warrior", "ninja", "sura"], ssword: ["sura"], twohand: ["warrior"], dagger: ["ninja"], bow: ["ninja"], bell: ["shaman"], fan: ["shaman"], claw: ["lycan"] };
  // [Name, Level, AW+0, AW+9, AW+15|null, MAW+0|null, MAW+9|null, MAW+15|null, Extras]
  function W(group, rows) {
    rows.forEach((r) => {
      const [name, lvl, a0, a9, a15, m0, m9, m15, ex] = r;
      const it = Object.assign({
        id: "w_" + slug(name), slot: "weapon", name, lvl, cls: WCLS[group], wtype: group === "ssword" ? "sword" : group,
        atk: kp3([a0, a9, a15]), sockets: lvl >= 45 ? 3 : 2,
      }, ex || {});
      if (m0) it.matk = kp3([m0, m9, m15]);
      items.push(it);
    });
  }
  const DF = { innate: ["dssfks"] };                                   // zufälliger DSS/FKS-Wert
  const TRI = { fixed: { devil: { 0: 2, 9: 12 }, human: { 0: 2, 9: 12 } } };
  const R105 = { fixed: { human: { 0: 2, 9: 15 }, monster: { 0: 1, 9: 5 } } };
  const DD = { fixed: { skillDmg: { 0: 1, 9: 5, 15: 15 } } };
  const KY = { fixed: { human: { 0: 4, 9: 20 }, monster: { 0: 2, 9: 8 } } };
  const SERP = { innate: ["serpW1", "serpW2", "serpW3"] };
  const MOON = { innate: ["moonW1", "moonW2", "moonW3"], champ: 6 };

  W("sword", [
    ["Vollmondschwert", 30, [57, 73], [127, 143], null, [62, 88], [132, 158], null, DF],
    ["Nymphenschwert", 65, [102, 138], [192, 228], null, [69, 81], [159, 171], null],
    ["Schlachtschwert", 65, [100, 140], [237, 277], null, [65, 87], [155, 177], null],
    ["Stichschwert", 70, [102, 138], [192, 228], null, [69, 81], [159, 171], null, { fixed: { hp: { 0: 50, 9: 1500 } } }],
    ["Giftschwert", 75, [100, 140], [237, 277], null, null, null, null, DF],
    ["Tritonschwert", 80, [237, 277], [290, 325], null, [155, 177], [208, 230], null, TRI],
    ["Runenschwert", 87, [153, 207], [403, 457], null, [119, 161], [369, 411], null, R105],
    ["Dunkeldrachenschwert", 96, [135, 214], [344, 423], [449, 532], null, null, null, DD],
    ["Zodiakschwert", 105, [149, 211], [349, 411], null, null, null, null, DF],
    ["Schlangenschwert", 120, [175, 295], [448, 569], [588, 709], null, null, null, SERP],
    ["Mondschein-Schwert", 120, [230, 340], [572, 692], [746, 868], null, null, null, MOON],
  ]);
  W("ssword", [
    ["Exorzismusschwert", 65, [98, 142], [188, 232], null, [74, 98], [164, 188], null],
    ["Geisterzahnklinge", 65, [77, 105], [142, 206], null, [90, 110], [227, 247], null],
    ["Dämonenklinge", 70, [77, 105], [95, 157], null, [90, 110], [180, 200], null],
    ["Löwenschwert", 75, [90, 110], [180, 200], null, [77, 105], [95, 157], null, DF],
    ["Schnittklinge", 80, [192, 235], [248, 270], null, [168, 190], [220, 245], null, TRI],
    ["Heiliges Schwert", 80, [145, 210], [210, 250], null, [230, 250], [260, 280], null, TRI],
    ["Drachenzahnklinge", 87, [116, 164], [366, 414], null, [149, 211], [399, 461], null, R105],
    ["Dunkeldrachenschneide", 96, [111, 162], [345, 401], [481, 537], [136, 217], [370, 451], [506, 587], DD],
    ["Zodiakklinge", 105, [116, 164], [366, 414], null, [149, 211], [399, 461], null, DF],
    ["Kyanitschwert", 105, [227, 277], [407, 462], null, [289, 351], [399, 461], null, KY],
    ["Schlangenklinge", 120, [144, 230], [450, 536], [629, 715], [177, 300], [483, 606], [662, 785], SERP],
    ["Mondschein-Klinge", 120, [193, 275], [574, 656], [798, 880], [229, 360], [610, 741], [834, 965], MOON],
  ]);
  W("twohand", [
    ["Roteisenklinge", 30, [72, 109], [142, 179], null, null, null, null, DF],
    ["Magnetische Klinge", 65, [126, 194], [216, 284], null, null, null, null],
    ["Partisane", 65, [136, 184], [273, 321], null, null, null, null],
    ["Halbmenschklinge", 70, [126, 194], [263, 331], null, null, null, null, { fixed: { human: { 0: 2, 9: 15 } } }],
    ["Grollschwert", 75, [136, 184], [226, 274], null, null, null, null, DF],
    ["Sonnenklinge", 87, [230, 311], [417, 498], null, null, null, null, R105],
    ["Dunkeldrachenklinge", 96, [226, 314], [406, 494], [526, 618], null, null, null, DD],
    ["Zodiakglefe", 105, [230, 311], [417, 498], null, null, null, null, DF],
    ["Kyanitklinge", 105, [341, 424], [458, 546], null, null, null, null, KY],
    ["Schlangengroßschwert", 120, [293, 429], [513, 649], [698, 834], null, null, null, SERP],
    ["Mondschein-Glefe", 120, [379, 523], [721, 865], [896, 1040], null, null, null, MOON],
  ]);
  W("dagger", [
    ["Schwarzblattdolch", 30, [40, 44], [83, 87], null, null, null, null, DF],
    ["Blitzmesser", 65, [74, 86], [164, 176], null, null, null, null],
    ["Drachenmesser", 65, [74, 86], [211, 223], null, null, null, null],
    ["Siamesenmesser", 70, [74, 86], [164, 176], null, null, null, null, { fixed: { monster: { 0: 5, 9: 25 } } }],
    ["Teufelsflügel-Chakram", 75, [83, 92], [220, 229], null, null, null, null, DF],
    ["Seelenloses Messer", 80, [225, 235], [275, 300], null, null, null, null, TRI],
    ["Fünf-Elemente-Klinge", 87, [116, 136], [431, 451], null, null, null, null, R105],
    ["Dunkeldrachendolch", 96, [112, 139], [417, 444], [542, 573], null, null, null, DD],
    ["Zodiakdolch", 105, [116, 136], [431, 451], null, null, null, null, DF],
    ["Kyanitdolch", 105, [227, 249], [472, 499], null, null, null, null, { fixed: { human: { 0: 6, 9: 25 }, monster: { 0: 2, 9: 8 } } }],
    ["Schlangendolch", 120, [145, 198], [545, 598], [707, 760], null, null, null, SERP],
    ["Mondschein-Dolch", 120, [189, 231], [673, 715], [870, 912], null, null, null, MOON],
  ]);
  W("bow", [
    ["Hornbogen", 30, [85, 178], [164, 257], null, null, null, null, DF],
    ["Aprikosen-Bogen", 65, [190, 290], [280, 380], null, null, null, null],
    ["Großgelbdrachenbogen", 65, [187, 293], [324, 430], null, null, null, null],
    ["Blaudrachenbogen", 70, [187, 293], [277, 383], null, null, null, null],
    ["Krähenstahlbogen", 75, [190, 290], [280, 380], null, null, null, null, DF],
    ["Großteufelbogen", 80, [325, 431], [410, 470], null, null, null, null, TRI],
    ["Phönixbogen", 87, [237, 436], [487, 686], null, null, null, null, R105],
    ["Dunkeldrachenbogen", 96, [233, 439], [476, 682], [591, 801], null, null, null, DD],
    ["Zodiakbogen", 105, [237, 436], [487, 686], null, null, null, null, DF],
    ["Kyanitbogen", 105, [348, 549], [528, 734], null, null, null, null, KY],
    ["Schlangenbogen", 120, [303, 594], [621, 912], [771, 1062], null, null, null, SERP],
    ["Mondschein-Bogen", 120, [377, 704], [760, 1087], [943, 1270], null, null, null, MOON],
  ]);
  W("bell", [
    ["Antike Glocke", 30, [50, 70], [120, 140], null, [35, 60], [105, 130], null, DF],
    ["Himmel-&-Erde-Glocke", 65, [72, 108], [162, 198], null, [65, 75], [155, 165], null],
    ["Donnervogelglocke", 65, [91, 129], [228, 266], null, [47, 77], [112, 179], null],
    ["Orchideenglocke", 75, [72, 108], [209, 245], null, [70, 80], [207, 217], null, DF],
    ["Drachenmaulglocke", 80, [170, 200], [275, 310], null, [160, 170], [210, 220], null, TRI],
    ["Drachengeist-Glocke", 87, [166, 194], [391, 419], null, [84, 116], [309, 341], null, R105],
    ["Dunkeldrachenglocke", 96, [162, 197], [381, 416], [497, 536], [81, 120], [303, 342], [419, 458], DD],
    ["Zodiakglocke", 105, [166, 194], [391, 419], null, [84, 116], [309, 341], null, DF],
    ["Kyanitglocke", 105, [277, 307], [432, 467], null, [224, 256], [334, 366], null, KY],
    ["Schlangenglocke", 120, [211, 273], [499, 561], [649, 711], [105, 172], [393, 460], [543, 610], SERP],
    ["Mondschein-Glocke", 120, [274, 330], [634, 690], [821, 877], [138, 205], [498, 565], [685, 752], MOON],
  ]);
  W("fan", [
    ["Herbstwindfächer", 30, [43, 55], [113, 125], null, [45, 76], [115, 146], null, DF],
    ["Erlösungsfächer", 65, [69, 91], [159, 181], null, [95, 115], [185, 205], null],
    ["Himmelsvogelfächer", 65, [64, 96], [201, 233], null, [83, 99], [148, 198], null],
    ["Ekstasefächer", 70, [69, 91], [159, 181], null, [95, 115], [185, 205], null],
    ["Dämonenfächer", 80, [165, 185], [225, 235], null, [190, 215], [245, 265], null, TRI],
    ["Drachenfächer", 87, [115, 173], [315, 373], null, [160, 240], [360, 440], null, R105],
    ["Dunkeldrachenfächer", 96, [119, 176], [311, 370], [423, 485], [157, 243], [352, 437], [464, 549], DD],
    ["Zodiakfächer", 105, [115, 173], [315, 373], null, [160, 240], [360, 440], null, DF],
    ["Kyanitfächer", 105, [226, 286], [356, 421], null, [300, 380], [410, 490], null, KY],
    ["Schlangenfächer", 120, [155, 244], [411, 500], [557, 646], [204, 337], [460, 593], [606, 739], SERP],
    ["Mondschein-Fächer", 120, [202, 295], [524, 617], [705, 798], [265, 408], [587, 730], [768, 911], MOON],
  ]);
  W("claw", [
    ["Phönixspieß", 30, [40, 44], [83, 87], null, null, null, null, DF],
    ["Greifenklaue", 65, [72, 108], [137, 173], null, null, null, null],
    ["Habichtskralle", 70, [80, 112], [217, 249], null, null, null, null, DF],
    ["Dornenkralle", 75, [81, 110], [171, 200], null, null, null, null, Object.assign({ fixed: { hp: { 0: 50, 9: 1500 } } }, DF)],
    ["Grüner Wolfsfang", 80, [192, 245], [302, 355], null, null, null, null, TRI],
    ["Drachenherrscher", 87, [122, 165], [372, 415], null, null, null, null, R105],
    ["Dunkeldrachenkralle", 96, [115, 172], [355, 412], [465, 526], null, null, null, DD],
    ["Zodiakklaue", 105, [122, 165], [372, 415], null, null, null, null, DF],
    ["Kyanitkralle", 105, [233, 278], [413, 463], null, null, null, null, KY],
    ["Schlangenkralle", 120, [150, 246], [463, 555], [607, 699], null, null, null, SERP],
    ["Mondschein-Klaue", 120, [195, 285], [580, 675], [760, 860], null, null, null, Object.assign({ est: true }, MOON)],
  ]);

  /* ---------- Rüstungen ---------- */
  const ACLS = ["warrior", "ninja", "sura", "shaman", "lycan"];
  // [Level, DEF+0, DEF+9, DEF+15|null, Extras, Namen je Klasse]
  const ARMORS = [
    [61, 81, 135, null, null, ["Drachengott-Panzer", "Fuchsienanzug", "Seelen-Plattenpanzer", "Kleidung der Baronin", "Firelliumplattenpanzer"]],
    [66, 90, 144, null, { fixed: { resMagic: { 0: 2, 9: 20 } } }, ["Schwarzstahl-Panzer", "Schwarzwindanzug", "Magie-Plattenpanzer", "Schwarze Kleidung", "Nachtschattenpanzer"]],
    [80, 154, 244, null, { fixed: { resMagic: { 0: 20, 9: 20 }, hpRegen: { 0: 2, 9: 40 } } }, ["Blaustahlpanzer", "Blauer Drachenanzug", "Auraplattenpanzer", "Kleidung des Drachen", "Waldläuferpanzer"]],
    [96, 90, 148, 190, { fixed: { resAvg: { 0: 2, 9: 7, 15: 10 }, resMagic: { 0: 4, 9: 15, 15: 25 }, hp: { 0: 1500, 9: 4000, 15: 6000 } } }, ["Dunkeldrachenrüstung", "Winddrachenrüstung", "Magiedrachenrüstung", "Götterdrachenrüstung", "Himmelsdrachenrüstung"]],
    [90, 120, 320, null, { fixed: { hpPct: { 0: 1, 9: 10 }, resMagic: { 0: 4, 9: 25 } } }, ["Teufelshornpanzer", "Drachenreiteranzug", "Knochenplattenpanzer", "Goldene Kleidung", "Feldherrenpanzer"]],
    [105, 90, 144, null, { fixed: { resAvg: { 0: 2, 9: 7 }, resMagic: { 0: 4, 9: 25 }, hp: { 0: 1000, 9: 4000 } } }, ["Zodiakrüstung", "Zodiakanzug", "Zodiakplattenpanzer", "Zodiakkleidung", "Zodiakharnisch"]],
    [105, 140, 340, null, { fixed: { monster: { 0: 2, 9: 10 } } }, ["Polarlichtpanzer", "Anzug des Hinterhalts", "Teufelskrallenpanzer", "Kleidung des Glaubens", "Schattenkämpferpanzer"]],
    [105, 140, 340, null, { fixed: { resMagic: { 0: 6, 9: 30 }, resSkill: { 0: 1, 9: 5 } } }, ["Magmaglutpanzer", "Blutmondanzug", "Höllenrittpanzer", "Kleidung des Feuers", "Achatplattenpanzer"]],
    [110, 204, 440, null, { fixed: { resHuman: { 0: 5, 9: 15 } } }, ["Kyanitrüstung", "Kyanitanzug", "Kyanitplattenpanzer", "Kyanitkleidung", "Kyanitharnisch"]],
    [120, 248, 468, null, { innate: ["rubA2"] }, ["Rubinrüstung", "Rubinanzug", "Rubinplattenpanzer", "Rubinkleidung", "Rubinharnisch"]],
    [120, 268, 488, 678, { innate: ["serpA1", "serpA3"] }, ["Schlangenmantel", "Schlangenwams", "Böser Schlangenmantel", "Rein. Schlangenmantel", "Him. Schlangenmantel"]],
  ];
  ARMORS.forEach((r) => {
    r[5].forEach((name, i) => {
      items.push(Object.assign({ id: "a_" + slug(name), slot: "armor", name, lvl: r[0], cls: [ACLS[i]], def: kp3([r[1], r[2], r[3]]), sockets: 3 }, r[4] || {}));
    });
  });

  /* ---------- Übrige Slots ---------- */
  function S(slot, prefix, rows) {
    rows.forEach((r) => {
      const [name, lvl, def, fixed, ex] = r;
      const it = Object.assign({ id: prefix + slug(name), slot, name, lvl }, ex || {});
      if (def) it.def = def;
      if (fixed) it.fixed = fixed;
      items.push(it);
    });
  }
  S("helmet", "h_", [
    ["Furchtmaske", 60, { 0: 17, 9: 89 }, { block: { 0: 1, 9: 10 } }],
    ["Kriegsmeisterhelm", 80, { 0: 21, 9: 99 }, { dodge: { 0: 1, 9: 12 } }],
    ["Dunkeldrachenhelm", 96, { 0: 25, 9: 105, 15: 125 }, { resAvg: { 0: 1, 9: 3, 15: 10 } }],
    ["Drachenstahlhelm", 100, { 0: 23, 9: 101 }, { avp: { 0: 1, 9: 8 }, magicAtk: { 0: 1, 9: 8 } }],
    ["Dragonierstahlhelm", 100, { 0: 23, 9: 101 }, { resSkill: { 0: 1, 9: 10 } }],
    ["Schlangenhaube", 120, { 0: 27, 9: 121, 15: 233 }, { avp: { 0: 1, 9: 9, 15: 16 }, magicAtk: { 0: 1, 9: 9, 15: 16 } }],
  ]);
  S("shield", "sh_", [
    ["Schwarzer Rundschild", 41, { 0: 7, 9: 97 }, null],
    ["Falkenschild", 61, { 0: 7, 9: 153 }, { resWarrior: { 0: 1, 9: 20 } }],
    ["Tigerschild", 61, { 0: 7, 9: 153 }, { resNinja: { 0: 1, 9: 20 } }],
    ["Löwenkantenschild", 61, { 0: 7, 9: 153 }, { resSura: { 0: 1, 9: 20 } }],
    ["Drachenschuppenschild", 61, { 0: 7, 9: 153 }, { resShaman: { 0: 1, 9: 20 } }],
    ["Dreikaiserschild", 61, { 0: 7, 9: 153 }, { resLycan: { 0: 1, 9: 20 } }],
    ["Titanenschild", 81, { 0: 9, 9: 163 }, { resSkill: { 0: 1, 9: 10 } }],
    ["Verdammnis-Schild", 90, { 0: 14, 9: 215 }, null],
  ]);
  S("shoes", "b_", [
    ["Phönixschuhe", 55, { 0: 5, 9: 5 }, { block: { 0: 1, 9: 10 }, moveSpeed: { 0: 5, 9: 25 } }],
    ["Qilinschuhe", 65, { 0: 5, 9: 10 }, { block: { 0: 11, 9: 20 }, moveSpeed: 25 }],
    ["Glorienstiefel", 65, { 0: 5, 9: 10 }, { dodge: { 0: 11, 9: 20 }, moveSpeed: 25 }],
    ["Euphorieschuhe", 65, { 0: 5, 9: 10 }, { castSpeed: { 0: 11, 9: 20 }, moveSpeed: 25 }],
    ["Eisvogelschuhe", 65, { 0: 16, 9: 30 }, { moveSpeed: 25 }],
    ["Feuerschuhe", 80, { 0: 17, 9: 32 }, { monster: { 0: 2, 9: 10 }, moveSpeed: 25 }],
    ["Ozeanschuhe", 90, { 0: 17, 9: 32 }, { resSkill: { 0: 2, 9: 12 }, moveSpeed: 25 }],
    ["Mondschein-Stiefel", 120, { 0: 25, 9: 47, 15: 93 }, { monster: { 0: 2, 9: 11, 15: 18 } }, { sockets: 3, champ: 1 }],
  ]);
  S("bracelet", "br_", [
    ["Himmelstränenarmband", 54, null, { crit: { 0: 1, 9: 10 }, atkSpeed: { 0: 1, 9: 10 } }],
    ["Seelenkristallarmband", 58, null, { atkSpeed: { 0: 1, 9: 15 } }],
    ["Rubinarmband", 85, null, { resWarrior: { 0: 1, 9: 10 }, atkSpeed: { 0: 1, 9: 15 } }],
    ["Granatarmband", 90, null, { resNinja: { 0: 1, 9: 10 }, atkSpeed: { 0: 1, 9: 15 } }],
    ["Turmalinarmband", 90, null, { resLycan: { 0: 1, 9: 10 }, atkSpeed: { 0: 1, 9: 15 } }],
    ["Smaragdarmband", 95, null, { resSura: { 0: 1, 9: 10 }, atkSpeed: { 0: 1, 9: 15 } }],
    ["Saphirarmband", 100, null, { resShaman: { 0: 1, 9: 10 }, hp: { 0: 25, 9: 1800 }, atkSpeed: { 0: 1, 9: 15 } }],
    ["Rauchjeditarmband", 105, null, { precision: { 0: 2, 9: 12 }, sungma: { 0: 2, 9: 22 } }],
  ]);
  S("earrings", "e_", [
    ["Himmelstränenohrringe", 54, null, { int: { 0: 5, 9: 14 }, crit: { 0: 1, 9: 5 } }],
    ["Seelenkristallohrringe", 62, null, { str: { 0: 5, 9: 14 } }],
    ["Rubinohrringe", 85, null, { int: { 0: 5, 9: 14 }, resSkill: { 0: 1, 9: 5 } }],
    ["Granatohrringe", 90, null, { dex: { 0: 5, 9: 14 }, resAvg: { 0: 1, 9: 5 }, hp: { 0: 25, 9: 1650 } }],
    ["Smaragdohrringe", 95, null, { str: { 0: 5, 9: 14 }, avgDmg: { 0: 1, 9: 5 } }],
    ["Saphirohrringe", 100, null, { vit: { 0: 5, 9: 14 }, skillDmg: { 0: 1, 9: 5 } }],
    ["Rauchjeditohrringe", 105, null, { precision: { 0: 2, 9: 12 }, sungma: { 0: 2, 9: 22 } }],
  ]);
  S("necklace", "n_", [
    ["Himmelstränenhalskette", 54, null, { pierce: { 0: 1, 9: 20 }, castSpeed: { 0: 6, 9: 24 } }],
    ["Seelenkristallkette", 60, null, { castSpeed: { 0: 6, 9: 28 } }],
    ["Rubinhalskette", 85, null, { dex: { 0: 1, 9: 4 }, vsWarrior: { 0: 1, 9: 10 }, castSpeed: { 0: 6, 9: 28 } }],
    ["Granathalskette", 90, null, { vit: { 0: 1, 9: 4 }, vsNinja: { 0: 1, 9: 10 }, castSpeed: { 0: 6, 9: 28 } }],
    ["Turmalinhalskette", 95, null, { int: { 0: 1, 9: 4 }, vsLycan: { 0: 1, 9: 10 }, castSpeed: { 0: 6, 9: 28 } }],
    ["Smaragdhalskette", 95, null, { int: { 0: 1, 9: 4 }, vsSura: { 0: 1, 9: 10 }, castSpeed: { 0: 6, 9: 28 } }],
    ["Saphirhalskette", 100, null, { str: { 0: 1, 9: 4 }, vsShaman: { 0: 1, 9: 10 }, castSpeed: { 0: 6, 9: 28 } }],
    ["Rauchjedithalskette", 105, null, { precision: { 0: 2, 9: 12 }, sungma: { 0: 2, 9: 22 } }],
  ]);
  S("belt", "g_", [
    ["Leinengürtel", 50, null, { hp: { 0: 50, 9: 500 } }],
    ["Seelengürtel", 100, null, { monster: { 0: 1, 9: 5 } }],
    ["Königsgürtel", 103, null, { resWarrior: { 0: 1, 9: 5 } }],
    ["Schattengürtel", 103, null, { resNinja: { 0: 1, 9: 5 } }],
    ["Runengürtel", 103, null, { resSura: { 0: 1, 9: 5 } }],
    ["Großer Bären-Gürtel", 103, null, { resShaman: { 0: 1, 9: 5 } }],
    ["Turmalingürtel", 103, null, { resLycan: { 0: 1, 9: 5 } }],
    ["Titangürtel", 120, { 0: 17, 9: 57 }, null],
  ]);
  S("gloves", "gl_", [
    ["Krafthandschuhe", 105, null, { sungma: { 0: 5, 9: 60 } }, { sockets: 2 }],
    ["Schlangenhandschuhe", 120, { 0: 16, 9: 56 }, { sungma: { 0: 7, 9: 73 } }, { sockets: 2 }],
  ]);
  const TAL = [["Feuertalisman", "elFire"], ["Eistalisman", "elIce"], ["Windtalisman", "elWind"], ["Erdtalisman", "elEarth"], ["Blitztalisman", "elLightning"], ["Dunkler Talisman", "elDark"]];
  TAL.forEach((t) => items.push({ id: "t_" + slug(t[0]), slot: "talisman", name: t[0], lvl: 20, maxUp: 200, fixed: { [t[1]]: { 0: 0, 200: 200 } } }));

  /* ---------- Niedrige und mittlere Level (offizielle Werte) ---------- */
  W("sword", [
    ["Orchideenschwert", 32, [38, 52], [112, 126], null, [36, 46], [110, 120], null],
    ["Anderthalbhänder", 36, [48, 58], [122, 132], null, [52, 68], [126, 142], null],
    ["Barbarenschwert", 40, [52, 68], [126, 142], null, [48, 58], [122, 132], null],
    ["Blutiges Schwert", 45, [65, 87], [130, 152], null, [69, 91], [134, 156], null],
    ["Großschwert", 50, [69, 91], [134, 156], null, [65, 87], [130, 152], null],
    ["Zaubererschwert", 55, [74, 100], [139, 165], null, [72, 108], [137, 173], null],
    ["Halbmondschwert", 60, [72, 108], [137, 173], null, [74, 100], [139, 165], null],
  ]);
  W("twohand", [
    ["Kampfheugabel", 32, [58, 88], [132, 162], null, null, null, null],
    ["Hellebarde", 36, [60, 96], [134, 170], null, null, null, null],
    ["Riesenaxt", 40, [69, 103], [143, 177], null, null, null, null],
    ["Gletscherpicke", 45, [84, 122], [149, 187], null, null, null, null],
    ["Zwölfgeisterschwert", 50, [85, 139], [150, 204], null, null, null, null],
    ["Erlösungsklinge", 55, [86, 154], [151, 219], null, null, null, null],
    ["Löwentöter", 60, [102, 156], [167, 221], null, null, null, null],
  ]);
  W("dagger", [
    ["Glücksmesser", 32, [30, 36], [77, 83], null, null, null, null],
    ["Katzenbissmesser", 36, [33, 37], [80, 84], null, null, null, null],
    ["Teufelsmaskendolch", 40, [36, 40], [83, 87], null, null, null, null],
    ["Teufelsfaustdolch", 45, [47, 51], [85, 89], null, null, null, null],
    ["Blutiger Dolch", 50, [48, 56], [86, 94], null, null, null, null],
    ["Rippenmesser", 55, [49, 59], [87, 97], null, null, null, null],
    ["Chakram", 60, [53, 65], [91, 103], null, null, null, null],
  ]);
  W("bow", [
    ["Kupferverziert. Bogen", 32, [62, 128], [147, 233], null, null, null, null],
    ["Zerstörungsbogen", 36, [64, 150], [147, 233], null, null, null, null],
    ["Rotaugenbogen", 40, [65, 194], [148, 277], null, null, null, null],
    ["Dornblattbogen", 45, [106, 206], [180, 280], null, null, null, null],
    ["Bullenhornbogen", 50, [116, 216], [190, 290], null, null, null, null],
    ["Einhornbogen", 55, [139, 213], [213, 287], null, null, null, null],
    ["Riesenflügelbogen", 60, [135, 251], [209, 325], null, null, null, null],
  ]);
  W("bell", [
    ["Jadeglocke", 32, [29, 39], [103, 113], null, [30, 38], [104, 112], null],
    ["Brunnenglocke", 36, [41, 51], [115, 125], null, [26, 52], [100, 126], null],
    ["Aprikosenglocke", 40, [42, 60], [116, 134], null, [42, 48], [116, 122], null],
    ["Magische Glocke", 50, [59, 89], [124, 154], null, [43, 67], [108, 132], null],
    ["Goldkäferglocke", 55, [68, 90], [133, 155], null, [47, 77], [112, 142], null],
    ["Stahlkäferglocke", 60, [76, 104], [141, 169], null, [65, 75], [130, 140], null],
  ]);
  W("fan", [
    ["Steinfächer", 32, [30, 46], [104, 120], null, [33, 47], [107, 121], null],
    ["Ozeanfächer", 36, [35, 45], [109, 119], null, [30, 62], [104, 136], null],
    ["Stichfächer", 40, [37, 53], [111, 127], null, [42, 60], [116, 134], null],
    ["Phönixfächer", 45, [50, 64], [115, 129], null, [59, 89], [124, 154], null],
    ["Dreifachfächer", 50, [49, 73], [114, 138], null, [68, 90], [133, 155], null],
    ["Brauenfächer", 55, [52, 78], [117, 143], null, [70, 100], [135, 165], null],
    ["Sonnenfächer", 60, [55, 83], [120, 148], null, [83, 97], [148, 162], null],
  ]);
  W("claw", [
    ["Eisenkralle", 45, [57, 73], [100, 116], null, null, null, null],
    ["Stahlkralle", 60, [69, 91], [134, 156], null, null, null, null],
    ["Skarabäuskralle", 65, [74, 100], [139, 165], null, null, null, null],
  ]);
  [
    [26, 38, 92, ["Löwenplattenpanzer", "Roter Ameisenanzug", "Geistplattenpanzer", "Kleidung der Liebe", "Orkanplattenpanzer"]],
    [34, 47, 101, ["Tödl. Plattenpanzer", "Ameisenlöwenanzug", "YinYang-Plattenpanzer", "Kleidung des Himmels", "Malachitplattenpanzer"]],
    [42, 55, 109, ["Drachen-Plattenpanzer", "Ninjaanzug", "Mystikerplattenpanzer", "Sonnenkleidung", "Gewitterplattenpanzer"]],
    [48, 64, 119, ["Schuppenplattenpanzer", "Jungdrachenanzug", "Nebelplattenpanzer", "Kleidung der Moral", "Bronzeplattenpanzer"]],
    [54, 72, 126, ["Gold-Plattenpanzer", "Mörderwindanzug", "Geistermaskenpanzer", "Oranges Katzenkleid", "Koboldsplattenpanzer"]],
  ].forEach((r) => r[3].forEach((name, i) => items.push({ id: "a_" + slug(name), slot: "armor", name, lvl: r[0], cls: [ACLS[i]], def: { 0: r[1], 9: r[2] }, sockets: r[0] >= 45 ? 3 : 2 })));
  S("helmet", "h_", [
    ["Traditioneller Helm", 1, { 0: 5, 9: 41 }, null],
    ["Eisenhelm", 21, { 0: 9, 9: 65 }, null],
    ["Geistermaskenschaller", 41, { 0: 13, 9: 79 }, null],
  ]);
  S("shield", "sh_", [
    ["Schlachtschild", 1, { 0: 3, 9: 57 }, null],
    ["Fünfeckschild", 21, { 0: 5, 9: 74 }, null],
  ]);
  S("shoes", "b_", [
    ["Lederschuhe", 1, { 0: 1, 9: 1 }, { moveSpeed: { 0: 2, 9: 15 } }],
    ["Bambushautschuhe", 9, { 0: 2, 9: 2 }, { resFire: { 0: 1, 9: 10 }, moveSpeed: { 0: 2, 9: 15 } }],
    ["Holzschuhe", 17, { 0: 2, 9: 2 }, { resLightning: { 0: 1, 9: 10 }, moveSpeed: { 0: 2, 9: 15 } }],
    ["Goldverzierte Schuhe", 23, { 0: 2, 9: 2 }, { resWind: { 0: 1, 9: 10 }, moveSpeed: { 0: 2, 9: 15 } }],
    ["Lederstiefel", 29, { 0: 3, 9: 3 }, { resArrow: { 0: 2, 9: 20 }, moveSpeed: { 0: 3, 9: 20 } }],
    ["Goldschuhe", 34, { 0: 4, 9: 4 }, { moveSpeed: { 0: 3, 9: 20 } }],
    ["Bronzeschuhe", 39, { 0: 4, 9: 4 }, { poisonRes: { 0: 1, 9: 10 }, moveSpeed: { 0: 3, 9: 20 } }],
    ["Jadeschuhe", 43, { 0: 4, 9: 4 }, { exp: { 0: 1, 9: 5 }, moveSpeed: { 0: 3, 9: 20 } }],
    ["Ekstaseschuhe", 47, { 0: 5, 9: 5 }, { castSpeed: { 0: 1, 9: 10 }, moveSpeed: { 0: 5, 9: 25 } }],
    ["Nimbus-Stiefel", 51, { 0: 5, 9: 5 }, { dodge: { 0: 1, 9: 10 }, moveSpeed: { 0: 5, 9: 25 } }],
    ["Feuervogelschuhe", 59, { 0: 6, 9: 15 }, { moveSpeed: { 0: 5, 9: 25 } }],
  ]);
  S("bracelet", "br_", [
    ["Holzarmband", 1, null, { atkSpeed: { 0: 1, 9: 5 } }],
    ["Kupferarmband", 8, null, { sp: { 0: 5, 9: 180 }, atkSpeed: { 0: 1, 9: 5 } }],
    ["Silberarmband", 15, null, { hp: { 0: 20, 9: 1200 }, atkSpeed: { 0: 1, 9: 5 } }],
    ["Goldarmband", 22, null, { poisonRes: { 0: 1, 9: 10 }, atkSpeed: { 0: 1, 9: 5 } }],
    ["Jadearmband", 28, null, { atkSpeed: { 0: 1, 9: 7 } }],
    ["Ebenholzarmband", 33, null, { atkSpeed: { 0: 1, 9: 7 } }],
    ["Perlenarmband", 38, null, { sp: { 0: 15, 9: 500 }, atkSpeed: { 0: 1, 9: 7 } }],
    ["Weißgoldarmband", 42, null, { hp: { 0: 25, 9: 1800 }, atkSpeed: { 0: 1, 9: 7 } }],
    ["Kristallarmband", 46, null, { hpRegen: { 0: 8, 9: 56 }, atkSpeed: { 0: 1, 9: 10 } }],
    ["Amethystarmband", 50, null, { spRegen: { 0: 8, 9: 56 }, atkSpeed: { 0: 1, 9: 10 } }],
  ]);
  S("earrings", "e_", [
    ["Holzohrringe", 1, null, { dex: { 0: 1, 9: 10 } }],
    ["Kupferohrringe", 8, null, { str: { 0: 1, 9: 10 } }],
    ["Silberohrringe", 15, null, { vit: { 0: 1, 9: 10 } }],
    ["Goldohrringe", 22, null, { int: { 0: 1, 9: 10 } }],
    ["Jadeohrringe", 28, null, { dex: { 0: 3, 9: 12 }, sp: { 0: 10, 9: 370 } }],
    ["Ebenholzohrringe", 33, null, { str: { 0: 3, 9: 12 }, hp: { 0: 25, 9: 1650 } }],
    ["Perlenohrringe", 38, null, { vit: { 0: 3, 9: 12 }, spRegen: { 0: 4, 9: 28 } }],
    ["Weißgoldohrringe", 42, null, { int: { 0: 3, 9: 12 }, hpRegen: { 0: 4, 9: 28 } }],
    ["Kristallohrringe", 46, null, { dex: { 0: 5, 9: 14 }, def: { 0: 1, 9: 10 } }],
    ["Amethystohrringe", 50, null, { vit: { 0: 5, 9: 14 }, av: { 0: 1, 9: 10 } }],
  ]);
  S("necklace", "n_", [
    ["Holzhalskette", 1, null, { resFire: { 0: 1, 9: 10 }, castSpeed: { 0: 2, 9: 20 } }],
    ["Kupferhalskette", 8, null, { resLightning: { 0: 1, 9: 10 }, castSpeed: { 0: 2, 9: 20 } }],
    ["Silberhalskette", 15, null, { resWind: { 0: 1, 9: 10 }, castSpeed: { 0: 2, 9: 20 } }],
    ["Goldhalskette", 22, null, { resArrow: { 0: 1, 9: 10 }, castSpeed: { 0: 2, 9: 20 } }],
    ["Jadehalskette", 28, null, { dex: { 0: 1, 9: 4 }, castSpeed: { 0: 4, 9: 22 } }],
    ["Ebenholzhalskette", 33, null, { vit: { 0: 1, 9: 4 }, castSpeed: { 0: 4, 9: 22 } }],
    ["Perlenhalskette", 38, null, { int: { 0: 1, 9: 4 }, castSpeed: { 0: 4, 9: 22 } }],
    ["Weißgoldhalskette", 42, null, { str: { 0: 1, 9: 4 }, castSpeed: { 0: 4, 9: 22 } }],
    ["Kristallhalskette", 46, null, { spRegen: { 0: 8, 9: 56 }, castSpeed: { 0: 6, 9: 24 } }],
    ["Amethysthalskette", 50, null, { hpRegen: { 0: 8, 9: 56 }, castSpeed: { 0: 6, 9: 24 } }],
  ]);
  S("belt", "g_", [
    ["Ledergürtel", 70, null, { sp: { 0: 10, 9: 200 } }],
  ]);

  /* ---------- Ziele ---------- */
  const targets = [];
  const WK = ["sword", "twohand", "dagger", "bell", "fan", "arrow", "claw"];
  const wres = (a) => { const o = {}; (Array.isArray(a) ? a : WK.map(() => a)).forEach((v, i) => { if (v) o[WK[i]] = v; }); return o; };
  function stone(name, lvl, def, w, el) {
    const t = { id: "st_" + slug(name), name, kind: "stone", lvl, dex: 0, def, type: "none", wres: wres(w || 0), elem: {}, eres: {}, magicRes: 0, boss: false };
    if (el) { t.elem[el] = 40; t.eres[el] = -10; }
    targets.push(t);
  }
  stone("Metin des Kummers (Lv 5)", 5, 19);
  stone("Metin der Schwärze (Lv 25)", 25, 85);
  stone("Metin des Schattens (Lv 45)", 45, 151);
  stone("Metin des Teufels (Lv 55)", 55, 184);
  stone("Metin des Mordes (Lv 70)", 70, 240);
  stone("Metin Pung-Ma (Lv 75)", 75, 204);
  stone("Metin Ma-An (Lv 80)", 80, 220);
  stone("Metin Tu-Young (Lv 85)", 85, 236);
  stone("Metin Jeon-Un (Lv 90)", 90, 260);
  stone("Metin der Finsternis (Lv 95)", 95, 285);
  stone("Metin der Eitelkeit (Lv 100)", 100, 300);
  stone("Metin des Unglücks (Lv 105)", 105, 315);
  stone("Metin Verwunschener Wald (Lv 120)", 120, 320);
  stone("Element-Metin Feuer (Lv 120)", 120, 320, [25, 15, 25, 25, 25, 25, 20], "fire");
  stone("Element-Metin Eis (Lv 120)", 120, 320, [25, 15, 25, 25, 25, 25, 20], "ice");
  stone("Metin Schlangentempel (Lv 120)", 120, 320, 30);

  // [Name, Lv, Typ, DEX, DEF, Waffenwiderstände, Magiewiderstand, Element, Elementkraft, Elementwiderstand]
  const BOSS = [
    ["Ork-Häuptling", 50, "orc", 32, 170, 0, 0],
    ["Spinnenkönigin", 60, "insect", 58, 167, [40, 35, 40, 40, 40, 40, 35], 60, "wind", 1, -30],
    ["Riesenwüstenschildkröte", 67, "desert", 43, 228, [100, 0, 100, 100, 100, 100, 0], 20, "wind", 1, -30],
    ["Neunschwanz", 72, "none", 68, 199, 0, 0, "ice", 1, -30],
    ["Flammenkönig", 73, "none", 46, 221, [0, 10, 0, 10, 0, -20, 10], 10, "fire", 1, -30],
    ["Gelber Tigergeist", 75, "none", 80, 215, [15, 10, 15, 15, 15, 10, 10], 0, "wind", 1, -30],
    ["Spinnenbaronin", 75, "insect", 91, 226, [40, 35, 40, 40, 40, 40, 35], 60, "wind", 1, -20],
    ["Sensenmann", 78, "undead", 73, 214, [0, 0, 0, -20, -20, 50, 0], 60, "dark", 1, -20],
    ["Eishexe", 89, "none", 73, 224, [60, 60, 40, 40, 40, 60, 60], 40, "ice", 1, -30],
    ["Azrael", 91, "undead", 120, 346, [40, 35, 40, 40, 40, 40, 35], 60, "dark", 1, -20],
    ["Beran-Setaou (Blauer Drache)", 97, "none", 114, 1103, 25, 25, "lightning", 50, -10],
    ["Martyaxwar", 105, "animal", 65, 488, [40, 35, 40, 40, 40, 40, 35], 0, "wind", 1, -20],
    ["Asmodeus", 105, "undead", 120, 360, 10, 80, "dark", 55, -80],
    ["Razador", 108, "none", 66, 497, [40, 35, 40, 40, 40, 40, 35], 0, "fire", 10, -30],
    ["Nemere", 108, "none", 66, 497, [40, 35, 40, 40, 40, 40, 35], 0, "ice", 10, -30],
    ["Hydra", 120, "none", 65, 461, [50, 40, 50, 40, 40, 45, 50], 0, "ice", 50, -10],
    ["Bagjanamu", 120, "devil", 65, 511, [40, 40, 15, 15, 15, 15, 40], 0, "ice", 10, -30],
    ["Akzadur", 120, "none", 132, 345, 40, 0, "fire", 35, -30],
    ["Jotun Thrym", 123, "orc", 66, 512, [40, 40, 20, 20, 20, 20, 40], 0, "earth", 10, -20],
    ["König Bao", 125, "human", 96, 433, [30, 35, 25, 20, 20, 20, 35], 0, "ice", 55, -10],
    ["Argos (Dunkelheit)", 125, "devil", 96, 515, [30, 35, 25, 20, 20, 20, 35], 0, "dark", 60, -10],
    ["Schlangenkönigin Nethis", 129, "none", 64, 457, 45, 0, "earth", 60, -10],
    ["Alastor (leicht)", 135, "none", 100, 465, 55, 0, "ice", 60, -10],
    ["Alastor (schwer)", 135, "none", 100, 465, 57, 0, "lightning", 65, -10],
    ["Balathor", 135, "none", 100, 466, 57, 0, "ice", 65, -5],
    ["Invasoren-Kommandant", 135, "orc", 98, 315, [45, 40, 45, 40, 40, 40, 45], 0],
    ["Zodiak-General", 136, "zodiac", 127, 5336, 80, 30, "fire", 100, -50],
  ];
  BOSS.forEach((b) => {
    const t = { id: "bs_" + slug(b[0]), name: b[0] + " (Lv " + b[1] + ")", kind: "monster", boss: true, lvl: b[1], type: b[2], dex: b[3], def: b[4], wres: wres(b[5]), magicRes: b[6] || 0, elem: {}, eres: {} };
    if (b[7]) { t.elem[b[7]] = b[8]; t.eres[b[7]] = b[9]; }
    targets.push(t);
  });
  // Allgemeine Monster-Schablonen
  [["Halbmensch", "human"], ["Tier", "animal"], ["Ork", "orc"], ["Esoterischer", "mystic"], ["Untoter", "undead"], ["Teufel", "devil"]].forEach((m) => {
    targets.push({ id: "mob_" + m[1], name: "Monster: " + m[0] + " (Lv 100, Schablone)", kind: "monster", boss: false, lvl: 100, type: m[1], dex: 60, def: 280, wres: {}, magicRes: 0, elem: {}, eres: {}, est: true });
  });

  // PvP-Schablonen (Richtwerte, frei anpassbar)
  function player(id, name, o) {
    targets.push(Object.assign({ id, name, kind: "player", cls: "warrior", lvl: 120, dex: 90, bio: true, wres: {}, elem: {}, eres: {}, magicRes: 0, est: true }, o));
  }
  player("pvp_low", "Spieler: schwach ausgerüstet", { def: 600, wres: wres(10), magicRes: 20, res: { human: 10, cls: 0, avg: 0, skill: 0, crit: 0, pierce: 0, block: 5 } });
  player("pvp_mid", "Spieler: solide ausgerüstet", { def: 1100, wres: wres(30), magicRes: 45, res: { human: 30, cls: 15, avg: 15, skill: 15, crit: 5, pierce: 5, block: 15 } });
  player("pvp_high", "Spieler: Top-Ausrüstung", { def: 1700, wres: wres(50), magicRes: 70, res: { human: 50, cls: 30, avg: 30, skill: 30, crit: 15, pierce: 15, block: 25 }, eres: { fire: 30, ice: 30, wind: 30, lightning: 30, earth: 30, dark: 30 } });

  window.M2ITEMS = { items, targets };
})();
