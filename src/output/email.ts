// ============================================
// StartupScraper — Email Digest Sender
// ============================================
// Sends a styled HTML email digest of tiered job
// results using the Resend email API.

import { Resend } from "resend";
import type { TieredResults, Job } from "../types.js";
import { prettifyDomain } from "./markdown.js";

// ── HTML builder helpers ───────────────────────────────────────

/** Group an array of jobs by their `domain` property. */
function groupByDomain(jobs: Job[]): Map<string, Job[]> {
  const map = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = job.domain ?? "unknown";
    const existing = map.get(key);
    if (existing) {
      existing.push(job);
    } else {
      map.set(key, [job]);
    }
  }
  return map;
}

/** Escape HTML special characters to prevent injection. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render a tier section of job listings as HTML. */
function renderTierHtml(
  jobs: Job[],
  tierLabel: string,
  tierDescription: string,
  badgeColor: string,
): string {
  const badge = `<span style="display:inline-block;background:${badgeColor};color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;margin-left:8px;">${jobs.length} jobs</span>`;

  if (jobs.length === 0) {
    return `
      <div style="margin-bottom:32px;">
        <h2 style="margin:0 0 4px 0;font-size:20px;color:#1a1a2e;">${tierLabel} ${badge}</h2>
        <p style="margin:0 0 16px 0;color:#666;font-size:14px;">${tierDescription}</p>
        <p style="color:#999;font-style:italic;font-size:14px;">No results in this tier.</p>
      </div>
    `;
  }

  const grouped = groupByDomain(jobs);
  let domainSections = "";

  for (const [domain, domainJobs] of grouped) {
    const rows = domainJobs
      .map(
        (job, idx) => `
        <tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:10px 12px;color:#888;font-size:13px;width:30px;">${idx + 1}</td>
          <td style="padding:10px 12px;font-size:14px;color:#333;">${escapeHtml(job.title)}</td>
          <td style="padding:10px 12px;text-align:right;">
            <a href="${escapeHtml(job.link)}" style="color:${badgeColor};text-decoration:none;font-size:13px;font-weight:600;">Apply →</a>
          </td>
        </tr>`,
      )
      .join("");

    domainSections += `
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 8px 0;font-size:15px;color:#555;border-bottom:2px solid ${badgeColor};padding-bottom:6px;display:inline-block;">${escapeHtml(prettifyDomain(domain))}</h3>
        <table style="width:100%;border-collapse:collapse;">
          ${rows}
        </table>
      </div>
    `;
  }

  return `
    <div style="margin-bottom:32px;">
      <h2 style="margin:0 0 4px 0;font-size:20px;color:#1a1a2e;">${tierLabel} ${badge}</h2>
      <p style="margin:0 0 16px 0;color:#666;font-size:14px;">${tierDescription}</p>
      ${domainSections}
    </div>
  `;
}

/** Build the complete HTML email body. */
function buildEmailHtml(results: TieredResults): string {
  const now = new Date();
  const prettyDate = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const tier1Count = results.tier1.length;
  const tier2Count = results.tier2.length;
  const totalCount = tier1Count + tier2Count;

  const tier1Html = renderTierHtml(
    results.tier1,
    "🎯 Tier 1 — Exact Matches",
    "These jobs match your specific keywords, seniority level, and location filters.",
    "#22c55e",
  );

  const tier2Html = renderTierHtml(
    results.tier2,
    "🌐 Tier 2 — Broader Matches",
    "These are broader matches across the US that may also be relevant.",
    "#3b82f6",
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StartupScraper Digest — ${escapeHtml(prettyDate)}</title>
</head>
<body style="margin:0;padding:0;background-color:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Content card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.3);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 32px 24px 32px;text-align:center;">
              <h1 style="margin:0 0 8px 0;font-size:24px;color:#ffffff;font-weight:700;">🔍 StartupScraper Digest</h1>
              <p style="margin:0;color:#94a3b8;font-size:14px;">${escapeHtml(prettyDate)}</p>
            </td>
          </tr>

          <!-- Summary bar -->
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:14px;color:#475569;">
                    Found <strong style="color:#1a1a2e;">${totalCount} new jobs</strong>
                    &nbsp;—&nbsp;
                    <span style="color:#22c55e;font-weight:600;">${tier1Count} Tier 1</span>,
                    <span style="color:#3b82f6;font-weight:600;">${tier2Count} Tier 2</span>
                  </td>
                  <td style="text-align:right;font-size:12px;color:#94a3b8;">
                    ${escapeHtml(timeStr)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Job listings -->
          <tr>
            <td style="padding:32px;">
              ${tier1Html}
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
              ${tier2Html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Generated by <a href="https://github.com/your-username/StartupScraper" style="color:#3b82f6;text-decoration:none;">StartupScraper</a> • ${escapeHtml(prettyDate)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Main export ────────────────────────────────────────────────

/**
 * Send a styled HTML email digest of job results via Resend.
 *
 * @param results  - The tiered job results to include in the digest.
 * @param emailTo  - Recipient email address.
 * @param env      - Object containing `resendApiKey` and `resendFromEmail`.
 * @returns `true` if the email was sent successfully, `false` otherwise.
 */
export async function sendDigestEmail(
  results: TieredResults,
  emailTo: string,
  env: { resendApiKey: string; resendFromEmail: string },
): Promise<boolean> {
  const resend = new Resend(env.resendApiKey);

  const now = new Date();
  const prettyDate = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const totalCount = results.tier1.length + results.tier2.length;
  const subject = `🔍 StartupScraper Digest — ${prettyDate} (${totalCount} new jobs)`;
  const html = buildEmailHtml(results);

  try {
    const { error } = await resend.emails.send({
      from: `StartupScraper <${env.resendFromEmail}>`,
      to: emailTo,
      subject,
      html,
    });

    if (error) {
      console.error(`❌ Failed to send email: ${error.message}`);
      return false;
    }

    console.log(`📧 Email digest sent to ${emailTo}`);
    return true;
  } catch (err) {
    console.error("❌ Email sending error:", err);
    return false;
  }
}
