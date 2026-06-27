# StartupScraper

A command-line tool that automates job hunting. It uses Google Dorking (advanced search operators) to scrape job boards like Greenhouse, Lever, and Ashby, and delivers a clean daily digest of **new** jobs directly to you.

It's entirely free to run. It uses [SearXNG](https://github.com/searxng/searxng) (an open-source search engine) locally so you never hit API limits.

---

## Core Features

* **Smart Deduplication**: Automatically tracks which jobs you've already seen. It saves state locally in `data/sent-jobs.json` so you never get pinged for the same job twice. Old records are auto-pruned after 30 days.
* **Tiered Prioritization**: Groups results into Tier 1 (exact keyword + seniority + location match) and Tier 2 (broader keyword matches).
* **Zero-Cost Scraping**: Uses a self-hosted SearXNG Docker container by default, completely bypassing Google API limits or rate-blocking.
* **Interactive TODO Lists**: The generated markdown files use standard checkboxes. If you check off a job (`- [x]`), it never appears again. If you leave it unchecked (`- [ ]`), it automatically rolls over into your next daily digest!
* **Tracking Stripper**: Automatically strips tracking parameters (`utm_source`, `gh_jid`, etc.) from URLs before deduplicating, preventing duplicate jobs that have different referral codes.

---

## Getting Started

You need **Node.js** (v18+) and **Docker** installed.

### 1. Clone & Install
```bash
git clone https://github.com/Rocktopus101/StartupScraper.git
cd StartupScraper
npm install
```

### 2. Run the Scraper
```bash
# This automatically starts Docker, runs the scraper, saves the markdown file, and stops Docker.
npm run scrape
```
The results will be saved to an `output/` folder as a clean Markdown file.

---

## Customizing Your Job Search

All your search preferences live in **`config.yaml`**. Open it up to configure exactly what you're looking for:

```yaml
search:
  # The job titles you want (e.g. "Software Engineer")
  keywords: ["Software Engineer", "Frontend Developer"]
  
  # Your level (used for strict matching)
  seniority: ["Junior", "Entry Level", "New Grad"]
  
  # Where you want to work
  locations: ["Remote", "New York"]
  
  # Words that disqualify a job
  excluded: ["Senior", "Staff", "Principal", "Manager"]
```

### How it matches jobs:
StartupScraper organizes results into two tiers:
* **Tier 1 (Strict)**: Matches your `keywords` + `seniority` + `locations` exactly.
* **Tier 2 (Broad)**: Matches your `keywords` anywhere in the US (helpful for un-tagged remote jobs).
* *Everything* filters out the `excluded` terms.

---

## Setting Up Email Digests (Optional)

By default, jobs are saved as Markdown files. If you want them emailed to you automatically:

1. Sign up for a free [Resend](https://resend.com) API key.
2. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
3. Add your `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to the `.env` file.
4. Update `config.yaml` to set `mode: "email"` (or `"both"`) and set your `email_to` address.

---

## Automating with Cron (Daily Digests)

You probably want this to run every morning automatically. 

**On macOS / Linux**, open your crontab:
```bash
crontab -e
```
Add this line to run the scraper every day at 8:00 AM:
```bash
0 8 * * * cd /path/to/StartupScraper && /usr/local/bin/npm run scrape >> /tmp/startup-scraper.log 2>&1
```
*(Make sure to replace `/path/to/StartupScraper` with the actual path on your machine).*

---

## Supported Job Boards

StartupScraper targets these Applicant Tracking Systems (ATS) out of the box:
* Ashby (`jobs.ashbyhq.com`)
* Greenhouse (`boards.greenhouse.io`)
* Lever (`jobs.lever.co`)
* Workday (`wd1.myworkdayjobs.com`)
* iCIMS (`careers.icims.com`)
* Jobvite, BambooHR, SmartRecruiters, JazzHR, and Workable.

You can easily add more by editing the `domains` list in `config.yaml`.

---

## License
MIT License.
