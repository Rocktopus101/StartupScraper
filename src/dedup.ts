/**
 * Local JSON-based deduplication for StartupScraper.
 *
 * Maintains a `data/sent-jobs.json` file that tracks every job URL we've
 * already included in a digest. Entries older than 30 days are automatically
 * pruned on load.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Job, SentJob } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SENT_JOBS_PATH = path.resolve(process.cwd(), 'data', 'sent-jobs.json');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Tracking parameters that should be stripped when comparing URLs. */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'ref',
  'source',
  'gh_jid',
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a URL for reliable comparison:
 * - Lowercase
 * - Strip trailing slashes
 * - Remove common tracking query parameters
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.toLowerCase());

    // Remove tracking params
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // Rebuild without trailing slash on pathname
    let normalized = `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;

    // Re-append remaining query string (if any)
    const qs = parsed.searchParams.toString();
    if (qs) {
      normalized += `?${qs}`;
    }

    return normalized;
  } catch {
    // If parsing fails, do basic normalization
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Load previously-sent jobs from disk.
 *
 * - Returns an empty array if the file doesn't exist.
 * - Automatically prunes entries older than 30 days.
 */
export function loadSentJobs(): SentJob[] {
  if (!fs.existsSync(SENT_JOBS_PATH)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(SENT_JOBS_PATH, 'utf-8');
    const jobs: SentJob[] = JSON.parse(raw);

    // Prune entries older than 30 days
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return jobs.filter((j) => new Date(j.sentAt).getTime() > cutoff);
  } catch {
    console.warn('⚠️  Could not parse sent-jobs.json — starting fresh.');
    return [];
  }
}

/**
 * Persist the sent-jobs array to disk with pretty-printed JSON.
 * Creates the `data/` directory if it doesn't exist.
 */
export function saveSentJobs(jobs: SentJob[]): void {
  const dir = path.dirname(SENT_JOBS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SENT_JOBS_PATH, JSON.stringify(jobs, null, 2), 'utf-8');
}

/**
 * Deduplicate a batch of jobs against the historical sent-jobs list and
 * within the batch itself (same URL in both Tier 1 and Tier 2 — keep Tier 1).
 *
 * @returns The filtered list of genuinely new jobs and a count of duplicates.
 */
export function deduplicateJobs(
  jobs: Job[],
  sentJobs: SentJob[],
): { newJobs: Job[]; duplicatesRemoved: number } {
  // Build a set of already-sent normalized URLs
  const sentUrls = new Set(sentJobs.map((j) => normalizeUrl(j.url)));

  // First pass: remove jobs we've already sent
  const unsent = jobs.filter((j) => !sentUrls.has(normalizeUrl(j.link)));

  // Second pass: deduplicate within the current batch.
  // If a URL appears in both Tier 1 and Tier 2, keep the Tier 1 version.
  const seen = new Map<string, Job>();

  for (const job of unsent) {
    const normalized = normalizeUrl(job.link);
    const existing = seen.get(normalized);

    if (!existing) {
      seen.set(normalized, job);
    } else if (job.tier < existing.tier) {
      // Lower tier number = higher priority (Tier 1 > Tier 2)
      seen.set(normalized, job);
    }
    // Otherwise keep the existing (earlier / higher-priority) entry
  }

  const newJobs = Array.from(seen.values());
  const duplicatesRemoved = jobs.length - newJobs.length;

  return { newJobs, duplicatesRemoved };
}

/**
 * Record the given jobs as sent so they won't appear in future digests.
 */
export function markJobsAsSent(jobs: Job[]): void {
  const existing = loadSentJobs();

  const newEntries: SentJob[] = jobs.map((j) => ({
    url: j.link,
    title: j.title,
    sentAt: new Date().toISOString(),
  }));

  saveSentJobs([...existing, ...newEntries]);
}
