/** Enum nghiệp vụ — tương thích Prisma $Enums và Data Connect. */

export const UserRole = {
  RESIDENT: "RESIDENT",
  ADMIN: "ADMIN",
  COLLECTOR: "COLLECTOR",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ReadingStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
} as const;
export type ReadingStatus = (typeof ReadingStatus)[keyof typeof ReadingStatus];

export const InputMethod = {
  OCR_CONFIRMED: "OCR_CONFIRMED",
  OCR_EDITED: "OCR_EDITED",
  MANUAL: "MANUAL",
} as const;
export type InputMethod = (typeof InputMethod)[keyof typeof InputMethod];

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PeriodStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;
export type PeriodStatus = (typeof PeriodStatus)[keyof typeof PeriodStatus];

export const HouseholdStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type HouseholdStatus = (typeof HouseholdStatus)[keyof typeof HouseholdStatus];

export const PaymentMethod = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
