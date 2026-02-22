export const AVATARS = {
  yellow: { id: "yellow", name: "Yellow", theme: "yellow" },
  red: { id: "red", name: "Red", theme: "red" },
  green: { id: "green", name: "Green", theme: "green" },
  blue: { id: "blue", name: "Blue", theme: "blue" }
};

export function getAvatar(id) {
  return AVATARS[id] || null;
}

export function getAvatarByTheme(theme) {
  return Object.values(AVATARS).find((entry) => entry.theme === theme) || null;
}
