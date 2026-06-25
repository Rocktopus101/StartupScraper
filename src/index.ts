#!/usr/bin/env node
// ============================================
// StartupScraper — CLI Entry Point
// ============================================
// Parses command-line arguments and invokes the
// scraping pipeline with the appropriate options.

import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { runPipeline } from "./pipeline.js";

type OutputMode = "markdown" | "email" | "both";

// ── Constants ──────────────────────────────────────────────────

const VERSION = "1.0.0";

const BANNER = `
╔═══════════════════════════════════════╗
║     🔍 StartupScraper v${VERSION}         ║
║     Job Search Automation Tool       ║
╚═══════════════════════════════════════╝
`;

const USAGE = `
Usage: startup-scraper [options]

Options:
  --config <path>    Path to config file (default: ./config.yaml)
  --markdown         Output markdown file only
  --email            Send email digest only
  --both             Output markdown + send email (default from config)
  --dry-run          Show constructed queries without executing
  --reset-history    Clear the deduplication history
  --help             Show this help message
`;

const HISTORY_FILE = resolve("data/sent-jobs.json");

// ── Argument parsing ───────────────────────────────────────────

interface CliArgs {
  configPath: string;
  outputMode?: OutputMode;
  dryRun: boolean;
  resetHistory: boolean;
  showHelp: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // strip node + script path

  const result: CliArgs = {
    configPath: "./config.yaml",
    dryRun: false,
    resetHistory: false,
    showHelp: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--config":
        i++;
        if (!args[i]) {
          console.error("❌ --config requires a file path argument.");
          process.exit(1);
        }
        result.configPath = args[i];
        break;

      case "--markdown":
        result.outputMode = "markdown";
        break;

      case "--email":
        result.outputMode = "email";
        break;

      case "--both":
        result.outputMode = "both";
        break;

      case "--dry-run":
        result.dryRun = true;
        break;

      case "--reset-history":
        result.resetHistory = true;
        break;

      case "--help":
      case "-h":
        result.showHelp = true;
        break;

      default:
        console.error(`❌ Unknown option: ${arg}`);
        console.log(USAGE);
        process.exit(1);
    }
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Help
  if (args.showHelp) {
    console.log(BANNER);
    console.log(USAGE);
    process.exit(0);
  }

  // Reset history
  if (args.resetHistory) {
    if (existsSync(HISTORY_FILE)) {
      unlinkSync(HISTORY_FILE);
      console.log("🗑️  Deduplication history cleared.");
    } else {
      console.log("ℹ️  No history file found — nothing to reset.");
    }
    process.exit(0);
  }

  // Print banner
  console.log(BANNER);

  // Run the pipeline
  await runPipeline({
    configPath: args.configPath,
    outputMode: args.outputMode,
    dryRun: args.dryRun,
  });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(`\n❌ StartupScraper encountered an error:\n   ${message}\n`);

    if (
      message.includes("SERPER_API_KEY") ||
      message.includes("RESEND_API_KEY")
    ) {
      console.error(
        "💡 Tip: Make sure you've copied .env.example to .env and filled in your API keys.\n",
      );
    }

    process.exit(1);
  });
