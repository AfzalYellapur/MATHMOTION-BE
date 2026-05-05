import { Request, Response } from 'express';
import { Project } from '../models/Project';
import { RenderJob, JobStatus } from '../models/RenderJob';
import { QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis';

// Create a global QueueEvents instance to listen to the RenderQueue
const queueEvents = new QueueEvents('RenderQueue', { connection: redisConnection });

export const streamStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id; // Auth protection

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const project = await Project.findOne({ _id: id, userId });
    if (!project) {
      res.write(`data: ${JSON.stringify({ error: 'Project not found or unauthorized' })}\n\n`);
      return res.end();
    }

    const activeJobId = project.activeJobId;
    if (!activeJobId) {
      res.write(`data: ${JSON.stringify({ error: 'No active render job' })}\n\n`);
      return res.end();
    }

    // Push initial status
    const job = await RenderJob.findById(activeJobId);
    if (!job) {
      res.write(`data: ${JSON.stringify({ status: JobStatus.FAILED, errorMessage: 'Job deleted or not found' })}\n\n`);
      return res.end();
    }

    res.write(`data: ${JSON.stringify({ status: job.status, videoUrl: job.videoUrl, errorMessage: job.errorMessage })}\n\n`);

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED || job.status === JobStatus.CANCELLED) {
      return res.end();
    }

    // Set up listeners for BullMQ events
    const onCompleted = async ({ jobId, returnvalue }: { jobId: string; returnvalue: string }) => {
      if (jobId === activeJobId.toString()) {
        const completedJob = await RenderJob.findById(activeJobId);
        res.write(`data: ${JSON.stringify({ status: JobStatus.COMPLETED, videoUrl: completedJob?.videoUrl })}\n\n`);
        cleanupAndEnd();
      }
    };

    const onFailed = async ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
      if (jobId === activeJobId.toString()) {
        res.write(`data: ${JSON.stringify({ status: JobStatus.FAILED, errorMessage: failedReason })}\n\n`);
        cleanupAndEnd();
      }
    };

    const cleanupAndEnd = () => {
      queueEvents.removeListener('completed', onCompleted);
      queueEvents.removeListener('failed', onFailed);
      res.end();
    };

    queueEvents.on('completed', onCompleted);
    queueEvents.on('failed', onFailed);

    req.on('close', () => {
      queueEvents.removeListener('completed', onCompleted);
      queueEvents.removeListener('failed', onFailed);
    });

  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};
