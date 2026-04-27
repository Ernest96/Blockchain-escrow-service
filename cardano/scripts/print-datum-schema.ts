// Prints the Datum and Redeemer schemas for the escrow validator
// from plutus.json (the blueprint produced by `aiken build`).
//
// Run with: npx tsx scripts/print-datum-schema.ts
//   (or:    deno run --allow-read scripts/print-datum-schema.ts)
//
// This is the on-chain serialised view of the types declared in
// validators/escrow.ak.

import fs from "node:fs";

type FieldRef = { title?: string; $ref: string };
type Constructor = {
  title?: string;
  dataType: "constructor";
  index: number;
  fields: FieldRef[];
};
type SumType = { title?: string; description?: string; anyOf: Constructor[] };

const blueprint = JSON.parse(fs.readFileSync("plutus.json", "utf8"));
const defs: Record<string, any> = blueprint.definitions ?? {};

function resolveLabel(ref: string): string {
  const key = ref.replace("#/definitions/", "").replace(/~1/g, "/");
  const def = defs[key];
  if (!def) return key;
  if (def.dataType === "integer") return "Int";
  if (def.dataType === "bytes") return def.title ?? "ByteArray";
  return def.title ?? key;
}

function printConstructor(c: Constructor) {
  const name = c.title ?? "(anonymous)";
  const fields = c.fields
    .map((f) => `${f.title ?? "_"}: ${resolveLabel(f.$ref)}`)
    .join(", ");
  console.log(`  [${c.index}] ${name}(${fields})`);
}

console.log(`Validators in ${blueprint.preamble.title} (Plutus ${blueprint.preamble.plutusVersion}):\n`);
for (const v of blueprint.validators ?? []) {
  console.log(`- ${v.title}`);
  console.log(`  hash: ${v.hash}`);
}
console.log();

const datumDef: SumType | undefined = defs["escrow/Datum"];
if (datumDef) {
  console.log(`Datum  (escrow/Datum) — ${datumDef.anyOf.length} constructor(s):`);
  datumDef.anyOf.forEach(printConstructor);
}

const redeemerDef: SumType | undefined = defs["escrow/Redeemer"];
if (redeemerDef) {
  console.log(`\nRedeemer  (escrow/Redeemer) — ${redeemerDef.anyOf.length} constructor(s):`);
  redeemerDef.anyOf.forEach(printConstructor);
}
