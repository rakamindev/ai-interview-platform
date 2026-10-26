import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../src/components/vacancies/SalaryInput.tsx", import.meta.url));
const source = readFileSync(path, "utf8");
for (const page of ["../src/pages/vacancies/VacancyNewPage.tsx", "../src/pages/vacancies/VacancyEditPage.tsx"]) {
  const pageSource = readFileSync(fileURLToPath(new URL(page, import.meta.url)), "utf8");
  assert.ok(pageSource.indexOf('Expected skills') < pageSource.indexOf('field="salary_min"'), `${page}: salary appears after skills`);
}
assert.match(source, /new Intl\.NumberFormat\("id-ID"\)/);
assert.match(source, /value\.replace\(\/\\D\/g, ""\)/);
assert.match(source, /type="text" inputMode="numeric"/);
console.log("Salary input uses Indonesian thousands separators and digit-only input");
