/**
 * Neo Digital MCC sub-account IDs (reference for Integrations / bulk import).
 * Reporting does not infer IDs from this map; set googleAdsCustomerId on each property.
 */
export const NEO_DIGITAL_GOOGLE_ADS_CUSTOMER_IDS: Readonly<Record<string, string>> = {
  "Advance Blinds": "2960792256",
  "Blind Magic": "5619137403",
  "Blind Spot": "7454061453",
  "Shutter Spot": "7454061453",
  "Blinds West": "5889119713",
  "DM Interiors": "9440085146",
  "In the Shade": "3177712331",
  "Interiors by Laura": "8948662247",
  "Lindsey Blinds": "7933269170",
  "Neo Digital": "4542208772",
  "Superior Blinds": "7543287148",
  "Superior Tent Rentals": "4884118190",
  "Westhillhurst Paint": "8878304813",
  "You Junk It": "6293305294",
};

/** Not linked under Neo Digital MCC; API login-customer-id is the client id itself. */
export const GOOGLE_ADS_DIRECT_LOGIN_CUSTOMER_IDS: Readonly<string[]> = ["2960792256"];

export const IN_THE_SHADE_GOOGLE_ADS_CUSTOMER_ID = "3177712331";
