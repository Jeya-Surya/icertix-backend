/**
 * iCertiX - Email Service Abstraction
 * 
 * Provides an abstract interface for sending credential delivery and notification emails.
 * Uses a simulated/development implementation, ready for AWS SES or SendGrid.
 */

import { EmailDeliveryStatus, EmailLog } from '../../shared/types';

export interface SendEmailOptions {
  organisationId: string;
  credentialId?: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  htmlBody: string;
  certificatePdfBuffer?: Buffer;
}

export interface IEmailService {
  sendCredentialEmail(options: SendEmailOptions): Promise<EmailLog>;
  retryEmail(logId: string): Promise<EmailLog>;
}

export class MockEmailService implements IEmailService {
  private logs: EmailLog[] = [];

  async sendCredentialEmail(options: SendEmailOptions): Promise<EmailLog> {
    const log: EmailLog = {
      id: `EML-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      organisationId: options.organisationId,
      credentialId: options.credentialId,
      recipientEmail: options.recipientEmail,
      recipientName: options.recipientName,
      subject: options.subject,
      status: 'Delivered' as EmailDeliveryStatus,
      sentAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
      openedAt: undefined,
      retryCount: 0,
      createdAt: new Date().toISOString()
    };

    this.logs.push(log);
    console.log(`[Email Service - Dev Mock] Sent email to ${options.recipientEmail} | Subject: "${options.subject}"`);
    return log;
  }

  async retryEmail(logId: string): Promise<EmailLog> {
    const log = this.logs.find(l => l.id === logId);
    if (!log) {
      throw new Error(`Email log with ID ${logId} not found.`);
    }
    log.status = 'Delivered';
    log.retryCount = (log.retryCount || 0) + 1;
    log.deliveredAt = new Date().toISOString();
    return log;
  }
}

export const emailService = new MockEmailService();
