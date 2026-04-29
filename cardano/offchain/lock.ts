// Run: npm run lock
import { MeshTxBuilder, mConStr0 } from "@meshsdk/core";
import { getWallet, getScriptAddress, getPaymentKeyHash, cardanoscanTxUrl } from "./common.js";

const amountAda = Number(process.env.LOCK_AMOUNT_ADA ?? "5");
const deadlineMin = Number(process.env.LOCK_DEADLINE_MIN ?? "30");

// embed providerPkh in datum
const { wallet: providerWallet } = await getWallet("provider");
const providerPkh = await getPaymentKeyHash(providerWallet);

const amountLovelace = BigInt(Math.round(amountAda * 1_000_000)).toString();
const deadlineMs = Date.now() + deadlineMin * 60_000;

// Destructure with rename so the names are explicit:
const { provider: blockfrost, wallet: payerWallet } = await getWallet("payer");
const payerAddress = await payerWallet.getChangeAddress();
const payerPkh = await getPaymentKeyHash(payerWallet);
const scriptAddress = getScriptAddress();
const utxos = await payerWallet.getUtxos();

console.log("Payer address: ", payerAddress);
console.log("Payer PKH: ", payerPkh);
console.log("Provider PKH: ", providerPkh);
console.log("Script address: ", scriptAddress);
console.log("Amount: ", `${amountAda} tADA (${amountLovelace} lovelace)`);
console.log(`Deadline: ${deadlineMin} min from now (${new Date(deadlineMs).toISOString()})`);

const datum = mConStr0([payerPkh, providerPkh, deadlineMs]);

const txBuilder = new MeshTxBuilder({
  fetcher: blockfrost,
  submitter: blockfrost,
  evaluator: blockfrost
});

const unsignedTx = await txBuilder
  .txOut(scriptAddress, [{ unit: "lovelace", quantity: amountLovelace }])
  .txOutInlineDatumValue(datum)
  .changeAddress(payerAddress)
  .selectUtxosFrom(utxos)
  .setFee("200000")
  .complete();

// payer signs and submits — they're the msg.sender of this lock.
const signedTx = await payerWallet.signTx(unsignedTx);
const txHash = await payerWallet.submitTx(signedTx);

console.log("LOCK TX SUBMITTED");
console.log("Tx hash: ", txHash);
console.log(`Cardanoscan: ${cardanoscanTxUrl(txHash)}`);