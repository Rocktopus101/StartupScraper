# 🔍 StartupScraper

> Open-source CLI tool that automates job scraping via Google dorking and delivers daily digests as Markdown files or email.

StartupScraper uses Boolean search queries (Google X-Ray technique) to find job listings across major ATS platforms like Greenhouse, Lever, Ashby, Workday, and more. It deduplicates results so you only see new listings, and outputs them in a clean tiered format.

---

## ✨ Features

- **Google Dorking** — Constructs advanced Boolean search queries targeting 10+ ATS platforms
- **Tiered Results** — Tier 1 (exact matches) and Tier 2 (broader matches) for prioritized viewing
- **Deduplication** — Tracks sent jobs locally so you never see the same listing twice
- **Markdown Output** — Clean `.md` digest files you can read anywhere
- **Email Digests** — Beautiful HTML email delivery via [Resend](https://resend.com)
- **Configurable** — YAML config for keywords, locations, seniority, excluded terms
- **Open Source** — Bring your own API keys, run it yourself

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Details |
|-------------|---------|
| **Node.js** | v18 or later |
| **Search Engine** | [SearXNG](https://github.com/searxng/searxng) (free, unlimited via Docker) **OR** [Serper API](https://serper.dev) (2,500 free searches) |
| **Resend API Key** | Free tier: 100 emails/day — [Get one →](https://resend.com) *(only if using email output)* |

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/StartupScraper.git
cd StartupScraper

# Install dependencies
npm install

# Start the local SearXNG search engine
docker compose up -d

# Set up your environment variables
cp .env.example .env
# Edit .env and add your Resend API key (if using email output)
```

### Configure Your Search

Open `config.yaml` and customize your search filters:

```yaml
search:
  keywords:
    - "Software Engineer"
    - "Frontend Engineer"
  seniority:
    - "Junior"
    - "New Grad"
  locations:
    - "Remote"
    - "New York"
```

### Run It

```bash
# Run with default settings (uses config.yaml)
npm start

# Development mode (no build step needed)
npm run dev

# Preview queries without making API calls
npm run dry-run
```

---

## 🖥️ Usage

```
Usage: startup-scraper [options]

Options:
  --config <path>    Path to config file (default: ./config.yaml)
  --markdown         Output markdown file only
  --email            Send email digest only
  --both             Output markdown + send email (default from config)
  --dry-run          Show constructed queries without executing
  --reset-history    Clear the deduplication history
  --help             Show this help message
```

### Examples

```bash
# Generate a Markdown digest only
npx tsx src/index.ts --markdown

# Send an email digest only
npx tsx src/index.ts --email

# Use a custom config file
npx tsx src/index.ts --config ./my-config.yaml

# Preview the Google dork queries that would be sent
npx tsx src/index.ts --dry-run

# Clear seen jobs to re-receive everything
npx tsx src/index.ts --reset-history

# Build and run the compiled version
npm run build
node dist/index.js --both
```

---

## ⚙️ Configuration

The `config.yaml` file controls all search behavior and output preferences.

### `search` — Search Filters

| Field | Type | Description |
|-------|------|-------------|
| `engine` | `string` | Search engine to use: `"searxng"` or `"serper"` |
| `searxng_url` | `string` | URL to your local SearXNG instance (if using searxng) |
| `keywords` | `string[]` | Job title keywords, combined with OR (e.g., `"Software Engineer"`) |
| `seniority` | `string[]` | Seniority-level terms for Tier 1 filtering (e.g., `"Junior"`, `"New Grad"`) |
| `locations` | `string[]` | Location terms for Tier 1 filtering (e.g., `"Remote"`, `"NYC"`) |
| `excluded` | `string[]` | Terms to exclude from all results (e.g., `"Senior"`, `"Staff"`) |
| `domains` | `string[]` | ATS platform domains to target with `site:` queries |

### `output` — Output Settings

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `string` | Output mode: `"markdown"`, `"email"`, or `"both"` |
| `markdown_dir` | `string` | Directory for Markdown digest files (default: `./output`) |
| `email_to` | `string` | Recipient email address for digest delivery |

### `tiers` — Tier Configuration

| Field | Type | Description |
|-------|------|-------------|
| `max_results_per_tier` | `number` | Maximum results to fetch per tier across all domains |

---

## 📋 Supported ATS Platforms

StartupScraper targets these major Applicant Tracking Systems out of the box:

| Platform | Domain | Notes |
|----------|--------|-------|
| **Ashby HQ** | `jobs.ashbyhq.com` | Popular with YC startups |
| **Greenhouse** | `boards.greenhouse.io` | Most widely used ATS |
| **Lever** | `jobs.lever.co` | Common in mid-size startups |
| **iCIMS** | `careers.icims.com` | Enterprise-grade ATS |
| **Jobvite** | `jobs.jobvite.com` | Mid-market ATS |
| **Workday** | `wd1.myworkdayjobs.com` | Enterprise / Fortune 500 |
| **BambooHR** | `jobs.bamboohr.com` | SMB-focused HR platform |
| **SmartRecruiters** | `jobs.smartrecruiters.com` | Global enterprise ATS |
| **JazzHR** | `apply.jazz.co` | SMB recruiting software |
| **Workable** | `careers.workable.com` | Popular hiring platform |

> 💡 **Tip:** You can add any domain to the `domains` list in `config.yaml` to target additional platforms.

---

## 🔄 Automating with Cron

Run StartupScraper daily with a cron job to get fresh listings every morning.

### macOS / Linux

```bash
# Open your crontab
crontab -e

# Add this line to run every day at 8:00 AM
0 8 * * * cd /path/to/StartupScraper && /usr/local/bin/node dist/index.js >> /tmp/startup-scraper.log 2>&1
```

### Using `launchd` on macOS

Create `~/Library/LaunchAgents/com.startupscraper.daily.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.startupscraper.daily</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/StartupScraper/dist/index.js</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>8</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>WorkingDirectory</key>
  <string>/path/to/StartupScraper</string>
  <key>StandardOutPath</key>
  <string>/tmp/startup-scraper.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/startup-scraper-error.log</string>
</dict>
</plist>
```

Then load it:

```bash
launchctl load ~/Library/LaunchAgents/com.startupscraper.daily.plist
```

---

## 🏗️ How It Works

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐
│  config.yaml │───▶│ Query Builder │───▶│ Search Engine│───▶│ Dedup      │
│  .env        │    │ (Google Dork) │    │(SearXNG/Serper)│  │ (History)  │
└─────────────┘    └──────────────┘    └──────────────┘    └─────┬──────┘
                                                                 │
                                                                 ▼
                                                          ┌──────────────┐
                                                          │ Tiered       │
                                                          │ Results      │
                                                          └──────┬───────┘
                                                                 │
                                              ┌──────────────────┼──────────────────┐
                                              ▼                                      ▼
                                       ┌──────────────┐                       ┌──────────────┐
                                       │ Markdown     │                       │ Email        │
                                       │ Generator    │                       │ (Resend)     │
                                       └──────────────┘                       └──────────────┘
```

1. **Config Loading** — Reads `config.yaml` and validates with Zod schemas
2. **Query Construction** — Builds Google dork queries per domain, per tier
   - **Tier 1**: `site:domain.com (keyword OR keyword) (seniority) (location) -excluded`
   - **Tier 2**: `site:domain.com (keyword OR keyword) -excluded` (no seniority/location filter)
3. **Search Execution** — Sends queries to the chosen search engine:
   - **SearXNG**: Unlimited free searches via local Docker instance (`docker compose up -d`)
   - **Serper API**: Uses Google search results via API key
4. **Deduplication** — Filters out jobs already seen (stored in `data/sent-jobs.json`)
5. **Output** — Generates Markdown file and/or sends HTML email digest

---

## 📁 Project Structure

```
StartupScraper/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── pipeline.ts       # Main orchestration pipeline
│   ├── config.ts         # YAML config loader + Zod validation
│   ├── types.ts          # Shared TypeScript types
│   ├── query/            # Google dork query builders
│   ├── search/           # Serper API client
│   ├── dedup/            # Deduplication logic
│   └── output/
│       ├── markdown.ts   # Markdown digest generator
│       └── email.ts      # Resend email sender
├── config.yaml           # Search configuration
├── .env.example          # API key template
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -am 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  Built with ☕ and Boolean operators<br>
  <strong>Star ⭐ this repo if you find it useful!</strong>
</p>
