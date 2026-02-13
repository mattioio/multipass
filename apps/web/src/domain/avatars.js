export const AVATARS = {
  yellow: { id: "yellow", name: "Mr Yellow", emoji: "🍌", theme: "yellow" },
  red: { id: "red", name: "Mr Red", emoji: "🍓", theme: "red" },
  green: { id: "green", name: "Mr Green", emoji: "🥝", theme: "green" },
  blue: { id: "blue", name: "Mr Blue", emoji: "🫐", theme: "blue" }
};

export function getAvatar(id) {
  return AVATARS[id] || null;
}

export function getAvatarByTheme(theme) {
  return Object.values(AVATARS).find((entry) => entry.theme === theme) || null;
}
