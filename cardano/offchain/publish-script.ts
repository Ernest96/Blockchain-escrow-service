import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MeshTxBuilder } from "@meshsdk/core";
import { getWallet, getScriptCbor, loadValidator, cardanoscanTxUrl, NETWORK } from "./common.js";

const SCRIPT_REF_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "script-ref.json",
);

if (fs.existsSync(SCRIPT_REF_FILE)) {
  console.log("script-ref.json already exists — refusing to overwrite.\n");
  process.exit(0);
}

const { provider, wallet } = await getWallet("admin");
const adminAddress = await wallet.getChangeAddress();
const validator = loadValidator();
const scriptCbor = getScriptCbor();

console.log("Publishing reference script...");
console.log("validator:        ", validator.title);
console.log("script hash:      ", validator.hash);
console.log("reference owner:  ", adminAddress, "(admin)");

const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider });
const unsigned = await txBuilder
  .txOut(adminAddress, [{ unit: "lovelace", quantity: "20000000" }])
  .txOutReferenceScript(scriptCbor, "V3")
  .changeAddress(adminAddress)
  .selectUtxosFrom(await wallet.getUtxos())
  .complete();

const signed = await wallet.signTx(unsigned);
const txHash = await wallet.submitTx(signed);

console.log("publish tx: ", txHash);
console.log(cardanoscanTxUrl(txHash));

const record = {
  txHash,
  outputIndex: 0,
  scriptHash: validator.hash,
  validatorTitle: validator.title,
  network: NETWORK,
  publishedAt: new Date().toISOString(),
};
fs.writeFileSync(SCRIPT_REF_FILE, JSON.stringify(record) + "\n");
console.log("\nSaved to:           ", SCRIPT_REF_FILE);