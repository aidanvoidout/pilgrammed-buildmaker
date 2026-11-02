let itemData = {};
let reforgeData = {};
let skillsData = {};
let savedBuilds = [];
let selections = {};
let skillLevels = {};

let currentCategory = "";
let currentItem = "";
let currentReforge = "";
let currentGem = "";
let currentBuildName = "";

let selectedItemButton = null;
let loadedBuildName = "";

let currentSortKey = "name";
let currentSortDir = "asc";

let activeSkillTab = "";
let extraWeaponCount = 1;

const MAX_POINTS = 50;
const DEBUG_SORT = false;

const GLOVE_POOL = new Set([
  "Cloud Glove", "Combo Glove", "Copper Gauntlet", "Cruel Caestus",
  "Freezeflame Gauntlet", "Iron Fist", "Martial Kata", "Power Glove",
  "Pushy Glove", "Scrounger Gloves", "Wooden Caestus"
]);
const BULLET_POOL = new Set([
  "Demetal Bullets", "Piercing Bullets", "Pistol Pop Pellets",
  "Shock Bullets", "Silver Bullets", "Venom Bullets"
]);
const ACCESSORY_GROUPS = [
  { label: "Fist Accessories", max: 2, items: GLOVE_POOL },
  { label: "bullet-type accessories", max: 3, items: BULLET_POOL }
];

const stat_label_texts = {
  str: "Strength", dex: "Dexterity", agi: "Agility", int: "Intellect", def: "Defense",
  MaxHealth: "Max Health", MaxMana: "Max Mana", MaxSpeed: "Max Speed",
  FallDamage: "Fall Damage", DetectionRisk: "Detection Risk", ManaCost: "Mana Cost",
  CritChance: "Crit Chance", SummonCount: "Summon Count", JumpPower: "Jump Power",
  DoubleJumpHeight: "Double Jump Height", SwingSpeed: "Swing Speed",
  swingspeed: "Swing Speed", manacost: "Mana Cost", critchance: "Crit Chance",
  heavycooldown: "Heavy Cooldown", maxrange: "Max Range", minrange: "Min Range"
};

const STAT_DEFAULTS = {
  str: 0, dex: 0, agi: 0, int: 0, def: 0,
  MaxHealth: 500, MaxMana: 180, Gravity: 100,
  Jumps: 0, FallDamage: 100, DetectionRisk: 100,
  Regeneration: 100, ManaCost: 100,
  MaxSpeed: 0, CritChance: 0, SummonCount: 0,
  JumpPower: 0, Breathing: 0, DoubleJumpHeight: 0
};

const STAT_TYPE_CLASS = {
  str: "strength", dex: "dexterity", agi: "agility", int: "intellect", def: "defense"
};

const tooltipEl = document.getElementById("tooltip");

function statLabel(key) {
  return stat_label_texts[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

function showTooltip(x, y, itemObj) {
  const d = itemObj.data;
  let html = `<h4 class="itemname">${itemObj.name}</h4>`;
  if (d.desc) html += `<p class="desc">${d.desc}</p>`;
  for (const [key, val] of Object.entries(d)) {
    if (key == "rarity" || key == "desc" || key == "abilities" || key == "mutualexclusive") continue;
    const cls = STAT_TYPE_CLASS[key] || "";
    html += `<p class="stat ${cls}">${statLabel(key)}: ${val}</p>`;
  }
  if (d.abilities) {
    const abs = Array.isArray(d.abilities) ? d.abilities : [d.abilities];
    html += `<div class="abilities">${abs.map(a => `<p class="ability">★ ${a}</p>`).join("")}</div>`;
  }
  if (itemObj.gem) {
    html += `<p class="ability ${gemClassName(itemObj.gem)}">◆ ${itemObj.gem}: ${reforgeData.gems[itemObj.gem]}</p>`;
  }
  if (itemObj.note) {
    html += `<p class="blocked-reason">${itemObj.note}</p>`;
  }
  tooltipEl.innerHTML = html;
  tooltipEl.style.display = "block";
  positionTooltip(x, y);
}

function positionTooltip(x, y) {
  tooltipEl.style.left = (x + 10) + "px";
  tooltipEl.style.top = (y + 10) + "px";
}

function getCategories() {
  const weapons = Array.from({ length: extraWeaponCount }, (_, i) => i == 0 ? "weapon" : `weapon${i + 1}`);
  return [
    "helmet", "armour",
    "accessory1", "accessory2", "accessory3", "accessory4", "accessory5",
    ...weapons, "technique"
  ];
}

function fixCategory(categoryId) {
  if (categoryId === "armour") return "armour";
  if (categoryId.startsWith("accessory")) return "accessory";
  if (categoryId.startsWith("weapon")) return "weapon";
  return categoryId;
}

function reforgeKeyFor(catId, itemName) {
  const realCat = fixCategory(catId);
  if (realCat == "weapon") {
    const cls = itemData.weapon?.[itemName]?.class;
    if (cls == "Mage") return "magicweapon";
    if (cls == "Summoner") return "summonerweapon";
    if (cls == "Ranged") return "rangedweapon";
    return "weapon";
  }
  if (realCat == "accessory") return "accessories";
  if (realCat == "armour" || realCat == "helmet") return "armour";
  return realCat;
}

function getStackLimit(categoryId, itemName) {
  const realCat = fixCategory(categoryId);
  if (realCat !== "accessory" && realCat !== "weapon") return Infinity;
  return itemData[realCat][itemName].stacks || 1;
}

function getAbilities(cat) {
  const sel = selections[cat];
  if (!sel?.item) return [];
  const ab = itemData[fixCategory(cat)][sel.item].abilities;
  if (!ab) return [];
  return Array.isArray(ab) ? ab : [ab];
}

function slotLabel(catId) {
  if (catId == "helmet") return "Helmet";
  if (catId == "armour") return "Armour";
  if (catId == "technique") return "Technique";
  if (catId.startsWith("accessory")) return `Accessory ${catId.slice("accessory".length)}`;
  if (catId.startsWith("weapon")) {
    const index = catId == "weapon" ? 0 : parseInt(catId.slice("weapon".length), 10) - 1;
    return `Weapon ${index + 1}`;
  }
  return catId;
}

function gemClassName(gemName) {
  return gemName.toLowerCase().replace(/\s+/g, "");
}

function getReforgeStats(cat, itemName, reforgeName) {
  if (!reforgeName) return {};
  const refData = reforgeData[reforgeKeyFor(cat, itemName)]?.[reforgeName];
  if (!refData) return {};

  const tierKeys = Object.keys(refData);
  if (!tierKeys.every(k => !isNaN(k))) return refData;

  const rarity = itemData[fixCategory(cat)][itemName].rarity ?? 1;
  return refData[rarity] || {};
}

function getDisplayRarity(cat) {
  const sel = selections[cat];
  if (!sel?.item) return null;
  const item = itemData[fixCategory(cat)][sel.item];

  const base = item.rarity ?? 1;
  if (!sel.reforge) return base;
  if (reforgeKeyFor(cat, sel.item) == "summonerweapon") return base;

  const shift = sel.reforge == "Wonderful" ? 2 : sel.reforge == "Doodoo" ? -1 : 1;
  return base + shift;
}

function computeStats() {
  const base = { ...STAT_DEFAULTS };

  for (const cat in selections) {
    const s = selections[cat];
    if (!s?.item) continue;
    const item = itemData[fixCategory(cat)][s.item];

    for (const stat in base) {
      if (item[stat]) base[stat] += item[stat];
    }
    for (const [stat, val] of Object.entries(getReforgeStats(cat, s.item, s.reforge))) {
      if (stat in base) base[stat] += val;
    }
  }

  const tank = skillLevels["Tank"] || 0;
  base.MaxHealth += tank >= 2 ? 75 : tank >= 1 ? 25 : 0;
  if ((skillLevels["Vexation"] || 0) >= 1) {
    base.MaxHealth = Math.round(base.MaxHealth * 0.5);
  }
  base.MaxMana += base.int;

  return base;
}

function getTotalSkillPoints() {
  let total = 0;
  for (const category in skillsData) {
    for (const skillName in skillsData[category]) {
      const skill = skillsData[category][skillName];
      const level = skillLevels[skillName] || 0;
      if (level === 1) total += skill.cost;
      else if (level === 2) total += skill.cost + (skill.acedcost ?? skill.cost * 2);
    }
  }
  return total;
}

const SAVE_VERSION = 2;
const V2_FIXED_SLOTS = [
  "helmet", "armour",
  "accessory1", "accessory2", "accessory3", "accessory4", "accessory5",
  "technique"
];
const BUILD_DECODERS = { 1: decodeBuildV1, 2: decodeBuildV2 };
let saveIds = {};

// function b64Encode(str) {
//   return btoa(unescape(encodeURIComponent(str)));
// }
// function b64Decode(str) {
//   return decodeURIComponent(escape(atob(str)));
// }
// function b64Encode(str) {
//   const bytes = new TextEncoder().encode(str);
//   return btoa(String.fromCharCode(...bytes));
// }
// function b64Decode(str) {
//   const bytes = Uint8Array.from(atob(str), c => c.charCodeAt(0));
//   return new TextDecoder().decode(bytes);
// }

// function b64UrlEncode(str) {
//   return b64Encode(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
// }
// function b64UrlDecode(str) {
//   const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
//   return b64Decode(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
// }
//
// function parseBuild(raw) {
//   return decodeBuildV1(raw);
// }
//
// function copyBuildURL() {
//   const encoded = b64UrlEncode(serializeBuild());
//   const url = window.location.origin + window.location.pathname + "?build=" + encoded;
//   navigator.clipboard.writeText(url);
// }
//
// function saveBuild() {
//   if (!currentBuildName) {
//     alert("Enter a build name!");
//     return;
//   }
//   const all = readSavedBuilds();
//   if (Object.hasOwn(all, currentBuildName) && currentBuildName !== loadedBuildName) {
//     if (!confirm(`A build named "${currentBuildName}" is already saved. Overwrite it?`)) return;
//   }
//   all[currentBuildName] = b64Encode(serializeBuild());
//   localStorage.setItem("pilgrammed", JSON.stringify(all));
//   localStorage.setItem("pilgrammed-build-name", currentBuildName);
//   loadedBuildName = currentBuildName;
//   refreshBuildList();
// }
//
// function loadBuild(name = null) {
//   const all = readSavedBuilds();
//   if (!name) name = localStorage.getItem("pilgrammed-build-name");
//   if (!name || !all[name]) return;
//
//   const raw = b64Decode(all[name]);
//   if (!loadBuildString(raw)) {
//     alert(`Couldn't load build "${name}"`);
//     return;
//   }
//   loadedBuildName = name;
//   validateBuild();
//   autosave();
// }
//
// function autosave() {
//   localStorage.setItem("pilgrammed-working", b64Encode(serializeBuild()));
// }

function syncWeaponSlots() {
  let count = 1;
  for (const catId in selections) {
    if (!catId.startsWith("weapon") || !selections[catId]?.item) continue;
    const index = catId == "weapon" ? 0 : parseInt(catId.slice("weapon".length), 10) - 1;
    count = Math.max(count, index + 2);
  }
  extraWeaponCount = count;
}

function encodeId(list, name) {
  const i = list.indexOf(name);
  return i >= 0 ? i.toString(36) : "=" + encodeURIComponent(name);
}

function decodeId(list, tok) {
  if (!tok) return null;
  if (tok.startsWith("=")) return decodeURIComponent(tok.slice(1));
  return list[parseInt(tok, 36)];
}

function serializeBuild() {
  const weaponSlots = getCategories().filter(c => c.startsWith("weapon"));
  const slotTokens = [...V2_FIXED_SLOTS, ...weaponSlots].map(catId => {
    const sel = selections[catId];
    if (!sel?.item) return "";
    const parts = [encodeId(saveIds.items[fixCategory(catId)], sel.item)];
    if (sel.reforge) parts.push(encodeId(saveIds.reforges, sel.reforge));
    else if (sel.gem) parts.push("");
    if (sel.gem) parts.push(encodeId(saveIds.gems, sel.gem));
    return parts.join(":");
  });
  while (slotTokens.length && slotTokens.at(-1) === "") slotTokens.pop();

  const skillTokens = [];
  for (const [name, lvl] of Object.entries(skillLevels)) {
    if (lvl > 0) skillTokens.push(`${encodeId(saveIds.skills, name)}:${lvl}`);
  }

  const safeName = encodeURIComponent(currentBuildName || "");
  return `v${SAVE_VERSION}|${slotTokens.join(",")}|${skillTokens.join(",")}|${safeName}`;
}

function decodeBuildV2(body) {
  const [slotPart = "", skillPart = "", namePart = ""] = body.split("|");
  const slots = {};

  slotPart.split(",").forEach((tok, i) => {
    if (!tok) return;
    const wi = i - V2_FIXED_SLOTS.length;
    const catId = i < V2_FIXED_SLOTS.length
      ? V2_FIXED_SLOTS[i]
      : wi == 0 ? "weapon" : `weapon${wi + 1}`;

    const [itemT, refT, gemT] = tok.split(":");
    const fixedCat = fixCategory(catId);
    slots[catId] = {
      item: decodeId(saveIds.items[fixedCat], itemT),
      reforge: decodeId(saveIds.reforges, refT),
      gem: decodeId(saveIds.gems, gemT)
    };
  });

  const skills = {};
  for (const tok of skillPart.split(",").filter(Boolean)) {
    const [idT, lvlT] = tok.split(":");
    const name = decodeId(saveIds.skills, idT);
    skills[name] = parseInt(lvlT, 10);
  }

  return { name: decodeURIComponent(namePart), slots, skills };
}

function decodeBuildV1(compact) {
  const v1 = saveIds.v1;
  const fromToken = tok => parseInt(tok, 36);

  const [equipPart, skillPart, namePart] = compact.split("|");

  const slots = {};
  equipPart.split(",").forEach((tok, i) => {
    const catId = v1.slots[i];
    if (!catId) return;
    const [itemT, refT, gemT] = tok.split(":");
    const realCat = fixCategory(catId);
    const item = saveIds.items[realCat][fromToken(itemT)];

    let reforgeGroup = realCat;
    if (realCat === "weapon" && v1.weaponReforgeGroups[item]) {
      reforgeGroup = v1.weaponReforgeGroups[item];
    }
    slots[catId] = {
      item,
      reforge: v1.reforges[reforgeGroup]?.[fromToken(refT) - 1],
      gem: saveIds.gems[fromToken(gemT)]
    };
  });

  const skills = {};
  for (const tok of skillPart.split(",").filter(Boolean)) {
    const [idxT, lvlT] = tok.split("~");
    const name = saveIds.skills[fromToken(idxT)];
    skills[name] = parseInt(lvlT, 10);
  }

  return { name: namePart ? decodeURIComponent(namePart) : "", slots, skills };
}

function parseBuild(raw) {
  let version = 1;
  let payload = raw;
  const tagged = /^v(\d+)\|/.exec(raw);
  if (tagged) {
    version = parseInt(tagged[1], 10);
    payload = raw.slice(tagged[0].length);
  }
  return BUILD_DECODERS[version](payload);
}

function applyBuild(build) {
  selections = {};
  for (const [catId, sel] of Object.entries(build.slots)) {
    selections[catId] = {
      item: sel.item,
      reforge: sel.reforge ?? null,
      gem: sel.gem ?? null
    };
  }
  syncWeaponSlots();

  skillLevels = {};
  for (const [name, lvl] of Object.entries(build.skills)) {
    skillLevels[name] = lvl;
  }

  if (build.name) {
    currentBuildName = build.name;
    document.getElementById("build-name-input").value = currentBuildName;
    localStorage.setItem("pilgrammed-build-name", currentBuildName);
  }
}

function loadBuildString(raw) {
  applyBuild(parseBuild(raw));
  return true;
}

function copyBuildURL() {
  const compressed = LZString.compressToBase64(serializeBuild());
  const url = window.location.origin + window.location.pathname + "?build=" + encodeURIComponent(compressed);
  navigator.clipboard.writeText(url);
}

function readSavedBuilds() {
  return JSON.parse(localStorage.getItem("pilgrammed") || "{}");
}
function saveBuild() {
  if (!currentBuildName) {
    alert("Enter a build name!");
    return;
  }
  const all = readSavedBuilds();
  if (Object.hasOwn(all, currentBuildName) && currentBuildName !== loadedBuildName) {
    if (!confirm(`A build named "${currentBuildName}" is already saved. Overwrite it?`)) return;
  }
  all[currentBuildName] = LZString.compressToBase64(serializeBuild());
  localStorage.setItem("pilgrammed", JSON.stringify(all));
  localStorage.setItem("pilgrammed-build-name", currentBuildName);
  loadedBuildName = currentBuildName;
  refreshBuildList();
}

function deleteBuild(name) {
  const all = readSavedBuilds();
  if (!all[name]) return;
  if (!confirm(`Delete build "${name}"?`)) return;
  delete all[name];
  localStorage.setItem("pilgrammed", JSON.stringify(all));
  if (currentBuildName === name) {
    currentBuildName = "";
    document.getElementById("build-name-input").value = "";
    localStorage.removeItem("pilgrammed-build-name");
  }
  refreshBuildList();
}

function loadBuild(name = null) {
  const all = readSavedBuilds();
  if (!name) name = localStorage.getItem("pilgrammed-build-name");
  if (!name || !all[name]) return;

  loadBuildString(LZString.decompressFromBase64(all[name]));
  loadedBuildName = name;
  autosave();
}

function autosave() {
  localStorage.setItem("pilgrammed-working", LZString.compressToBase64(serializeBuild()));
}

function refreshBuildList() {
  savedBuilds = Object.keys(readSavedBuilds()).sort();
}

function clearBuild() {
  if (!confirm("Clear all equipped items and skills for this build?")) return;

  selections = {};
  skillLevels = {};
  extraWeaponCount = 1;

  const url = new URL(window.location.href);
  if (url.searchParams.has("build")) {
    url.searchParams.delete("build");
    history.replaceState(null, "", url.toString());
  }

  autosave();
  render_all();
}

function getEquipBlockReason(categoryId, itemName) {
  const limit = getStackLimit(categoryId, itemName);
  const realCat = fixCategory(categoryId);
  const dups = getCategories().filter(other =>
    other !== categoryId &&
    fixCategory(other) == realCat &&
    selections[other]?.item == itemName
  );

  if (dups.length >= limit) {
    return limit == 1
      ? `Already equipped in ${slotLabel(dups[0])}.`
      : `Only ${limit} can be equipped at once.`;
  }

  if (!categoryId.startsWith("accessory")) return null;

  const others = getCategories()
    .filter(c => c !== categoryId && c.startsWith("accessory"))
    .map(c => selections[c]?.item)
    .filter(Boolean);

  for (const group of ACCESSORY_GROUPS) {
    if (!group.items.has(itemName)) continue;
    const count = others.filter(o => group.items.has(o)).length;
    if (count >= group.max) return `Only ${group.max} ${group.label} can be equipped at once.`;
  }

  const exclusives = itemData[fixCategory(categoryId)]?.[itemName]?.mutualexclusive || [];
  for (const other of others) {
    const otherExclusives = itemData[fixCategory(categoryId)]?.[other]?.mutualexclusive || [];
    if (exclusives.includes(other) || otherExclusives.includes(itemName)) {
      return `Mutually exclusive with ${other}.`;
    }
  }

  return null;
}

function openItemSelector(categoryId) {
  currentCategory = categoryId;
  const prev = selections[categoryId] || {};
  currentItem = prev.item || "";
  currentReforge = prev.reforge || "";
  currentGem = prev.gem || "";

  document.getElementById("items-popup-title").textContent = `Select ${slotLabel(categoryId)}`;

  currentSortKey = "rarity";
  currentSortDir = "asc";

  const items = itemData[fixCategory(categoryId)] || {};

  const sortSel = document.getElementById("item-sort-select");
  sortSel.innerHTML = "";
  const nameOpt = document.createElement("option");
  nameOpt.value = "name";
  nameOpt.textContent = "Name";
  sortSel.appendChild(nameOpt);

  const sortKeys = new Set();
  for (const item of Object.values(items)) {
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "number") sortKeys.add(k);
    }
  }
  const fields = [...sortKeys].sort((a, b) =>
    a === "rarity" ? -1 : b === "rarity" ? 1 : a.localeCompare(b)
  );
  for (const key of fields) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = statLabel(key);
    sortSel.appendChild(o);
  }
  if (currentSortKey !== "name" && !fields.includes(currentSortKey)) currentSortKey = "name";
  sortSel.value = currentSortKey;

  document.getElementById("item-sort-dir-btn").textContent = "↑ Asc";
  document.getElementById("item-search").value = "";
  renderitems(items, "");
  renderEquipBar();
  document.getElementById("items-overlay").style.display = "flex";
}

function closeItemsPopup() {
  document.getElementById("items-overlay").style.display = "none";
  tooltipEl.style.display = "none";
}

function fillSelect(selectId, names, current) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = `<option value="">None</option>`;
  for (const name of names) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    sel.appendChild(o);
  }
  sel.value = current;
}

function renderReforgeDescription() {
  const desc = document.getElementById("reforge-desc");
  if (!currentReforge || !currentItem) {
    desc.textContent = "";
    return;
  }
  const stats = getReforgeStats(currentCategory, currentItem, currentReforge);
  const isWeapon = currentCategory.startsWith("weapon");
  const parts = Object.entries(stats).map(([key, val]) => {
    let amount = val > 0 ? `+${val}` : String(val);
    if (isWeapon || key === "Regeneration" || key === "FallDamage") amount += "%";
    return `${amount} ${statLabel(key)}`;
  });
  desc.textContent = `${currentReforge}: ${parts.length ? parts.join(", ") : "no stat changes"}`;
}

function renderGemDescription() {
  const desc = document.getElementById("gem-desc");
  desc.className = "gem-desc";
  desc.textContent = "";
  if (currentGem && currentItem && currentCategory.startsWith("weapon")) {
    desc.classList.add(gemClassName(currentGem));
    desc.textContent = `${currentGem}: ${reforgeData.gems[currentGem]}`;
  }
}

function renderEquipBar() {
  const isWeapon = currentCategory.startsWith("weapon");
  const reforges = currentItem ? Object.keys(reforgeData[reforgeKeyFor(currentCategory, currentItem)] || {}) : [];
  if (!reforges.includes(currentReforge)) currentReforge = "";

  const nameEl = document.getElementById("equip-item-name");
  nameEl.className = "";
  if (currentItem) {
    nameEl.textContent = currentItem;
    nameEl.classList.add(`rarity-${itemData[fixCategory(currentCategory)][currentItem].rarity || 1}`);
  } else {
    nameEl.textContent = "Pick an item below";
    nameEl.classList.add("inactive");
  }

  document.getElementById("reforge-field").style.display = reforges.length ? "" : "none";
  fillSelect("reforge-select", reforges, currentReforge);
  renderReforgeDescription();

  document.getElementById("gem-field").style.display = (isWeapon && currentItem) ? "" : "none";
  fillSelect("gem-select", Object.keys(reforgeData.gems || {}), currentGem);
  renderGemDescription();

  document.getElementById("equip-btn").disabled = !currentItem;
}

function selectItem(name, btn) {
  if (getEquipBlockReason(currentCategory, name)) return false;
  currentItem = name;
  if (selectedItemButton) selectedItemButton.classList.remove("selected");
  btn.classList.add("selected");
  selectedItemButton = btn;
  renderEquipBar();
  return true;
}

function confirmSelection() {
  if (!currentItem) return;
  if (getEquipBlockReason(currentCategory, currentItem)) return;

  selections[currentCategory] = {
    item: currentItem,
    reforge: currentReforge || null,
    gem: (currentGem && currentCategory.startsWith("weapon")) ? currentGem : null
  };

  closeItemsPopup();
  syncWeaponSlots();
  autosave();
  render_all();
}

function renderitems(items, searchTerm) {
  const grid = document.getElementById("item-grid");
  grid.innerHTML = "";
  selectedItemButton = null;

  const term = searchTerm.trim().toLowerCase();
  const entries = Object.entries(items).filter(([name]) => name.toLowerCase().includes(term));

  entries.sort(([nameA, a], [nameB, b]) => {
    let cmp;
    if (currentSortKey === "name") {
      cmp = nameA.localeCompare(nameB);
    } else {
      cmp = a[currentSortKey] - b[currentSortKey];
    }
    return currentSortDir === "asc" ? cmp : -cmp;
  });

  if (DEBUG_SORT) console.log("items:", entries.length, "sort:", currentSortKey, currentSortDir);

  if (!term && selections[currentCategory]?.item) {
    const noneBtn = document.createElement("button");
    noneBtn.textContent = "None";
    noneBtn.className = "unequip";
    noneBtn.addEventListener("click", () => {
      delete selections[currentCategory];
      closeItemsPopup();
      syncWeaponSlots();
      autosave();
      render_all();
    });
    grid.appendChild(noneBtn);
  }

  for (const [name, data] of entries) {
    const btn = document.createElement("button");
    btn.textContent = name;
    btn.className = `rarity-${data.rarity || 1}`;
    if (name == currentItem) {
      btn.classList.add("selected");
      selectedItemButton = btn;
    }
    const blockReason = getEquipBlockReason(currentCategory, name);
    if (blockReason) btn.classList.add("blocked");

    btn.addEventListener("click", () => selectItem(name, btn));
    btn.addEventListener("dblclick", () => { if (selectItem(name, btn)) confirmSelection(); });
    btn.addEventListener("mouseenter", e => showTooltip(e.clientX, e.clientY, { name, data, note: blockReason }));
    btn.addEventListener("mousemove", e => positionTooltip(e.clientX, e.clientY));
    btn.addEventListener("mouseleave", () => { tooltipEl.style.display = "none"; });
    grid.appendChild(btn);
  }
}

function renderCategoryGrid() {
  const grid = document.getElementById("category-grid");
  grid.innerHTML = "";
  for (const cat of getCategories()) {
    const sel = selections[cat];
    const rarity = getDisplayRarity(cat);

    const btn = document.createElement("button");
    btn.className = "category-button";
    if (!sel) {
      btn.classList.add("empty");
    } else if (sel.gem && cat.startsWith("weapon")) {
      btn.classList.add(gemClassName(sel.gem));
    } else if (rarity !== null) {
      btn.classList.add(`rarity-${rarity}`);
    }

    let label;
    if (!sel) {
      label = slotLabel(cat);
    } else {
      label = sel.reforge ? `${sel.reforge} ${sel.item}` : sel.item;
      if (sel.gem && cat.startsWith("weapon")) label += ` [${sel.gem}]`;
    }
    btn.textContent = label;

    btn.addEventListener("click", () => openItemSelector(cat));
    btn.addEventListener("mouseenter", e => {
      const cur = selections[cat];
      if (!cur?.item) return;
      const item = itemData[fixCategory(cat)][cur.item];
      const combined = { ...item };
      for (const [stat, val] of Object.entries(getReforgeStats(cat, cur.item, cur.reforge))) {
        combined[stat] = typeof combined[stat] === "number" ? combined[stat] + val : val;
      }
      showTooltip(e.clientX, e.clientY, {
        name: cur.reforge ? `${cur.reforge} ${cur.item}` : cur.item,
        data: combined,
        gem: (cur.gem && cat.startsWith("weapon")) ? cur.gem : null
      });
    });
    btn.addEventListener("mousemove", e => positionTooltip(e.clientX, e.clientY));
    btn.addEventListener("mouseleave", () => { tooltipEl.style.display = "none"; });
    grid.appendChild(btn);
  }
}

function renderStats() {
  const panel = document.getElementById("stats-panel");
  panel.innerHTML = "";
  const stats = computeStats();
  const display = {};
  for (const [key, val] of Object.entries(stats)) {
    if (val !== STAT_DEFAULTS[key] || key === "MaxHealth" || key === "MaxMana") {
      display[key] = val;
    }
  }
  for (const [name, val] of Object.entries(display)) {
    const p = document.createElement("p");
    if (STAT_TYPE_CLASS[name]) p.className = STAT_TYPE_CLASS[name];
    p.innerHTML = `<span class="stat-label">${statLabel(name)}</span><span class="stat-value">${val}</span>`;
    panel.appendChild(p);
  }
}

function renderAbilities() {
  const panel = document.getElementById("abilities-panel");
  panel.innerHTML = "";

  const isSet = a => typeof a == "string" && /set bonus/i.test(a);
  const helmetSet = getAbilities("helmet").find(isSet);
  const armourSet = getAbilities("armour").find(isSet);
  if (helmetSet && helmetSet === armourSet) {
    const p = document.createElement("p");
    p.className = "set-bonus";
    p.textContent = `Set Bonus (${selections.helmet.item} + ${selections.armour.item}): ${helmetSet.replace(/^\[?set bonus\]?:?\s*/i, "")}`;
    panel.appendChild(p);
  }

  for (const cat of getCategories()) {
    const abilities = getAbilities(cat).filter(a => !(typeof a === "string" && /set bonus/i.test(a)));
    const gem = cat.startsWith("weapon") ? selections[cat]?.gem : null;
    if (!abilities.length && !gem) continue;

    const rarity = getDisplayRarity(cat) ?? 1;
    const group = document.createElement("div");
    group.className = "ability-group";
    for (const ability of abilities) {
      const p = document.createElement("p");
      p.className = `rarity-${rarity}`;
      p.textContent = `${selections[cat].item}: ${ability}`;
      group.appendChild(p);
    }
    if (gem) {
      const p = document.createElement("p");
      p.className = gemClassName(gem);
      p.textContent = `${selections[cat].item} [${gem}]: ${reforgeData.gems[gem]}`;
      group.appendChild(p);
    }
    panel.appendChild(group);
  }
}

function renderSkillsButton() {
  document.getElementById("skills-btn").textContent = `(${getTotalSkillPoints()}/${MAX_POINTS}) Points`;
}

function renderSkillsPopup() {
  const tabs = Object.keys(skillsData);
  if (!activeSkillTab || !tabs.includes(activeSkillTab)) activeSkillTab = tabs[0] || "";

  const tabsEl = document.getElementById("skill-tabs");
  tabsEl.innerHTML = "";
  for (const tab of tabs) {
    const btn = document.createElement("button");
    btn.textContent = tab;
    if (tab === activeSkillTab) btn.classList.add("selected");
    btn.addEventListener("click", () => { activeSkillTab = tab; renderSkillsPopup(); });
    tabsEl.appendChild(btn);
  }

  document.getElementById("skill-points-label").textContent =
    `Points: ${getTotalSkillPoints()} / ${MAX_POINTS}`;

  const panel = document.getElementById("skills-panel");
  panel.innerHTML = "";
  for (const [name, skill] of Object.entries(skillsData[activeSkillTab] || {})) {
    const lvl = skillLevels[name] || 0;
    const aceCost = skill.acedcost ?? skill.cost * 2;
    const card = document.createElement("div");
    card.className = "skill-card";
    if (lvl == 1) card.classList.add("skill-base");
    if (lvl == 2) card.classList.add("skill-aced");
    card.style.cursor = "pointer";

    const lvlTxt = lvl == 2 ? "ACED" : lvl == 1 ? "BASE" : "NONE";
    card.innerHTML = `
      <strong>${name}</strong>
      <p>Cost: ${skill.cost} (+${aceCost} to ace)</p>
      <p class="${lvl >= 1 ? "active" : "inactive"}">Base: ${skill.base}</p>
      <p class="${lvl == 2 ? "active" : "inactive"}">Aced: ${skill.aced}</p>
      <p>Level: ${lvlTxt}</p>
    `;

    card.addEventListener("click", () => {
      const current = skillLevels[name] || 0;
      const next = (current + 1) % 3;
      const costFor = lvl =>
        lvl === 1 ? skill.cost :
        lvl === 2 ? skill.cost + (skill.acedcost ?? skill.cost * 2) : 0;
      const projected = getTotalSkillPoints() - costFor(current) + costFor(next);
      if (projected <= MAX_POINTS) skillLevels[name] = next;
      autosave();
      renderSkillsPopup();
      renderStats();
      renderSkillsButton();
    });
    panel.appendChild(card);
  }
}

function renderBuildsPopup() {
  const listEl = document.getElementById("builds-list");
  listEl.innerHTML = "";
  if (savedBuilds.length === 0) {
    listEl.innerHTML = "<p>No saved builds</p>";
  }
  for (const name of savedBuilds) {
    const row = document.createElement("div");
    row.className = "build-row";

    const loadBtn = document.createElement("button");
    loadBtn.textContent = name;
    if (name === currentBuildName) loadBtn.classList.add("selected");
    loadBtn.addEventListener("click", () => {
      loadBuild(name);
      document.getElementById("builds-overlay").style.display = "none";
      render_all();
    });

    const delBtn = document.createElement("button");
    delBtn.textContent = "delete";
    delBtn.className = "delete-btn";
    delBtn.addEventListener("click", () => { deleteBuild(name); renderBuildsPopup(); });

    row.append(loadBtn, delBtn);
    listEl.appendChild(row);
  }
}

function render_all() {
  renderCategoryGrid();
  renderStats();
  renderAbilities();
  renderSkillsButton();
}

function populateExportCard() {
  document.getElementById("export-title").textContent = currentBuildName || "Untitled Build";
  document.getElementById("export-equipment").innerHTML = document.getElementById("category-grid").innerHTML;
  document.getElementById("export-stats").innerHTML = document.getElementById("stats-panel").innerHTML;

  const abilitiesHTML = document.getElementById("abilities-panel").innerHTML;

  const skills = [];
  for (const cat in skillsData) {
    for (const [name, skill] of Object.entries(skillsData[cat])) {
      const lvl = skillLevels[name] || 0;
      if (lvl === 0) continue;
      skills.push({ name, level: lvl, desc: lvl === 2 ? skill.aced : skill.base });
    }
  }

  let skillsHTML = "";
  if (skills.length) {
    const rows = skills.map(s => {
      const cls = s.level === 2 ? "export-skill-aced" : "export-skill-base";
      const lvlTxt = s.level === 2 ? "ACED" : "BASE";
      return `<p class="${cls}">${s.name} (${lvlTxt}): ${s.desc}</p>`;
    }).join("");
    skillsHTML = `<div class="export-skills-group"><h5>Skills</h5>${rows}</div>`;
  }

  document.getElementById("export-abilities").innerHTML = (abilitiesHTML + skillsHTML) || "<p>No abilities</p>";
  document.getElementById("export-watermark").textContent = window.location.origin + window.location.pathname;
}

function downloadImageBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentBuildName || "pilgrammed-build"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function copyBuildImage() {
  const btn = document.getElementById("copy-image-btn");
  const originalText = btn.textContent;

  populateExportCard();
  const card = document.getElementById("export-card");

  const itemGrid = document.getElementById("item-grid");
  const savedItemGridHTML = itemGrid.innerHTML;
  itemGrid.innerHTML = "";

  html2canvas(card, { backgroundColor: "#1e1e1e", scale: 1.5 })
    .then(canvas => new Promise(resolve => canvas.toBlob(resolve, "image/png")))
    .then(blob => {
      if (navigator.clipboard && window.ClipboardItem) {
        return navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      }
      downloadImageBlob(blob);
    })
    .finally(() => {
      itemGrid.innerHTML = savedItemGridHTML;
      btn.disabled = false;
      btn.textContent = originalText;
    });
}

function connect_events() {
  document.getElementById("build-name-input").addEventListener("input", e => {
    currentBuildName = e.target.value;
    localStorage.setItem("pilgrammed-build-name", currentBuildName.trim());
    autosave();
  });

  document.getElementById("save-btn").addEventListener("click", saveBuild);
  document.getElementById("load-btn").addEventListener("click", () => {
    refreshBuildList();
    renderBuildsPopup();
    document.getElementById("builds-overlay").style.display = "flex";
  });
  document.getElementById("copy-url-btn").addEventListener("click", copyBuildURL);
  document.getElementById("copy-image-btn").addEventListener("click", copyBuildImage);
  document.getElementById("clear-btn").addEventListener("click", clearBuild);
  document.getElementById("info-btn").addEventListener("click", () => {
    document.getElementById("info-overlay").style.display = "flex";
  });
  document.getElementById("skills-btn").addEventListener("click", () => {
    renderSkillsPopup();
    document.getElementById("skills-overlay").style.display = "flex";
  });

  document.getElementById("items-close").addEventListener("click", closeItemsPopup);

  const overlayIds = ["items-overlay", "skills-overlay", "builds-overlay", "info-overlay"];
  const closeOverlay = id => { document.getElementById(id).style.display = "none"; };

  document.getElementById("skills-close").addEventListener("click", () => closeOverlay("skills-overlay"));
  document.getElementById("builds-close").addEventListener("click", () => closeOverlay("builds-overlay"));
  document.getElementById("info-close").addEventListener("click", () => closeOverlay("info-overlay"));
  document.getElementById("info-close-btn").addEventListener("click", () => closeOverlay("info-overlay"));

  for (const id of overlayIds) {
    const overlay = document.getElementById(id);
    overlay.addEventListener("click", e => { if (e.target == overlay) overlay.style.display = "none"; });
  }

  document.addEventListener("keydown", e => {
    if (e.key == "Escape") overlayIds.forEach(closeOverlay);
  });

  document.getElementById("equip-btn").addEventListener("click", confirmSelection);
  document.getElementById("reforge-select").addEventListener("change", e => {
    currentReforge = e.target.value;
    renderReforgeDescription();
  });
  document.getElementById("gem-select").addEventListener("change", e => {
    currentGem = e.target.value;
    renderGemDescription();
  });

  document.getElementById("item-search").addEventListener("input", e => {
    renderitems(itemData[fixCategory(currentCategory)] || {}, e.target.value);
  });
  document.getElementById("item-sort-select").addEventListener("change", e => {
    currentSortKey = e.target.value;
    renderitems(itemData[fixCategory(currentCategory)] || {}, document.getElementById("item-search").value);
  });
  document.getElementById("item-sort-dir-btn").addEventListener("click", () => {
    currentSortDir = currentSortDir == "asc" ? "desc" : "asc";
    document.getElementById("item-sort-dir-btn").textContent = currentSortDir == "asc" ? "↑ Asc" : "↓ Desc";
    renderitems(itemData[fixCategory(currentCategory)] || {}, document.getElementById("item-search").value);
  });
}

async function init() {
  const [items, reforges, skills, ids] = await Promise.all([
    fetch("data/items.json"),
    fetch("data/reforges.json"),
    fetch("data/skills.json"),
    fetch("data/save-ids.json")
  ]);
  itemData = await items.json();
  reforgeData = await reforges.json();
  skillsData = await skills.json();
  saveIds = await ids.json();

  refreshBuildList();
  connect_events();

  const storedName = localStorage.getItem("pilgrammed-build-name");
  if (storedName) {
    currentBuildName = storedName;
    document.getElementById("build-name-input").value = storedName;
  }

  const encoded = new URLSearchParams(window.location.search).get("build");
  if (encoded) {
    loadBuildString(LZString.decompressFromBase64(decodeURIComponent(encoded)));
  } else {
    const working = localStorage.getItem("pilgrammed-working");
    if (working) loadBuildString(LZString.decompressFromBase64(working));
    else loadBuild();
  }

  render_all();
}

init();