import { MeshTxBuilder, deserializeDatum, mConStr0 } from "@meshsdk/core";
import {
  getWallet,
  getScriptAddress,
  getPaymentKeyHash,
  loadScriptRef,
  slotBeforeDeadline,
  cardanoscanTxUrl,
  getCostModels,
  type EscrowDatum,
} from "./common.js";

const lockTxHash = process.argv[2] ?? process.env.LOCK_TX_HASH;
if (!lockTxHash) {
  console.error("LOCK_TX_HASH not set in .env. ");
  process.exit(1);
}

const { provider: blockfrost, wallet: providerWallet } = await getWallet("provider");
const providerAddress = await providerWallet.getChangeAddress();
const providerPkh = await getPaymentKeyHash(providerWallet);
const scriptAddress = getScriptAddress();
const scriptRef = loadScriptRef();

// Find the script-address output of the lock tx.
const txUtxos = await blockfrost.fetchUTxOs(lockTxHash);
const candidate = txUtxos.find((u) => u.output.address === scriptAddress);

if (!candidate) {
  throw new Error(`No script UTxO found at ${scriptAddress} in tx ${lockTxHash}. `);
}

const datumPlutus = candidate.output.plutusData;
if (!datumPlutus) throw new Error("Script UTxO has no inline datum.");

const datum = deserializeDatum<EscrowDatum>(datumPlutus);
const datumPayer = datum.fields[0].bytes;
const datumProvider = datum.fields[1].bytes;
const deadlineMs = Number(datum.fields[2].int);

if (datumProvider !== providerPkh) {
  throw new Error(`Datum provider (${datumProvider}) doesn't match wallet (${providerPkh}).`);
}

const nowMs = Date.now();
if (nowMs >= deadlineMs) {
  throw new Error(
    `Deadline already passed: now=${new Date(nowMs).toISOString()} ` +
    `deadline=${new Date(deadlineMs).toISOString()}`,
  );
}

const utxos = await providerWallet.getUtxos();
const collateral = await providerWallet.getCollateral();
if (collateral.length === 0) {
  throw new Error("Provider wallet has no collateral." );
}

// Live on-chain cost models — without these Mesh hashes script_data with a
// stale PlutusV3 model and the node rejects the tx (ScriptIntegrityHashMismatch).
const costModels = await getCostModels();

const txBuilder = new MeshTxBuilder({
  fetcher: blockfrost,
  submitter: blockfrost,
  evaluator: blockfrost,
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
  .spendingReferenceTxInRedeemerValue(mConStr0([])) // Claim = constructor 0
  .txInCollateral(
    collateral[0].input.txHash,
    collateral[0].input.outputIndex,
    collateral[0].output.amount,
    collateral[0].output.address,
  )
  .invalidHereafter(slotBeforeDeadline(deadlineMs))
  .requiredSignerHash(providerPkh)
  .changeAddress(providerAddress)
  .selectUtxosFrom(utxos)
  .setCostModels(costModels)
  .complete();

// Provider signs the claim tx (their key must satisfy `extra_signatories`).
const signedTx = await providerWallet.signTx(unsignedTx);
const txHash = await providerWallet.submitTx(signedTx);

console.log("CLAIM TX SUBMITTED");
console.log("Datum payer PKH: ", datumPayer);
console.log("Tx hash:         ", txHash);
console.log("Cardanoscan:     ", cardanoscanTxUrl(txHash));
