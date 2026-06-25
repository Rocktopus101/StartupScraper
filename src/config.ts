/**
 * Configuration loader for StartupScraper.
 *
 * - Loads environment variables from .env via dotenv
 * - Reads and validates config.yaml against a Zod schema
 * - Provides getEnv() for API keys and secrets
 */

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import type { Config } from './types.js';

// ---------------------------------------------------------------------------
// Zod schema matching the Config interface
// ---------------------------------------------------------------------------

const ConfigSchema = z.object({
  search: z.object({
    engine: z.enum(['searxng', 'serper']).default('searxng'),
    searxng_url: z.string().default('http://localhost:8080'),
    keywords: z.array(z.string()).default([]),
    seniority: z.array(z.string()).default([]),
    locations: z.array(z.string()).default([]),
    excluded: z.array(z.string()).default([]),
    domains: z.array(z.string()).min(1, 'At least one ATS domain is required'),
  }),
  output: z.object({
    mode: z.enum(['markdown', 'email', 'both']).default('markdown'),
    markdown_dir: z.string().default('output'),
    email_to: z.string().default(''),
  }),
  tiers: z.object({
    max_results_per_tier: z.number().int().positive().default(25),
  }),
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and validate the YAML configuration file.
 *
 * @param configPath - Path to config.yaml (default: `config.yaml` in cwd).
 * @returns A fully validated {@link Config} object.
 * @throws If the file doesn't exist or fails Zod validation.
 */
export function loadConfig(configPath?: string): Config {
  const resolvedPath = path.resolve(
    process.cwd(),
    configPath ?? 'config.yaml',
  );

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Configuration file not found: ${resolvedPath}\n` +
        'Create a config.yaml in the project root. See README.md for an example.',
    );
  }

  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  const parsed: unknown = parse(raw);

  const result = ConfigSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration in ${resolvedPath}:\n${issues}`);
  }

  return result.data as Config;
}

export function getEnv(): {
  serperApiKey: string | undefined;
  resendApiKey: string | undefined;
  resendFromEmail: string | undefined;
} {
  return {
    serperApiKey: process.env['SERPER_API_KEY'],
    resendApiKey: process.env['RESEND_API_KEY'],
    resendFromEmail: process.env['RESEND_FROM_EMAIL'],
  };
}
