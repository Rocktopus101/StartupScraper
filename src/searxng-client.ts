/**
 * SearXNG client for executing Google dork searches via a self-hosted instance.
 *
 * SearXNG is a free, open-source meta-search engine that aggregates results
 * from Google, Bing, DuckDuckGo, and others. Run it locally via Docker:
 *
 *   docker run -d -p 8080:8080 searxng/searxng
 *
 * Then point this client at http://localhost:8080.
 */

import type { Job, SearchQuery, SerperResult } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearXNGResult {
  title: string;
  url: string;
  content: string; // snippet
  engine: string;
  score?: number;
  positions?: number[];
}

interface SearXNGResponse {
  results: SearXNGResult[];
  number_of_results: number;
  query: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_DELAY_MS = 500; // be gentler with self-hosted instance

/** Sleep for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a single search query against a SearXNG instance.
 *
 * @param query      - The full Boolean search string.
 * @param baseUrl    - SearXNG instance URL (e.g. http://localhost:8080).
 * @param numResults - Maximum results to request (default 10).
 * @returns An array of results mapped to SerperResult format.
 */
export async function searchSearXNG(
  query: string,
  baseUrl: string,
  numResults: number = 10,
): Promise<SerperResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      categories: 'general',
      language: 'en',
      pageno: '1',
    });

    const url = `${baseUrl.replace(/\/+$/, '')}/search?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(no body)');
      console.error(
        `❌ SearXNG error ${response.status}: ${response.statusText} — ${body}`,
      );
      return [];
    }

    const data = (await response.json()) as SearXNGResponse;

    // Respect rate limits for upstream engines
    await sleep(RATE_LIMIT_DELAY_MS);

    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    // Map SearXNG results to our standard format, capped at numResults
    return data.results.slice(0, numResults).map((r, idx) => ({
      title: r.title ?? '(untitled)',
      link: r.url,
      snippet: r.content ?? '',
      position: r.positions?.[0] ?? idx + 1,
    }));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed'))
    ) {
      console.error(
        '❌ Could not connect to SearXNG. Is it running?\n' +
        '   Start it with: docker run -d -p 8080:8080 searxng/searxng\n',
      );
    } else {
      console.error('❌ SearXNG request failed:', error);
    }
    return [];
  }
}

/**
 * Run all search queries via SearXNG and aggregate into a flat `Job[]`.
 *
 * Results per tier are capped at `maxPerTier`.
 */
export async function executeQueriesSearXNG(
  queries: SearchQuery[],
  baseUrl: string,
  maxPerTier: number,
): Promise<Job[]> {
  const allJobs: Job[] = [];
  const tierCounts: Record<number, number> = { 1: 0, 2: 0 };

  for (const sq of queries) {
    // Skip if this tier is already full
    if (tierCounts[sq.tier]! >= maxPerTier) {
      continue;
    }

    const results = await searchSearXNG(sq.query, baseUrl);

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
