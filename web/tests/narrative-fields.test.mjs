import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const newPage = readFileSync(new URL("../src/pages/vacancies/VacancyNewPage.tsx", import.meta.url), "utf8");
const editPage = readFileSync(new URL("../src/pages/vacancies/VacancyEditPage.tsx", import.meta.url), "utf8");

test("F-06: narrative fields have maxLength 500 in New page", () => {
  assert.match(newPage, /maxLength.*500|maxLength=\{500\}/);
});

test("F-06: narrative fields have helper text in New page", () => {
  assert.match(newPage, /500/);
  assert.match(newPage, /characters/i);
});

test("F-06: narrative fields have maxLength 500 in Edit page", () => {
  assert.match(editPage, /maxLength.*500|maxLength=\{500\}/);
});

const engine = readFileSync(new URL("../../api/app/services/fit_gap/engine.rb", import.meta.url), "utf8");

test("F-06: prompt wraps assessor input as context, not instruction", () => {
  assert.match(engine, /assessor.provided.context|ASSESSOR.CONTEXT|context from the assessor/i);
});
