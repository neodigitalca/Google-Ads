# POST /api/google-ads/fetch-ppc-research-signals

Aggregates PPC research signals for Generate (Google Ads GAQL, DataForSEO Labs, Google Ads Keywords Data, SERP paid ads, plus client GSC queries).

## Request body

```json
{
  "customerId": "4542208772",
  "focusKeyword": "edmonton seo",
  "landingPageUrls": ["https://example.com/edmonton-seo/"],
  "locationName": "Canada",
  "languageCode": "en",
  "gscQueries": [{ "text": "edmonton seo", "clicks": 12, "impressions": 400 }]
}
```

- `focusKeyword` (required)
- `customerId` (optional, 10-digit Google Ads customer ID when OAuth is connected)
- `gscQueries` (optional; supplied from Generate after GSC load)

## Response

```json
{
  "success": true,
  "signals": {
    "focusKeyword": "edmonton seo",
    "locationName": "Canada",
    "languageCode": "en",
    "landingPageUrls": [],
    "gscQueries": [],
    "dfsKeywordIdeas": [],
    "dfsGoogleAdsKeywords": [],
    "accountKeywords": [],
    "accountSearchTerms": [],
    "serpPaidAds": []
  }
}
```

On failure: `{ "success": false, "error": "..." }` with HTTP 4xx/5xx.
