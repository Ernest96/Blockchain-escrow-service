use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval
use cardano/transaction.{OutputReference, Transaction}

pub type Datum {
  payer: VerificationKeyHash,
  provider: VerificationKeyHash,
  deadline: Int,
}

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
