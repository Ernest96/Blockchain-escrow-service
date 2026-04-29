import { MeshTxBuilder, deserializeDatum, mConStr1 } from "@meshsdk/core";
import {
  getWallet,
  getScriptAddress,
  getPaymentKeyHash,
  loadScriptRef,
  slotAfterDeadline,
  cardanoscanTxUrl,
  type EscrowDatum,
} from "./common.js";

const lockTxHash = process.argv[2] ?? process.env.LOCK_TX_HASH;
if (!lockTxHash) {
  console.error("LOCK_TX_HASH not set in .env. ");
  process.exit(1);
}

const { provider, wallet } = await getWallet("payer");
const payerAddress = await wallet.getChangeAddress();
const payerPkh = await getPaymentKeyHash(wallet);
const scriptAddress = getScriptAddress();
const scriptRef = loadScriptRef();

const txUtxos = await provider.fetchUTxOs(lockTxHash);
const candidate = txUtxos.find((u) => u.output.address === scriptAddress);
if (!candidate) {
  throw new Error(
    `No script UTxO found at ${scriptAddress} in tx ${lockTxHash}.`,
  );
}

const datumPlutus = candidate.output.plutusData;
if (!datumPlutus) throw new Error("Script UTxO has no inline datum.");

const datum = deserializeDatum<EscrowDatum>(datumPlutus);
const datumPayer = datum.fields[0].bytes;
const deadlineMs = Number(datum.fields[2].int);

if (datumPayer !== payerPkh) {
  throw new Error(
    `Datum payer hash (${datumPayer}) does not match wallet (${payerPkh}).`,
  );
}

const nowMs = Date.now();
if (nowMs < deadlineMs) {
  throw new Error(`Deadline has not passed yet: now=${new Date(nowMs).toISOString()}`);
}

const utxos = await wallet.getUtxos();
const collateral = await wallet.getCollateral();
if (collateral.length === 0) {
  throw new Error("Payer wallet has no collateral.");
}

const txBuilder = new MeshTxBuilder({
  fetcher: provider,
  submitter: provider,
  evaluator: provider,
});

const unsignedTx = await txBuilder
  .spendingPlutusScriptV3()
  .txIn(
    candidate.input.txHash,
    candidate.input.outputIndex,
    candidate.output.amount,
    candidate.output.address,
  )
  // Reference the published script UTxO instead of attaching the bytes here.
  .spendingTxInReference(scriptRef.txHash, scriptRef.outputIndex)
  .spendingReferenceTxInInlineDatumPresent()
  .spendingReferenceTxInRedeemerValue(mConStr1([])) // Refund = constructor 1
  .txInCollateral(
    collateral[0].input.txHash,
    collateral[0].input.outputIndex,
    collateral[0].output.amount,
    collateral[0].output.address,
  )
  .invalidBefore(slotAfterDeadline(deadlineMs))
  .requiredSignerHash(payerPkh)
  .changeAddress(payerAddress)
  .selectUtxosFrom(utxos)
  .complete();

const signedTx = await wallet.signTx(unsignedTx);
const txHash = await wallet.submitTx(signedTx);

console.log("REFUND TX SUBMITTED");
console.log("Tx hash:         ", txHash);
console.log("Cardanoscan:     ", cardanoscanTxUrl(txHash));
