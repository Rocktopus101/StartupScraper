/**
 * Shared types and interfaces for the StartupScraper CLI tool.
 */

/** A single job listing scraped from an ATS platform. */
export interface Job {
  title: string;
  link: string;
  snippet: string;
  position: number;
  /** The ATS domain this job was found on, e.g. 'jobs.ashbyhq.com' */
  domain: string;
  /** Tier 1 = strict (keyword + seniority + location), Tier 2 = broad (keyword only) */
  tier: 1 | 2;
}

/** Final pipeline output with jobs split by tier and run metadata. */
export interface TieredResults {
  tier1: Job[];
  tier2: Job[];
  metadata: {
    totalFound: number;
    newJobs: number;
    duplicatesRemoved: number;
    queriesExecuted: number;
    timestamp: string;
  };
}

/** A single Boolean search query to execute against Serper. */
export interface SearchQuery {
  query: string;
  tier: 1 | 2;
  domain: string;
}

/** A single organic result returned by the Serper API. */
export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

/** Raw JSON response from the Serper /search endpoint. */
export interface SerperResponse {
  organic: SerperResult[];
  searchParameters?: {
    q: string;
    gl: string;
    hl: string;
    num: number;
  };
}

export interface SentJob {
  url: string;
  title: string;
  sentAt: string;
  status: 'pending' | 'checked';
  domain: string;
  tier: 1 | 2;
  snippet: string;
  position: number;
}

/** Validated application configuration loaded from config.yaml. */
export interface Config {
  search: {
    engine: 'searxng' | 'serper';
    searxng_url: string;
    keywords: string[];
    seniority: string[];
    locations: string[];
    excluded: string[];
    domains: string[];
  };
  output: {
    mode: 'markdown' | 'email' | 'both';
    markdown_dir: string;
    email_to: string;
  };
  tiers: {
    max_results_per_tier: number;
  };
}
