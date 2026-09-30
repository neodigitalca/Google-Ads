# POST /api/google-ads/fetch-campaign-insights

Campaign-scoped Google Ads performance for PPC Optimizer (daily series, summary, keywords, search terms, ad groups).

## Request body

```json
{
  "customerId": "4542208772",
  "campaignId": "24285562940",
  "startDate": "2026-02-24",
  "endDate": "2026-03-25",
  "compareStartDate": "2026-01-25",
  "compareEndDate": "2026-02-23"
}
```

- `customerId` (required, 10-digit)
- `campaignId` (required, numeric Google Ads campaign ID)
- `startDate`, `endDate` (required, `Y-m-d`)
- `compareStartDate`, `compareEndDate` (optional; when both valid, response includes `compareSummary`)

## Response

```json
{
  "success": true,
  "customerId": "4542208772",
  "campaignId": "24285562940",
  "startDate": "2026-02-24",
  "endDate": "2026-03-25",
  "summary": {
    "impressions": 0,
    "clicks": 0,
    "costMicros": 0,
    "ctr": 0,
    "averageCpc": 0,
    "conversions": 0,
    "conversionsValue": 0
  },
  "dailySeries": [],
  "adGroupDailySeriesById": {
    "12345678901": [
      {
        "date": "2026-02-24",
        "impressions": 10,
        "clicks": 1,
        "costMicros": 500000,
        "conversions": 0,
        "conversionsValue": 0
      }
    ]
  },
  "keywordDailySeriesByKey": {
    "12345678901|edmonton seo": []
  },
  "keywords": [],
  "searchTerms": [],
  "adGroups": [],
  "recommendations": [
    {
      "type": "CAMPAIGN_BUDGET",
      "resourceName": "customers/4542208772/recommendations/999",
      "title": "Campaign budget",
      "detail": "Suggested daily budget $30.00",
      "impact": { "baseClicks": 0, "potentialClicks": 12, "baseCostMicros": 0 }
    }
  ]
}
```

On failure: `{ "success": false, "error": "..." }` with HTTP 4xx/5xx.
