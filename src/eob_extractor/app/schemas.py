from pydantic import BaseModel
from typing import List, Optional


class Adjustment(BaseModel):
    code: Optional[str]
    amount: Optional[float]


class ServiceLine(BaseModel):
    procedure_code: Optional[str]
    billed_amount: Optional[float]
    paid_amount: Optional[float]
    adjustments: List[Adjustment] = []


class Claim(BaseModel):
    claim_number: Optional[str]
    patient_name: Optional[str]
    member_id: Optional[str]

    billed_amount: Optional[float]
    allowed_amount: Optional[float]
    paid_amount: Optional[float]

    service_lines: List[ServiceLine] = []


class EOBDocument(BaseModel):
    payer_name: Optional[str]
    payment_date: Optional[str]
    check_number: Optional[str]

    claims: List[Claim]
