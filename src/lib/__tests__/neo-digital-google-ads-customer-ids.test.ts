import { describe, expect, it } from "vitest";
import { NEO_DIGITAL_GOOGLE_ADS_CUSTOMER_IDS } from "@/lib/neo-digital-google-ads-customer-ids";

describe("NEO_DIGITAL_GOOGLE_ADS_CUSTOMER_IDS", () => {
  it("lists MCC sub-account ids by display name", () => {
    expect(NEO_DIGITAL_GOOGLE_ADS_CUSTOMER_IDS["Blind Magic"]).toBe("5619137403");
    expect(NEO_DIGITAL_GOOGLE_ADS_CUSTOMER_IDS["In the Shade"]).toBe("3177712331");
    expect(NEO_DIGITAL_GOOGLE_ADS_CUSTOMER_IDS["Advance Blinds"]).toBe("2960792256");
  });
});
