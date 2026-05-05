import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { redisConnection } from '../../config/redis';
import { RenderJob, JobStatus } from '../../models/RenderJob';

export const startWorker = () => {
  const worker = new Worker(
    'RenderQueue',
    async (job: Job) => {
      const { jobId, currentCode, fileClass } = job.data;

      try {
        // 1. Update DB to PROCESSING
        await RenderJob.findByIdAndUpdate(jobId, { status: JobStatus.PROCESSING });
        console.log(`[Worker] Job ${jobId} set to PROCESSING. Sending to Python worker...`);

        // 2. Send Axios POST to Python FastAPI worker
        const pythonWorkerUrl = process.env.PYTHON_WORKER_URL;

        if (!pythonWorkerUrl) {
          throw new Error('PYTHON_WORKER_URL is not defined');
        }

        // Wait for Python server response. Timeout could be added if needed.
        const response = await axios.post(pythonWorkerUrl, {
          code: currentCode,
          file_class: fileClass,
          job_id: jobId,
        });

        const videoUrl = response.data.video_url;

        // 3. Update DB to COMPLETED
        await RenderJob.findByIdAndUpdate(jobId, {
          status: JobStatus.COMPLETED,
          videoUrl,
        });

        console.log(`[Worker] Job ${jobId} COMPLETED. Video URL: ${videoUrl}`);
      } catch (error: any) {
        // Extract the actual Manim traceback from the Python API response if available
        const actualErrorMessage = error.response?.data?.detail
          || error.response?.data?.error
          || error.message
          || 'Unknown error occurred during rendering';

        console.error(`[Worker] Job ${jobId} FAILED:`, actualErrorMessage);

        // Update DB to FAILED
        await RenderJob.findByIdAndUpdate(jobId, {
          status: JobStatus.FAILED,
          errorMessage: actualErrorMessage,
        });

        // Throw the ACTUAL error message so BullMQ passes it to stream.controller.ts
        throw new Error(actualErrorMessage);
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // Strictly process one video at a time as per PRD
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Queue Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log('BullMQ worker initialized and listening on RenderQueue.');
};
