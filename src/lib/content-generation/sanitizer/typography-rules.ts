/** Remove colons outside URLs/links (replaced with periods). */
export function removeColons(content: string): string {
  if (!content) return content;

  const urlOrColonRe =
    /(https?:\/\/[^\s\)"<>]+|!\[[^\]]*\]\([^\)]+\)|\[[^\]]*\]\([^\)]+\)|<img[^>]*src=["']https?:\/\/[^"']+["'][^>]*>|<a[^>]*href=["']https?:\/\/[^"']+["'][^>]*>)|:/gi;
  let colonCount = 0;
  const sanitized = content.replace(urlOrColonRe, (match) => {
    if (match === ':') {
      colonCount++;
      return '.';
    }
    return match;
  });

  if (colonCount > 0) {
    console.log(
      `[Content Sanitizer] Removed ${colonCount} colon(s) from content (replaced with periods, preserved URLs)`,
    );
  }

  return sanitized;
}

/** Replace em dashes with comma and space; preserve URLs. */
export function removeEmDashes(content: string): string {
  if (!content) return content;

  const emDashPattern = / - | - /g;

  const urlPattern =
    /(https?:\/\/[^\s\)"<>]+|!\[[^\]]*\]\([^\)]+\)|\[[^\]]*\]\([^\)]+\)|<img[^>]*src=["']https?:\/\/[^"']+["'][^>]*>|<a[^>]*href=["']https?:\/\/[^"']+["'][^>]*>)/gi;
  const urlPlaceholders: string[] = [];
  let placeholderIndex = 0;

  const contentWithPlaceholders = content.replace(urlPattern, (match) => {
    const placeholder = `__URL_PLACEHOLDER_${placeholderIndex}__`;
    urlPlaceholders.push(match);
    placeholderIndex++;
    return placeholder;
  });

  const urlMatches: string[] = content.match(urlPattern) || [];
  const contentWithoutUrls = urlMatches.reduce(
    (acc: string, url: string) => acc.replace(url, ''),
    content,
  );
  const emDashCount = (contentWithoutUrls.match(emDashPattern) || []).length;

  let sanitized = contentWithPlaceholders.replace(emDashPattern, ', ');

  urlPlaceholders.forEach((url, index) => {
    sanitized = sanitized.replace(`__URL_PLACEHOLDER_${index}__`, url);
  });

  if (emDashCount > 0) {
    console.log(
      `[Content Sanitizer] Removed ${emDashCount} em dash(es) from content (replaced with comma and space, preserved URLs)`,
    );
  }

  return sanitized;
}
