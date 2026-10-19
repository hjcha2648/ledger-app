from pydantic import BaseModel


class Summary(BaseModel):
    income_krw: int
    expense_krw: int
    balance_krw: int


class CategoryExpense(BaseModel):
    category_id: int
    name: str
    amount_krw: int


class MonthlyCompare(BaseModel):
    month: str  # YYYY-MM
    income_krw: int
    expense_krw: int


class DashboardResponse(BaseModel):
    month: str
    summary: Summary
    expense_by_category: list[CategoryExpense]
    monthly_compare: list[MonthlyCompare]
