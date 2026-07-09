from pydantic import BaseModel, Field


class VerifyIosTransactionRequest(BaseModel):
    """StoreKit transaction id after purchase or restore."""

    transaction_id: str = Field(..., alias="transactionId", min_length=1)

    class Config:
        populate_by_name = True


class RestoreIosTransactionsRequest(BaseModel):
    """Transaction ids from StoreKit restore / active subscriptions."""

    transaction_ids: list[str] = Field(..., alias="transactionIds", min_length=1)

    class Config:
        populate_by_name = True


class AppleNotificationRequest(BaseModel):
    """App Store Server Notifications V2 body."""

    signed_payload: str = Field(..., alias="signedPayload")

    class Config:
        populate_by_name = True
