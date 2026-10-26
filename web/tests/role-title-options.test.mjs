import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/roleTitles.ts", import.meta.url), "utf8");

test("role title options include standard roles and custom option with 100-char cap", () => {
  assert.match(source, /Software Engineer/);
  assert.match(source, /Product Manager/);
  assert.match(source, /Other \(custom\)/);
  assert.match(source, /ROLE_TITLE_MAX_LENGTH\s*=\s*100/);
});

test("Vacancy role title uses the searchable picker", () => {
  const field = readFileSync(new URL("../src/components/vacancies/RoleTitleField.tsx", import.meta.url), "utf8");
  assert.match(field, /register\("role_title"/);
  assert.match(field, /maxLength/i);
  assert.match(field, /role="listbox"/);
});

test("Assessment uses the searchable role title picker and maps it to API name", () => {
  const page = readFileSync(new URL("../src/pages/assessments/AssessmentNewPage.tsx", import.meta.url), "utf8");
  assert.match(page, /RoleTitleField/);
  assert.match(page, /name:\s*roleTitle/);
});
