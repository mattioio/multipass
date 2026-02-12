export const FRUITS = {
  banana: { id: "banana", name: "Mr Yellow", emoji: "🍌", theme: "banana" },
  strawberry: { id: "strawberry", name: "Mr Red", emoji: "🍓", theme: "strawberry" },
  kiwi: { id: "kiwi", name: "Mr Green", emoji: "🥝", theme: "kiwi" },
  blueberry: { id: "blueberry", name: "Mr Blue", emoji: "🫐", theme: "blueberry" }
};

export function getFruit(id) {
  return FRUITS[id] || null;
}

export function getFruitByTheme(theme) {
  return Object.values(FRUITS).find((entry) => entry.theme === theme) || null;
}
