export type Currency = "SYP" | "USD";

export const CURRENCIES: Currency[] = ["SYP", "USD"];

export const currencyLabel: Record<Currency, string> = {
  SYP: "ل.س",
  USD: "$",
};

export const currencyName: Record<Currency, string> = {
  SYP: "الليرة السورية",
  USD: "الدولار الأمريكي",
};

export function formatMoney(amount: number, currency: Currency) {
  return `${Number(amount || 0).toLocaleString("ar")} ${currencyLabel[currency]}`;
}

export function asCurrency(value: unknown): Currency {
  return value === "USD" ? "USD" : "SYP";
}
