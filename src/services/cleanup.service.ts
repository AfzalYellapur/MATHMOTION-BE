import cron from 'node-cron';
import { Project } from '../models/Project';
import { RenderJob, JobStatus } from '../models/RenderJob';
import fs from 'fs';
import path from 'path';

// Video directory path (can be overridden by env variable)
// Defaulting to a relative path similar to the FastAPI worker directory
const VIDEO_DIR = process.env.VIDEO_STORAGE_PATH || path.join(__dirname, '../../../../worker/videos');

export const startCleanupCron = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      // Find projects that haven't been updated in 15 minutes and have an activeJobId
      const staleProjects = await Project.find({
        updatedAt: { $lt: fifteenMinutesAgo },
        activeJobId: { $ne: null }
      }).populate('activeJobId');

      for (const project of staleProjects) {
        const job = project.activeJobId as any; // populated RenderJob document
        
        if (job && job.status === JobStatus.COMPLETED) {
          console.log(`[Cleanup] Cleaning up stale project: ${project._id}, job: ${job._id}`);
          
          // 1. Delete physical video file if it exists
          if (job.videoUrl) {
            // Extract filename from URL (e.g. http://localhost:8000/videos/xyz.mp4 -> xyz.mp4)
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
          
          // 2. Delete RenderJob record
          await RenderJob.findByIdAndDelete(job._id);
          console.log(`[Cleanup] Deleted RenderJob record: ${job._id}`);
          
          // 3. Nullify activeJobId in Project
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
