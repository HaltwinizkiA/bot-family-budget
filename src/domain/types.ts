export type Cents = number;

export type Ymd = {
  year: number;
  month: number;
  day: number;
};

export type ExpenseCategory =
  | "Rent"
  | "Groceries"
  | "Household"
  | "Gifts"
  | "Restaurants & Cafés"
  | "Transport"
  | "Entertainment"
  | "Miscellaneous";

export type Category = ExpenseCategory | "income";

export type StoredRow = {
  id: number;
  dateIso: string;
  sumCents: Cents;
  category: string;
  comment: string;
  createdBy: string;
  balanceCents: Cents;
};

export type DateRange = {
  from: Ymd;
  to: Ymd;
};
