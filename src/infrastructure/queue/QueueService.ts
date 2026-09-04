/**
 * iCertiX - Certificate Generation Queue Service Abstraction
 * 
 * Provides an asynchronous background job processing abstraction for batch certificate generation.
 * Uses an in-memory event-driven worker for development, ready for Redis/BullMQ.
 */

import { CertificateJob, JobStatus } from '../../shared/types';

export type JobProcessor = (job: CertificateJob, updateProgress: (processed: number, success: number, failed: number, err?: string) => Promise<void>) => Promise<string[]>;

export interface IQueueService {
  enqueueJob(job: CertificateJob, processor: JobProcessor): Promise<CertificateJob>;
  getJob(jobId: string): Promise<CertificateJob | null>;
}

export class MemoryJobQueueService implements IQueueService {
  private jobs = new Map<string, CertificateJob>();

  async enqueueJob(job: CertificateJob, processor: JobProcessor): Promise<CertificateJob> {
    this.jobs.set(job.id, job);

    // Run asynchronously in the background
    setTimeout(async () => {
      job.status = 'PROCESSING' as JobStatus;
      job.startedAt = new Date().toISOString();

      try {
        const updateProgress = async (processed: number, success: number, failed: number, err?: string) => {
          job.processedCount = processed;
          job.successCount = success;
          job.failedCount = failed;
          if (err) {
            job.errors.push({ candidateId: `CAN-PROG`, error: err });
          }
        };

        const generatedIds = await processor(job, updateProgress);
        job.generatedCredentialIds = generatedIds;
        job.status = 'COMPLETED' as JobStatus;
        job.completedAt = new Date().toISOString();
      } catch (err: any) {
        job.status = 'FAILED' as JobStatus;
        job.errors.push({ candidateId: 'ALL', error: err?.message || 'Batch generation failed.' });
      }
    }, 50);

    return job;
  }

  async getJob(jobId: string): Promise<CertificateJob | null> {
    return this.jobs.get(jobId) || null;
  }
}

export const queueService = new MemoryJobQueueService();
