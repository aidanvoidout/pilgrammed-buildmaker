import json

INPUT_FILE = "data/items.json"
OUTPUT_FILE = "data/items.json"

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

sorted_data = {}

for category in sorted(data.keys()):
    items = data[category]

    if not isinstance(items, dict):
        sorted_data[category] = items
        continue

    sorted_items = dict(
        sorted(
            items.items(),
            key=lambda item: (
                item[1].get("rarity", float("inf")),
                item[0].lower()
            )
        )
    )

    sorted_data[category] = sorted_items

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(sorted_data, f, indent=2, ensure_ascii=False)

print(f"Sorted JSON written to {OUTPUT_FILE}")