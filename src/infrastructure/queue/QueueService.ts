import { CertificateJob, JobStatus } from '../../shared/types';

export interface EnrichedCertificateJob extends CertificateJob {
  percentComplete: number;
  etaSeconds: number | null;
  speedPerSecond: number;
  isCancelled?: boolean;
}

export type JobProgressCallback = (
  processed: number,
  success: number,
  failed: number,
  err?: string
) => Promise<void>;

export type JobProcessor = (
  job: EnrichedCertificateJob,
  updateProgress: JobProgressCallback,
  checkCancelled: () => boolean
) => Promise<string[]>;

export interface IQueueService {
  enqueueJob(job: CertificateJob, processor: JobProcessor): Promise<EnrichedCertificateJob>;
  getJob(jobId: string): Promise<EnrichedCertificateJob | null>;
  cancelJob(jobId: string): Promise<boolean>;
  listJobsByOrg(organisationId: string, limit?: number): Promise<EnrichedCertificateJob[]>;
  getAllJobs(): Promise<EnrichedCertificateJob[]>;
}

export class MemoryJobQueueService implements IQueueService {
  private jobs = new Map<string, EnrichedCertificateJob>();

  async enqueueJob(rawJob: CertificateJob, processor: JobProcessor): Promise<EnrichedCertificateJob> {
    const job: EnrichedCertificateJob = {
      ...rawJob,
      percentComplete: 0,
      etaSeconds: null,
      speedPerSecond: 0,
      isCancelled: false,
    };

    this.jobs.set(job.id, job);

    // Run asynchronously in background worker
    setTimeout(async () => {
      job.status = 'PROCESSING' as JobStatus;
      job.startedAt = new Date().toISOString();
      const startTime = Date.now();

      try {
        const updateProgress: JobProgressCallback = async (
          processed: number,
          success: number,
          failed: number,
          err?: string
        ) => {
          if (job.isCancelled) return;

          job.processedCount = processed;
          job.successCount = success;
          job.failedCount = failed;

          const total = job.totalCount || 1;
          job.percentComplete = Math.min(100, Math.round((processed / total) * 100));

          const elapsedSec = (Date.now() - startTime) / 1000;
          if (elapsedSec > 0 && processed > 0) {
            job.speedPerSecond = Number((processed / elapsedSec).toFixed(1));
            const remaining = total - processed;
            job.etaSeconds = job.speedPerSecond > 0 ? Math.ceil(remaining / job.speedPerSecond) : null;
          }

          if (err) {
            job.errors.push({ candidateId: `CAN-PROG`, error: err });
          }
        };

        const checkCancelled = () => Boolean(job.isCancelled);

        const generatedIds = await processor(job, updateProgress, checkCancelled);

        if (job.isCancelled) {
          job.status = 'CANCELLED' as JobStatus;
          job.completedAt = new Date().toISOString();
          job.etaSeconds = 0;
          return;
        }

        job.generatedCredentialIds = generatedIds;
        job.status = 'COMPLETED' as JobStatus;
        job.percentComplete = 100;
        job.etaSeconds = 0;
        job.completedAt = new Date().toISOString();
      } catch (err: any) {
        if (job.isCancelled) {
          job.status = 'CANCELLED' as JobStatus;
        } else {
          job.status = 'FAILED' as JobStatus;
          job.errors.push({ candidateId: 'ALL', error: err?.message || 'Batch generation failed.' });
        }
        job.completedAt = new Date().toISOString();
      }
    }, 50);

    return job;
  }

  async getJob(jobId: string): Promise<EnrichedCertificateJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
      return false;
    }

    job.isCancelled = true;
    job.status = 'CANCELLED' as JobStatus;
    job.completedAt = new Date().toISOString();
    return true;
  }

  async listJobsByOrg(organisationId: string, limit = 20): Promise<EnrichedCertificateJob[]> {
    const all = Array.from(this.jobs.values())
      .filter((j) => j.organisationId === organisationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    return all;
  }

  async getAllJobs(): Promise<EnrichedCertificateJob[]> {
    return Array.from(this.jobs.values());
  }
}

export const queueService = new MemoryJobQueueService();
