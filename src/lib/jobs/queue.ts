/**
 * ContentOS - Job Orchestration & Queue Abstraction
 * Designed so in-memory, BullMQ/Redis, or serverless queues can be plugged in
 * without rewriting pipeline business logic.
 */

import { JobRecord, JobStatus, JobStage, CreateJobInput } from '@/types';

export interface IJobQueue {
  enqueue(input: CreateJobInput): Promise<JobRecord>;
  getJob(jobId: string): Promise<JobRecord | null>;
  updateJobStatus(jobId: string, status: JobStatus, error?: string): Promise<JobRecord>;
  advanceStage(jobId: string, completedStage: JobStage, nextStage?: JobStage): Promise<JobRecord>;
  retryFailedJob(jobId: string): Promise<JobRecord>;
}

export function isQueueConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}
