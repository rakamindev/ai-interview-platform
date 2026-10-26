import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const migration = read("api/db/migrate/20261026000000_add_job_requirements_to_vacancies.rb");
const controller = read("api/app/controllers/api/v1/vacancies_controller.rb");
const engine = read("api/app/services/fit_gap/engine.rb");
const model = read("api/app/models/vacancy.rb");
const form = read("web/src/pages/vacancies/VacancyNewPage.tsx");
const edit = read("web/src/pages/vacancies/VacancyEditPage.tsx");
const service = read("web/src/services/vacancies.ts");
const types = read("web/src/types/index.ts");

for (const field of ["location", "work_arrangement", "employment_type", "minimum_education", "salary_min", "salary_max"]) {
  assert.match(migration, new RegExp(`:${field}\\b`), `migration should persist ${field}`);
  assert.match(controller, new RegExp(`:${field}\\b`), `API should permit/serialize ${field}`);
  assert.match(engine, new RegExp(`vacancy\\.${field}\\b`), `fit-gap prompt should include ${field}`);
  assert.match(form, new RegExp(`\\b${field}\\b`), `new form should edit ${field}`);
  assert.match(edit, new RegExp(`\\b${field}\\b`), `edit form should edit ${field}`);
  assert.match(service, new RegExp(`\\b${field}\\??:`), `API type should include ${field}`);
  assert.match(types, new RegExp(`\\b${field}\\??:`), `Vacancy type should include ${field}`);
}
assert.match(migration, /:experience_level/);
assert.doesNotMatch(migration, /job_level/);
assert.match(migration, /:experience_years_min/);
assert.match(migration, /:experience_years_max/);
assert.match(controller, /:experience_level\b/);
assert.match(engine, /vacancy\.experience_level\b/);
assert.match(engine, /experience_years_min/);
assert.match(engine, /experience_years_max/);
assert.match(controller, /experience_years_min/);
assert.match(controller, /experience_years_max/);
assert.match(model, /experience_years_range_is_valid/);
assert.match(model, /experience_level/);
assert.match(model, /salary_min/);
assert.match(model, /salary_max/);
console.log("F-25 vacancy fields are wired through persistence, forms, API, and fit-gap context");
