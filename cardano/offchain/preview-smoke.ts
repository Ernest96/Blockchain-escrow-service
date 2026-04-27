// Preview happy-path smoke test:
//   1. payer locks 5 ADA at the script address with a 30-min deadline
//   2. wait for the lock tx to confirm
//   3. provider claims before deadline
// Prints all tx hashes — those go straight into REPORT.md.
//
// Required env (in .env):
//   BLOCKFROST_PROJECT_ID, PAYER_MNEMONIC, PROVIDER_MNEMONIC
// Both wallets need:
//   - some Preview tADA (~10 ADA each is plenty)
//   - a collateral UTxO (run `tsx setup-collateral.ts <role>` once)

import {
  MeshTxBuilder,
  mConStr0,
  unixTimeToEnclosingSlot,
  SLOT_CONFIG_NETWORK,
} from "@meshsdk/core";
import {
  getWallet,
  getProvider,
  getScriptAddress,
  getScriptCbor,
  getPaymentKeyHash,
} from "./common.js";

const LOCK_AMOUNT_LOVELACE = "5000000"; // 5 ADA
const DEADLINE_MIN = 30;

const provider = getProvider();
const { wallet: payerWallet } = await getWallet("payer");
const { wallet: providerWallet } = await getWallet("provider");

const payerAddress = await payerWallet.getChangeAddress();
const payerPkh = await getPaymentKeyHash(payerWallet);
const providerAddress = await providerWallet.getChangeAddress();
const providerPkh = await getPaymentKeyHash(providerWallet);
const scriptAddress = getScriptAddress();
const scriptCbor = getScriptCbor();

console.log("Payer:           ", payerAddress);
console.log("Provider:        ", providerAddress);
console.log("Script address:  ", scriptAddress);

// 1. lock
console.log("\nlock() …");
const deadlineMs = Date.now() + DEADLINE_MIN * 60_000;
const datum = mConStr0([payerPkh, providerPkh, deadlineMs]);
const lockBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider });
const lockUnsigned = await lockBuilder
  .txOut(scriptAddress, [{ unit: "lovelace", quantity: LOCK_AMOUNT_LOVELACE }])
  .txOutInlineDatumValue(datum)
  .changeAddress(payerAddress)
  .selectUtxosFrom(await payerWallet.getUtxos())
  .complete();
const lockSigned = await payerWallet.signTx(lockUnsigned);
const lockTxHash = await payerWallet.submitTx(lockSigned);
console.log("  lock tx:       ", lockTxHash);
console.log("  cardanoscan:   ", `https://preview.cardanoscan.io/transaction/${lockTxHash}`);

// 2. wait for confirmation
console.log("\nWaiting for lock tx to confirm (~30 s) …");
await new Promise<void>((resolve, reject) => {
  provider.onTxConfirmed(lockTxHash, () => resolve(), 120);
  setTimeout(() => reject(new Error("Timeout waiting for lock confirmation")), 240_000);
});
console.log("  confirmed");

// 3. claim
console.log("\nclaim() …");
const lockUtxos = await provider.fetchUTxOs(lockTxHash);
const scriptUtxo = lockUtxos.find((u) => u.output.address === scriptAddress);
if (!scriptUtxo) throw new Error("Script UTxO not found in lock tx outputs");

const upperUnixSec = Math.floor((deadlineMs - 1000) / 1000);
const invalidHereafter = unixTimeToEnclosingSlot(
  upperUnixSec,
  SLOT_CONFIG_NETWORK.preview,
);

const collateral = await providerWallet.getCollateral();
if (collateral.length === 0) {
  throw new Error("Provider has no collateral. Run `tsx setup-collateral.ts provider` first.");
}

const claimBuilder = new MeshTxBuilder({
  fetcher: provider,
  submitter: provider,
  evaluator: provider,
});
const claimUnsigned = await claimBuilder
  .spendingPlutusScriptV3()
  .txIn(
    scriptUtxo.input.txHash,
    scriptUtxo.input.outputIndex,
    scriptUtxo.output.amount,
    scriptUtxo.output.address,
  )
  .txInScript(scriptCbor)
  .txInInlineDatumPresent()
  .txInRedeemerValue(mConStr0([])) // Claim
  .txInCollateral(
    collateral[0].input.txHash,
    collateral[0].input.outputIndex,
    collateral[0].output.amount,
    collateral[0].output.address,
  )
  .invalidHereafter(invalidHereafter)
  .requiredSignerHash(providerPkh)
  .changeAddress(providerAddress)
  .selectUtxosFrom(await providerWallet.getUtxos())
  .complete();
const claimSigned = await providerWallet.signTx(claimUnsigned);
const claimTxHash = await providerWallet.submitTx(claimSigned);

console.log("  claim tx:      ", claimTxHash);
console.log("  cardanoscan:   ", `https://preview.cardanoscan.io/transaction/${claimTxHash}`);

console.log("\n✓ Preview happy-path complete.");
console.log("Lock tx:          ", lockTxHash);
console.log("Claim tx:         ", claimTxHash);
