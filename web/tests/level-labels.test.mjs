import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/constants.ts", import.meta.url), "utf8");

test("F-04: proficiency labels use Indonesian only for vacancy form", () => {
  const block = source.match(/export const LEVEL_LABELS[^=]*=\s*\{([^}]+)\}/)?.[1] ?? "";
  const labels = Object.fromEntries([...block.matchAll(/(\d):\s*"([^"]+)"/g)].map((m) => [Number(m[1]), m[2]]));
  assert.deepEqual(labels, {
    1: "Pemula",
    2: "Dasar",
    3: "Menengah",
    4: "Mahir",
    5: "Ahli",
  });
  const vacancyPages = ["../src/pages/vacancies/VacancyNewPage.tsx", "../src/pages/vacancies/VacancyEditPage.tsx"];
  for (const page of vacancyPages) {
    const pageSource = readFileSync(new URL(page, import.meta.url), "utf8");
    assert.match(pageSource, /labelFn=\{getLevelLabel\}/);
  }
  assert.match(readFileSync(new URL("../src/components/assessment/SkillCard.tsx", import.meta.url), "utf8"), /<LevelRadio/);
  assert.match(readFileSync(new URL("../src/components/assessment/LevelRadio.tsx", import.meta.url), "utf8"), /`L\$\{level\}`/);
});

test("Vacancy level options show Indonesian one-line descriptions", () => {
  const descBlock = source.match(/export const LEVEL_DESCRIPTIONS_ID[^=]*=\s*\{([^}]+)\}/)?.[1] ?? "";
  const descs = Object.fromEntries([...descBlock.matchAll(/(\d):\s*"([^"]+)"/g)].map((m) => [Number(m[1]), m[2]]));
  assert.deepEqual(descs, {
    1: "Baru mengenal skill ini, masih perlu banyak panduan.",
    2: "Bisa mengerjakan tugas sederhana dengan panduan.",
    3: "Bisa mengerjakan secara mandiri.",
    4: "Bisa menangani tugas kompleks dan membimbing orang lain.",
    5: "Penguasaan mendalam, menjadi rujukan untuk skill ini.",
  });
  for (const page of ["../src/pages/vacancies/VacancyNewPage.tsx", "../src/pages/vacancies/VacancyEditPage.tsx"]) {
    const pageSource = readFileSync(new URL(page, import.meta.url), "utf8");
    assert.match(pageSource, /descriptionFn=\{getLevelDescriptionId\}/);
  }
  assert.match(readFileSync(new URL("../src/components/assessment/LevelRadio.tsx", import.meta.url), "utf8"), /descriptionFn\?:/);
});
