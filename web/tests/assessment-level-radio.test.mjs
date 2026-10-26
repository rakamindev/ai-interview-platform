import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/components/assessment/LevelRadio.tsx", import.meta.url), "utf8");
test("assessment level radio displays stable L1-L5 labels", () => {
  assert.match(source, /L\$\{level\}/);
  assert.doesNotMatch(source, /getLevelLabel/);
});
