import { EXPENSE_CATEGORIES } from "@domain/categories.ts";
import { parseAmount } from "@domain/money.ts";
import { pieMarkup } from "./pie.ts";

type Slice = { category: string; amount: string };
type Step = "home" | "categories" | "amount" | "deposit" | "history";
type Tab = "home" | "reports";
type Preset = "month" | "quarter" | "year";

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  Rent: "Обязательные платежи",
  Groceries: "Продукты",
  Household: "Быт",
  Gifts: "Подарки",
  "Restaurants & Cafés": "Рестораны и кафе",
  Transport: "Транспорт",
  Entertainment: "Развлечения",
  Miscellaneous: "Прочее",
  travel: "Путешествие",
  income: "Доход",
};

// FULL CONTENT WILL BE REPLACED - this is a placeholder to test the update path
console.log('restore needed');
