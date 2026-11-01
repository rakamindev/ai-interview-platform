// react-hook-form rule: `required` alone accepts whitespace-only input, which the API rejects.
export function requiredText(message: string) {
  return {
    validate: (value: unknown) => (typeof value === "string" && value.trim() !== "") || message,
  };
}

// Matches the varchar(255) columns (assessment name, role title, skill label, candidate name);
// longer values fail in the database with a generic server error.
export const MAX_TEXT_FIELD_LENGTH = 255;
