# POST `google-ads/import-search-campaigns`

Imports existing **Search** campaigns from Google Ads into PPC workspace rows (campaign structure, ad groups, keywords, RSAs, daily budget).

## Request body

```json
{
  "customerId": "4542208772"
}
```

`customerId` must be a 10-digit Google Ads customer ID (digits only or formatted with hyphens).

## Success response

```json
{
  "success": true,
  "customerId": "4542208772",
  "campaigns": [
    {
      "campaignId": "21291429280",
      "name": "Search - Example",
      "status": "PAUSED",
      "dailyBudget": 25,
      "campaign": {
        "name": "Search - Example",
        "network": "SEARCH",
        "adGroups": []
      }
    }
  ]
}
```

Campaigns with no ad groups are omitted from the list. Up to 50 Search campaigns (non-REMOVED) are returned, ordered by name.

## Errors

- `400` when customer ID is missing or invalid
- `502` (or Google Ads status) when GAQL or API calls fail

## Client

Browser calls `backendApiUrl('/google-ads/import-search-campaigns')` via `loadGoogleAdsSearchCampaignImports` in `src/lib/ppc/import-google-ads-search-campaigns.ts`. The PPC toolbar **Pull** action merges results into session-cached rows.
