/**
 * Serper.dev API client for executing Google dork searches.
 *
 * Uses the native `fetch` API (Node 18+).
 */

import type { Job, SearchQuery, SerperResponse, SerperResult } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SERPER_ENDPOINT = 'https://google.serper.dev/search';
const RATE_LIMIT_DELAY_MS = 150;

/** Sleep for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a single search query against the Serper API.
 *
 * @param query      - The full Boolean search string.
 * @param apiKey     - Serper API key.
 * @param numResults - Maximum results to request (default 10).
 * @returns An array of organic results (may be empty on error).
 */
export async function searchSerper(
  query: string,
  apiKey: string,
  timeRange: 'day' | 'week' | 'month' | 'year' | 'all' = 'all',
  numResults: number = 10,
): Promise<SerperResult[]> {
  try {
    const payload: Record<string, any> = {
      q: query,
      gl: 'us',
      hl: 'en',
      num: numResults,
    };

    if (timeRange !== 'all') {
      const map: Record<string, string> = {
        day: 'qdr:d',
        week: 'qdr:w',
        month: 'qdr:m',
        year: 'qdr:y',
      };
      payload.tbs = map[timeRange];
    }

    const response = await fetch(SERPER_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(no body)');
      console.error(
        `❌ Serper API error ${response.status}: ${response.statusText} — ${body}`,
      );
      return [];
    }

    const data = (await response.json()) as SerperResponse;

    // Respect rate limits
    await sleep(RATE_LIMIT_DELAY_MS);

    if (!data.organic || !Array.isArray(data.organic)) {
      return [];
    }

    return data.organic.map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      position: r.position,
    }));
  } catch (error) {
    console.error('❌ Serper request failed:', error);
    return [];
  }
}

/**
 * Run all search queries and aggregate the results into a flat `Job[]`.
 *
 * Results per tier are capped at `maxPerTier`.
 *
 * @param queries    - The full list of search queries to execute.
 * @param apiKey     - Serper API key.
 * @param maxPerTier - Maximum number of results to keep per tier.
 * @returns Combined array of `Job` objects from all queries.
 */
export async function executeQueries(
  queries: SearchQuery[],
  apiKey: string,
  timeRange: 'day' | 'week' | 'month' | 'year' | 'all',
  maxPerTier: number,
): Promise<Job[]> {
  const allJobs: Job[] = [];

  // Track how many results we've accumulated for each tier so we can cap.
  const tierCounts: Record<number, number> = { 1: 0, 2: 0 };

  for (const sq of queries) {
    // Skip if this tier is already full
    if (tierCounts[sq.tier]! >= maxPerTier) {
      continue;
    }

    const results = await searchSerper(sq.query, apiKey, timeRange);

    console.log(
      `🔍 [Tier ${sq.tier}] Searching ${sq.domain}... found ${results.length} results`,
    );

    for (const result of results) {
      if (tierCounts[sq.tier]! >= maxPerTier) {
        break;
      }

      allJobs.push({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        position: result.position,
        domain: sq.domain,
        tier: sq.tier,
      });

      tierCounts[sq.tier]!++;
    }
  }

  return allJobs;
}
