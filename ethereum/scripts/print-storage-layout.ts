import fs from "node:fs";
import path from "node:path";

/**
 * Prints the Solidity storage layout of contracts/Escrow.sol.
 * Reads the build-info file produced by `hardhat compile` and extracts
 * the storage slot table for the Escrow contract.
 */

const BUILD_INFO_DIR = path.join("artifacts", "build-info");

function findBuildInfo(): string {
  if (!fs.existsSync(BUILD_INFO_DIR)) {
    throw new Error("artifacts/build-info missing — run `npx hardhat compile` first.");
  }
  const files = fs.readdirSync(BUILD_INFO_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error("No build-info JSON files found.");
  }
  // pick the most recently modified
  files.sort((a, b) => {
    const aT = fs.statSync(path.join(BUILD_INFO_DIR, a)).mtimeMs;
    const bT = fs.statSync(path.join(BUILD_INFO_DIR, b)).mtimeMs;
    return bT - aT;
  });
  return path.join(BUILD_INFO_DIR, files[0]);
}

const buildInfoPath = findBuildInfo();
const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));

const contractName = "Escrow";

// Hardhat 3 prefixes source paths with "project/" in build-info output.
const allContracts = buildInfo.output?.contracts ?? {};
const matchedSource = Object.keys(allContracts).find((sp) =>
  sp.endsWith(`contracts/${contractName}.sol`),
);
if (!matchedSource) {
  throw new Error(
    `No source matching contracts/${contractName}.sol found in ${buildInfoPath}`,
  );
}
const contractOutput = allContracts[matchedSource]?.[contractName];
if (!contractOutput) {
  throw new Error(`No output for ${contractName} in ${matchedSource}`);
}

const layout = contractOutput.storageLayout;
if (!layout) {
  throw new Error(
    "storageLayout missing — make sure hardhat.config.ts has " +
      'outputSelection: { "*": { "*": ["storageLayout"] } }'
  );
}

console.log(`Storage layout for ${contractName} (from ${buildInfoPath}):\n`);
console.log("| slot | offset | label    | type                                 |");
console.log("|------|--------|----------|--------------------------------------|");
for (const item of layout.storage) {
  const typeName = layout.types?.[item.type]?.label ?? item.type;
  console.log(
    `| ${item.slot.padStart(4)} | ${String(item.offset).padStart(6)} | ${item.label.padEnd(8)} | ${typeName.padEnd(36)} |`,
  );
}

// Also print Deal struct members.
const dealType = Object.entries(layout.types ?? {}).find(
  ([, info]: any) => info?.label === "struct Escrow.Deal",
);
if (dealType) {
  const [, info] = dealType as [string, any];
  console.log(`\nMembers of ${info.label} (${info.numberOfBytes} bytes per entry):`);
  console.log("| slot | offset | label    | type                                 |");
  console.log("|------|--------|----------|--------------------------------------|");
  for (const member of info.members ?? []) {
    const typeName = layout.types?.[member.type]?.label ?? member.type;
    console.log(
      `| ${String(member.slot).padStart(4)} | ${String(member.offset).padStart(6)} | ${member.label.padEnd(8)} | ${typeName.padEnd(36)} |`,
    );
  }
}
