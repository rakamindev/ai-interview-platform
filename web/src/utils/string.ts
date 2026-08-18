export function getInitials(name: string, length: number) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, length)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
