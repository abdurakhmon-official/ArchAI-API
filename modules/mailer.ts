import nodemailer, { type Transporter } from 'nodemailer';
import config from '@/config';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (!config.mail.host) {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
  });

  return transporter;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const result = await getTransporter().sendMail({
    from: config.mail.from,
    ...message,
  });

  if (!config.mail.host) {
    console.info(`[mail:dev] ${message.to} — ${message.subject}`);
    console.info(result.message?.toString?.() ?? '');
  }
}

export async function verifyMailer(): Promise<boolean> {
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}
