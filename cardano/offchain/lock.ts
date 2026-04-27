// Locks ADA at the escrow script address with an inline datum.
//
// Usage:
//   tsx lock.ts <amountAda> <deadlineMinutesFromNow> <providerAddressOrPkh>
// Example:
//   tsx lock.ts 5 30 addr_test1...
//
// The payer's verification-key-hash is taken from the wallet derived from
// PAYER_MNEMONIC. The provider can be passed as either a bech32 address or
// a raw 28-byte hex pub-key hash.

import { mConStr0 } from "@meshsdk/core";
import { MeshTxBuilder, resolvePaymentKeyHash } from "@meshsdk/core";
import { getWallet, getScriptAddress, getPaymentKeyHash } from "./common.js";

function isHex(s: string): boolean {
  return /^[0-9a-fA-F]+$/.test(s);
}

function toPkh(input: string): string {
  if (isHex(input) && input.length === 56) return input.toLowerCase();
  return resolvePaymentKeyHash(input);
}

const [amountAdaArg, deadlineMinArg, providerArg] = process.argv.slice(2);
if (!amountAdaArg || !deadlineMinArg || !providerArg) {
  console.error(
    "Usage: tsx lock.ts <amountAda> <deadlineMinutesFromNow> <providerAddressOrPkh>",
  );
  process.exit(1);
}

const amountLovelace = (BigInt(Math.round(Number(amountAdaArg) * 1_000_000))).toString();
const deadlineMs = Date.now() + Number(deadlineMinArg) * 60_000;
const providerPkh = toPkh(providerArg);

const { provider, wallet } = await getWallet("payer");
const payerAddress = await wallet.getChangeAddress();
const payerPkh = await getPaymentKeyHash(wallet);
const scriptAddress = getScriptAddress();
const utxos = await wallet.getUtxos();

console.log("Payer address:   ", payerAddress);
console.log("Payer PKH:       ", payerPkh);
console.log("Provider PKH:    ", providerPkh);
console.log("Script address:  ", scriptAddress);
console.log("Amount (lovelace):", amountLovelace);
console.log("Deadline (ms):   ", deadlineMs, `(${new Date(deadlineMs).toISOString()})`);

const datum = mConStr0([payerPkh, providerPkh, deadlineMs]);

const txBuilder = new MeshTxBuilder({
  fetcher: provider,
  submitter: provider,
});

const unsignedTx = await txBuilder
  .txOut(scriptAddress, [{ unit: "lovelace", quantity: amountLovelace }])
  .txOutInlineDatumValue(datum)
  .changeAddress(payerAddress)
  .selectUtxosFrom(utxos)
  .complete();

const signedTx = await wallet.signTx(unsignedTx);
const txHash = await wallet.submitTx(signedTx);

console.log("\nLOCK TX SUBMITTED");
console.log("Tx hash:         ", txHash);
console.log("Cardanoscan:     ", `https://preview.cardanoscan.io/transaction/${txHash}`);
