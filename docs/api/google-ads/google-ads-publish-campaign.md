# POST `/api/google-ads/publish-campaign`

Server-only Google Ads mutate that creates a paused Search campaign from the PPC generator. Browser calls this app's API only.

## Auth

- OAuth refresh token from Dashboard → Google Services → Google Ads Connect
- Developer token
- MCC ID sent as `login-customer-id` (digits only, e.g. `3937136350` from `393-713-6350`)

## Body

```json
{
  "customerId": "1234567890",
  "dailyBudget": 25,
  "campaign": {
    "name": "Search - edmonton seo",
    "network": "SEARCH",
    "adGroups": []
  }
}
```

`customerId` is the 10-digit client account on the connected property. `dailyBudget` is in the account currency (minimum 1). Campaigns are created paused with Maximize Clicks, phrase-match keywords, and responsive search ads.

## Response

```json
{
  "success": true,
  "customerId": "1234567890",
  "campaignId": "123456789",
  "campaignResourceName": "customers/1234567890/campaigns/123456789"
}
```
