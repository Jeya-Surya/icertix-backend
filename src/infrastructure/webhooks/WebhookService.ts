/**
 * iCertiX - Enterprise Outbound Webhooks & Event Dispatcher Service
 * 
 * Provides cryptographic HMAC-SHA256 signed event delivery to external systems
 * (LMS like Canvas/Moodle, SIS, HRIS, Identity Providers).
 */

import crypto from 'crypto';

export type WebhookEvent =
  | 'credential.issued'
  | 'credential.revoked'
  | 'candidate.claimed'
  | 'batch.completed'
  | 'webhook.test';

export interface WebhookEndpoint {
  id: string;
  organisationId: string;
  url: string;
  description?: string;
  secret: string; // HMAC secret
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  organisationId: string;
  event: WebhookEvent;
  targetUrl: string;
  statusCode?: number;
  success: boolean;
  attempt: number;
  durationMs: number;
  requestPayload: any;
  responseBody?: string;
  timestamp: string;
}

export class WebhookService {
  private endpoints = new Map<string, WebhookEndpoint>();
  private logs: WebhookDeliveryLog[] = [];

  constructor() {
    // Seed initial demo webhook for Stanford (ORG_001)
    const demoEndpoint: WebhookEndpoint = {
      id: 'WH-STANFORD-CANVAS-01',
      organisationId: 'ORG_001',
      url: 'https://canvas.stanford.edu/api/v1/webhooks/icertix',
      description: 'Stanford Canvas LMS Automated Credential Sync',
      secret: 'whsec_stanford_prod_77a91bf2c8',
      events: ['credential.issued', 'credential.revoked', 'batch.completed'],
      isActive: true,
      createdAt: '2026-01-15T08:30:00.000Z',
      lastTriggeredAt: '2026-03-01T14:20:00.000Z',
    };
    this.endpoints.set(demoEndpoint.id, demoEndpoint);
  }

  /**
   * Generates a secure HMAC-SHA256 signature for webhook payload
   */
  static generateSignature(payload: string, secret: string, timestamp: number): string {
    const signaturePayload = `${timestamp}.${payload}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signaturePayload);
    return `t=${timestamp},v1=${hmac.digest('hex')}`;
  }

  /**
   * Verifies an incoming webhook signature
   */
  static verifySignature(payload: string, header: string, secret: string, toleranceSeconds = 300): boolean {
    try {
      const parts = header.split(',');
      const timestampPart = parts.find((p) => p.startsWith('t='));
      const signaturePart = parts.find((p) => p.startsWith('v1='));

      if (!timestampPart || !signaturePart) return false;

      const timestamp = parseInt(timestampPart.replace('t=', ''), 10);
      const signature = signaturePart.replace('v1=', '');

      if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
        return false; // Replay attack protection
      }

      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    } catch {
      return false;
    }
  }

  /**
   * Registers a new webhook endpoint for a tenant
   */
  async registerEndpoint(params: {
    organisationId: string;
    url: string;
    description?: string;
    events: WebhookEvent[];
  }): Promise<WebhookEndpoint> {
    const id = `WH-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;

    const endpoint: WebhookEndpoint = {
      id,
      organisationId: params.organisationId,
      url: params.url,
      description: params.description || 'Institutional Webhook Endpoint',
      secret,
      events: params.events.length > 0 ? params.events : ['credential.issued'],
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.endpoints.set(endpoint.id, endpoint);
    return endpoint;
  }

  /**
   * Lists all webhooks for an organization
   */
  async listEndpoints(organisationId: string): Promise<WebhookEndpoint[]> {
    return Array.from(this.endpoints.values())
      .filter((e) => e.organisationId === organisationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Gets a specific webhook by ID
   */
  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    return this.endpoints.get(id) || null;
  }

  /**
   * Deletes a webhook endpoint
   */
  async deleteEndpoint(id: string): Promise<boolean> {
    return this.endpoints.delete(id);
  }

  /**
   * Dispatches an event payload to all subscribed endpoints for an organization
   */
  async dispatch(organisationId: string, event: WebhookEvent, data: any): Promise<WebhookDeliveryLog[]> {
    const matchedEndpoints = Array.from(this.endpoints.values()).filter(
      (e) => e.organisationId === organisationId && e.isActive && (e.events.includes(event) || e.events.includes('webhook.test'))
    );

    const deliveryLogs: WebhookDeliveryLog[] = [];
    const timestamp = Math.floor(Date.now() / 1000);

    for (const ep of matchedEndpoints) {
      const payloadObj = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        event,
        timestamp: new Date().toISOString(),
        organisationId,
        data,
      };

      const payloadStr = JSON.stringify(payloadObj);
      const signatureHeader = WebhookService.generateSignature(payloadStr, ep.secret, timestamp);

      const startTime = Date.now();
      let success = true;
      let statusCode = 200;
      let responseBody = 'OK';

      // Perform HTTP dispatch simulation or fetch if external URL
      try {
        if (ep.url.startsWith('http://localhost') || ep.url.startsWith('https://')) {
          // Attempt dispatch with 3s timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          try {
            const res = await fetch(ep.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-iCertiX-Signature': signatureHeader,
                'X-iCertiX-Event': event,
                'X-iCertiX-Delivery': payloadObj.id,
              },
              body: payloadStr,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            statusCode = res.status;
            success = res.ok;
            responseBody = await res.text().catch(() => 'No response body');
          } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            success = false;
            statusCode = 504;
            responseBody = fetchErr?.message || 'Network timeout or unreachable endpoint';
          }
        } else {
          // Synthetic delivery simulation for demo endpoints
          success = true;
          statusCode = 200;
          responseBody = '{"received": true, "status": "processed"}';
        }
      } catch (err: any) {
        success = false;
        statusCode = 500;
        responseBody = err.message || 'Dispatch error';
      }

      ep.lastTriggeredAt = new Date().toISOString();

      const log: WebhookDeliveryLog = {
        id: `WHLOG-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        webhookId: ep.id,
        organisationId,
        event,
        targetUrl: ep.url,
        statusCode,
        success,
        attempt: 1,
        durationMs: Date.now() - startTime,
        requestPayload: payloadObj,
        responseBody: responseBody.slice(0, 500),
        timestamp: new Date().toISOString(),
      };

      this.logs.unshift(log);
      if (this.logs.length > 500) this.logs.pop();
      deliveryLogs.push(log);
    }

    return deliveryLogs;
  }

  /**
   * Retrieves recent webhook delivery logs for an organization
   */
  async getDeliveryLogs(organisationId: string, limit = 50): Promise<WebhookDeliveryLog[]> {
    return this.logs
      .filter((l) => l.organisationId === organisationId)
      .slice(0, limit);
  }
}

export const webhookService = new WebhookService();
