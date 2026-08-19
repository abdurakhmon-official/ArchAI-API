import type { Job } from 'bullmq';
import config from '@/config';
import { copyFor, labelsFor, pathFor, type Template } from '@/i18n/email';
import { resolveLocale, type Locale } from '@/i18n/locales';
import { sendMail } from '@/modules/mailer';
import type { EmailJob } from '@/modules/queue';

const TEMPLATES: readonly Template[] = ['welcome', 'verify', 'reset', 'subscription'];

/** Templates whose link ends in a one-time token. */
const TOKEN_TEMPLATES: readonly Template[] = ['verify', 'reset'];

export async function processEmail(job: Job<EmailJob>): Promise<{ sent: boolean }> {
  const { to, template, payload } = job.data;

  if (!TEMPLATES.includes(template)) {
    // Unknown template — retrying will not help.
    throw new Error(`unknown email template: ${template}`);
  }

  const locale = resolveLocale(job.data.locale);
  const copy = copyFor(locale, template);

  const link = TOKEN_TEMPLATES.includes(template)
    ? `${config.webUrl}${pathFor(locale, template)}/${payload.token}`
    : `${config.webUrl}${pathFor(locale, template)}`;

  const heading =
    template === 'welcome' && payload.name
      ? `${copy.heading}, ${escapeHtml(String(payload.name))}!`
      : copy.heading;

  const paragraphs = [...copy.body.map((line) => `<p>${line}</p>`)];

  if (template === 'subscription') paragraphs.push(...subscriptionLines(locale, payload));

  const content = [
    `<h1>${heading}</h1>`,
    ...paragraphs,
    button(link, copy.action),
    copy.note ? `<p class="muted">${copy.note}</p>` : '',
  ].join('\n      ');

  await sendMail({ to, subject: copy.subject, html: layout(content, locale) });

  return { sent: true };
}

function subscriptionLines(locale: Locale, payload: Record<string, unknown>): string[] {
  const labels = labelsFor(locale);
  const lines = [`<p>${labels.plan}: <strong>${escapeHtml(String(payload.plan ?? ''))}</strong></p>`];

  if (payload.expiresAt) {
    lines.push(`<p>${labels.expires}: ${escapeHtml(String(payload.expiresAt))}</p>`);
  }

  return lines;
}

function layout(content: string, locale: Locale): string {
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#F7F5FB;padding:24px;font-family:system-ui,'Segoe UI',sans-serif;">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;
         border:1px solid #E4DFEC;border-collapse:separate;">
    <tr><td style="padding:28px 30px;">
      <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;
                  color:#6538D9;font-weight:700;margin-bottom:16px;">ArchAI</div>
      <style>
        h1 { font-size:20px; margin:0 0 12px; color:#17131F; }
        p { margin:0 0 12px; color:#4A4358; font-size:15px; line-height:1.6; }
        .muted { color:#7C748C; font-size:13px; }
      </style>
      ${content}
    </td></tr>
  </table>
  <p style="max-width:520px;margin:14px auto 0;color:#7C748C;font-size:12px;text-align:center;">
    ArchAI · Architecture Online
  </p>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;">
    <a href="${escapeHtml(href)}"
       style="display:inline-block;background:#6538D9;color:#fff;text-decoration:none;
              padding:11px 22px;border-radius:6px;font-weight:600;font-size:15px;">
      ${escapeHtml(label)}
    </a>
  </p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
