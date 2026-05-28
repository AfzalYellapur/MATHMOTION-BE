import cron from 'node-cron';
import { Project } from '../models/Project';
import { RenderJob, JobStatus } from '../models/RenderJob';
import fs from 'fs';
import path from 'path';

const VIDEO_DIR = process.env.VIDEO_STORAGE_PATH || path.join(__dirname, '../../../../worker/videos');

export const startCleanupCron = () => {

  cron.schedule('* * * * *', async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const staleProjects = await Project.find({
        updatedAt: { $lt: fifteenMinutesAgo },
        activeJobId: { $ne: null }
      }).populate('activeJobId');

      for (const project of staleProjects) {
        const job = project.activeJobId as any;

        if (job && job.status === JobStatus.COMPLETED) {
          console.log(`[Cleanup] Cleaning up stale project: ${project._id}, job: ${job._id}`);

          if (job.videoUrl) {
            const urlParts = job.videoUrl.split('/');
            const filename = urlParts[urlParts.length - 1];

            if (filename) {
              const filepath = path.join(VIDEO_DIR, filename);
              if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log(`[Cleanup] Deleted physical file: ${filepath}`);
              } else {
                console.log(`[Cleanup] Physical file not found: ${filepath}`);
              }
            }
          }

          await RenderJob.findByIdAndDelete(job._id);
          console.log(`[Cleanup] Deleted RenderJob record: ${job._id}`);
          project.activeJobId = null;
          await project.save();
          console.log(`[Cleanup] Nullified activeJobId for Project: ${project._id}`);
        }
      }
    } catch (err) {
      console.error('[Cleanup] Error during cron execution:', err);
    }
  });
  console.log('Cleanup cron job initialized.');
};
