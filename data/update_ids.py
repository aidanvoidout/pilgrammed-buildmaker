import json

ITEMS_FILE = "data/items.json"
REFORGES_FILE = "data/reforges.json"
SKILLS_FILE = "data/skills.json"
IDS_FILE = "data/save-ids.json"

# Saved builds and shared URLs store every item / reforge / gem / skill as its
# position in save-ids.json, so the lists in there are append-only. This script
# adds anything new to the end of the right list. It never reorders or removes.
# To rename something, change its name in place in save-ids.json as well.
# The "v1" block is only for decoding old saves and must never change.


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def append_new(id_list, names, label):
    known = set(id_list)
    added = 0
    for name in names:
        if name not in known:
            id_list.append(name)
            known.add(name)
            added += 1
            print(f"  + {label}: {name}")
    return added


items = load(ITEMS_FILE)
reforges = load(REFORGES_FILE)
skills = load(SKILLS_FILE)
ids = load(IDS_FILE)

added = 0

for category, category_items in items.items():
    if not isinstance(category_items, dict):
        continue
    added += append_new(ids["items"].setdefault(category, []), category_items, category)

for group, group_reforges in reforges.items():
    if group == "gems":
        added += append_new(ids["gems"], group_reforges, "gem")
    else:
        added += append_new(ids["reforges"], group_reforges, "reforge")

for category in skills.values():
    added += append_new(ids["skills"], category, "skill")

lines = [
    f"  {json.dumps(key)}: {json.dumps(value, ensure_ascii=False, separators=(',', ':'))}"
    for key, value in ids.items()
]
with open(IDS_FILE, "w", encoding="utf-8", newline="\n") as f:
    f.write("{\n" + ",\n".join(lines) + "\n}\n")

print(f"{added} new id(s) written to {IDS_FILE}")
