/**
 * Boolean search query builder for Google dorking via Serper.
 *
 * Constructs Tier 1 (strict) and Tier 2 (broad) queries for every configured
 * ATS domain.
 */

import type { Config, SearchQuery } from './types.js';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_KEYWORDS = [
  'Software Engineer',
  'Software Developer',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
];

const DEFAULT_SENIORITY = ['Junior', 'Associate', 'Entry Level', 'New Grad'];

const DEFAULT_EXCLUDED = [
  'Senior',
  'Staff',
  'Principal',
  'Lead',
  'Manager',
  'Director',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap each term in double-quotes and join with OR. */
function orGroup(terms: string[]): string {
  return `(${terms.map((t) => `"${t}"`).join(' OR ')})`;
}

/** Build the exclusion fragment: each term prefixed with `-`. */
function excludeFragment(terms: string[]): string {
  return terms.map((t) => `-${t}`).join(' ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Low-level helper that assembles a single query string from its parts.
 * Exported for unit-testing convenience.
 */
export function buildQueryString(parts: {
  domain: string;
  keywords: string[];
  seniority?: string[];
  locations?: string[];
  excluded: string[];
}): string {
  const segments: string[] = [`site:${parts.domain}`];

  segments.push(orGroup(parts.keywords));

  if (parts.seniority && parts.seniority.length > 0) {
    segments.push(orGroup(parts.seniority));
  }

  if (parts.locations && parts.locations.length > 0) {
    segments.push(orGroup(parts.locations));
  }

  if (parts.excluded.length > 0) {
    segments.push(excludeFragment(parts.excluded));
  }

  return segments.join(' ');
}

/**
 * Build the full set of search queries from the application config.
 *
 * For each domain two queries are generated:
 * - **Tier 1 (strict)**: keywords + seniority + locations + exclusions
 * - **Tier 2 (broad)**:  keywords + exclusions only
 */
export function buildQueries(config: Config): SearchQuery[] {
  const keywords =
    config.search.keywords.length > 0
      ? config.search.keywords
      : DEFAULT_KEYWORDS;

  const seniority =
    config.search.seniority.length > 0
      ? config.search.seniority
      : DEFAULT_SENIORITY;

  const excluded =
    config.search.excluded.length > 0
      ? config.search.excluded
      : DEFAULT_EXCLUDED;

  // Locations: only add filter when explicitly provided
  const locations =
    config.search.locations.length > 0 ? config.search.locations : undefined;

  const queries: SearchQuery[] = [];

  for (const domain of config.search.domains) {
    // Tier 1 — strict
    queries.push({
      query: buildQueryString({
        domain,
        keywords,
        seniority,
        locations,
        excluded,
      }),
      tier: 1,
      domain,
    });

    // Tier 2 — broad (no seniority / location filters)
    queries.push({
      query: buildQueryString({
        domain,
        keywords,
        excluded,
      }),
      tier: 2,
      domain,
    });
  }

  return queries;
}

/**
 * Return a human-readable preview of all queries, grouped by tier.
 * Used for the `--dry-run` output.
 */
export function formatQueryPreview(queries: SearchQuery[]): string {
  const tier1 = queries.filter((q) => q.tier === 1);
  const tier2 = queries.filter((q) => q.tier === 2);

  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════');
  lines.push('  Query Preview (dry-run)');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');

  lines.push(`── Tier 1: Strict (${tier1.length} queries) ──`);
  for (const q of tier1) {
    lines.push(`  [${q.domain}]`);
    lines.push(`    ${q.query}`);
    lines.push('');
  }

  lines.push(`── Tier 2: Broad (${tier2.length} queries) ──`);
  for (const q of tier2) {
    lines.push(`  [${q.domain}]`);
    lines.push(`    ${q.query}`);
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════');
  lines.push(`  Total queries: ${queries.length}`);
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}
