import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
for (const path of ["../src/pages/vacancies/VacancyNewPage.tsx", "../src/pages/vacancies/VacancyEditPage.tsx"]) {
  const source = read(path);
  const roleIndex = source.indexOf("<RoleTitleField");
  const experienceIndex = source.indexOf("htmlFor=\"experience_level\"");
  const locationIndex = source.indexOf("<LocationField");
  assert.ok(roleIndex >= 0 && roleIndex < experienceIndex, `${path}: experience controls follow Role title`);
  assert.ok(experienceIndex < locationIndex, `${path}: experience controls precede Location`);
  assert.match(source, /option value="associate">Associate/);
  assert.match(source, /htmlFor="experience_years_min"/);
  assert.match(source, /htmlFor="experience_years_max"/);
}
console.log("Experience level and custom years range appear directly below Role title on new/edit forms");
