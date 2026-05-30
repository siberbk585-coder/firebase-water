import "server-only";

import { getSystemSettings } from "./settings";
import { normalizeVatPercent } from "./vat";

/** % thuế GTGT đang áp dụng (vd. 10 = 10%) — chỉ gọi trên server. */
export async function getVatPercent(): Promise<number> {
  const settings = await getSystemSettings();
  return normalizeVatPercent(settings.vatPercent);
}
