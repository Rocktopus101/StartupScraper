/**
 * Orchestration pipeline for StartupScraper.
 *
 * Ties together configuration, query building, search execution,
 * deduplication, and output generation into a single `runPipeline()` call.
 */

import { loadConfig, getEnv } from './config.js';
import { buildQueries, formatQueryPreview } from './query-builder.js';
import { executeQueries } from './serper-client.js';
import { executeQueriesSearXNG } from './searxng-client.js';
import { deduplicateJobs, loadSentJobs, markJobsAsSent, syncStateFromMarkdown, getPendingJobs } from './dedup.js';
import type { TieredResults } from './types.js';

// ---------------------------------------------------------------------------
// Dynamic output imports (only loaded when needed)
// ---------------------------------------------------------------------------

async function importMarkdown() {
  return import('./output/markdown.js');
}

async function importEmail() {
  return import('./output/email.js');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the full scraping pipeline end-to-end.
 *
 * @param options.configPath  - Override path to config.yaml.
 * @param options.outputMode  - Override the output mode from config.
 * @param options.dryRun      - If true, only preview queries without executing.
 * @returns The tiered results, or `null` if dry-run or no new jobs.
 */
export async function runPipeline(options: {
  configPath?: string;
  outputMode?: 'markdown' | 'email' | 'both';
  dryRun?: boolean;
}): Promise<TieredResults | null> {
  // ── 1. Load configuration ───────────────────────────────────────────
  const config = loadConfig(options.configPath);
  console.log('✅ Configuration loaded');

  // ── 1.5. Sync state from markdown ───────────────────────────────────
  syncStateFromMarkdown(config.output.markdown_dir);
  console.log('✅ Synced checkbox state from Markdown digests');

  // ── 2. Build search queries ─────────────────────────────────────────
  const queries = buildQueries(config);
  console.log(`🔍 Built ${queries.length} search queries`);

  // ── 3. Dry-run mode (no API keys needed) ────────────────────────────
  if (options.dryRun) {
    console.log('\n' + formatQueryPreview(queries));
    return null;
  }

  // ── 4. Load environment variables ───────────────────────────────────
  const env = getEnv();
  console.log('✅ Environment variables loaded');

  if (config.search.engine === 'serper' && !env.serperApiKey) {
    throw new Error(
      'SERPER_API_KEY is not set. Add it to your .env file or export it as an environment variable (required when engine is "serper").',
    );
  }

  // ── 5. Execute queries ──────────────────────────────────────────────
  console.log(`🔍 Executing search queries via ${config.search.engine}...`);
  let rawJobs;
  if (config.search.engine === 'searxng') {
    rawJobs = await executeQueriesSearXNG(
      queries,
      config.search.searxng_url,
      config.tiers.max_results_per_tier,
    );
  } else {
    rawJobs = await executeQueries(
      queries,
      env.serperApiKey!,
      config.tiers.max_results_per_tier,
    );
  }
  console.log(`🔍 Found ${rawJobs.length} total results`);

  // ── 6. Deduplicate & Merge Pending ──────────────────────────────────
  const sentJobs = loadSentJobs();
  const { newJobs, duplicatesRemoved } = deduplicateJobs(rawJobs, sentJobs);
  const pendingJobs = getPendingJobs();
  
  // Combine new jobs and pending jobs for the final output
  const activeJobs = [...newJobs, ...pendingJobs];

  console.log(
    `🔍 Dedup complete: ${newJobs.length} new, ${duplicatesRemoved} duplicates removed`,
  );
  console.log(`📝 Rolling over ${pendingJobs.length} pending jobs from previous digests`);

  // ── 7. Bail if no active jobs ───────────────────────────────────────
  if (activeJobs.length === 0) {
    console.log('⚠️  No new or pending jobs to show — skipping output.');
    return null;
  }

  // ── 8. Split into tiers & build result object ───────────────────────
  const tier1 = activeJobs.filter((j) => j.tier === 1);
  const tier2 = activeJobs.filter((j) => j.tier === 2);

  const results: TieredResults = {
    tier1,
    tier2,
    metadata: {
      totalFound: rawJobs.length,
      newJobs: newJobs.length,
      duplicatesRemoved,
      queriesExecuted: queries.length,
      timestamp: new Date().toISOString(),
    },
  };

  // ── 9. Determine output mode ───────────────────────────────────────
  const mode = options.outputMode ?? config.output.mode;

  // ── 10. Generate markdown output ───────────────────────────────────
  if (mode === 'markdown' || mode === 'both') {
    try {
      const { generateMarkdown } = await importMarkdown();
      await generateMarkdown(results, config.output.markdown_dir);
      console.log('📝 Markdown digest generated');
    } catch (error) {
      console.error('❌ Failed to generate markdown output:', error);
    }
  }

  // ── 11. Send email output ──────────────────────────────────────────
  if (mode === 'email' || mode === 'both') {
    if (!env.resendApiKey || !env.resendFromEmail) {
      console.warn(
        '⚠️  Skipping email — RESEND_API_KEY or RESEND_FROM_EMAIL not set in .env',
      );
    } else {
      try {
        const { sendDigestEmail } = await importEmail();
        await sendDigestEmail(results, config.output.email_to, {
          resendApiKey: env.resendApiKey,
          resendFromEmail: env.resendFromEmail,
        });
        console.log('📧 Email digest sent');
      } catch (error) {
        console.error('❌ Failed to send email digest:', error);
      }
    }
  }

  // ── 12. Mark new jobs as sent ──────────────────────────────────────
  markJobsAsSent(newJobs);
  console.log('✅ Marked new jobs as sent');

  // ── 13. Summary ────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  ✅ Pipeline complete');
  console.log(`     Queries executed : ${results.metadata.queriesExecuted}`);
  console.log(`     Total found      : ${results.metadata.totalFound}`);
  console.log(`     New jobs         : ${results.metadata.newJobs}`);
  console.log(`     Tier 1 (strict)  : ${tier1.length}`);
  console.log(`     Tier 2 (broad)   : ${tier2.length}`);
  console.log(`     Duplicates       : ${results.metadata.duplicatesRemoved}`);
  console.log('═══════════════════════════════════════════════════');

  // ── 14. Return results ─────────────────────────────────────────────
  return results;
}
