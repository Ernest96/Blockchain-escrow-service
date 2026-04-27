use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval
use cardano/transaction.{OutputReference, Transaction}

/// Datum locked at the script address when funds are deposited.
///
/// `deadline` is POSIX time in milliseconds — the same unit used by
/// Cardano transaction validity ranges in Plutus V3.
pub type Datum {
  payer: VerificationKeyHash,
  provider: VerificationKeyHash,
  deadline: Int,
}

/// Two ways to spend a locked UTxO.
pub type Redeemer {
  Claim
  Refund
}

validator escrow {
  spend(
    datum_opt: Option<Datum>,
    redeemer: Redeemer,
    _own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(datum) = datum_opt
    when redeemer is {
      Claim ->
        list.has(self.extra_signatories, datum.provider) && interval.is_entirely_before(
          self.validity_range,
          datum.deadline,
        )
      Refund ->
        list.has(self.extra_signatories, datum.payer) && interval.is_entirely_after(
          self.validity_range,
          datum.deadline,
        )
    }
  }

  else(_) {
    fail
  }
}
