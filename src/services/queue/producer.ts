import { Queue } from 'bullmq';
import { redisConnection } from '../../config/redis';

export const renderQueue = new Queue('RenderQueue', {
  connection: redisConnection,
});

export const addRenderJobToQueue = async (jobId: string, currentCode: string, fileClass: string = 'MainScene') => {
  await renderQueue.add(
    'render',
    {
      jobId,
      currentCode,
      fileClass,
    },
    {
      jobId: jobId
    }
  );
  console.log(`[Producer] Added job ${jobId} to RenderQueue`);
};
