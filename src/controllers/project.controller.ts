import { Request, Response } from 'express';
import { Project } from '../models/Project';
import { RenderJob, JobStatus } from '../models/RenderJob';
import { generateManimCode, cancelGeneration } from '../services/gemini.service';
import { addRenderJobToQueue, renderQueue } from '../services/queue/producer';
import fs from 'fs';
import path from 'path';

const VIDEO_DIR = process.env.VIDEO_STORAGE_PATH || path.join(__dirname, '../../../../worker/videos');

export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const projects = await Project.find({ userId }).sort({ updatedAt: -1 });
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createProject = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    await Project.updateMany({ userId }, { isActive: false });

    const project = new Project({ userId, isActive: true });
    await project.save();

    res.status(201).json({ projectId: project._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const project = await Project.findOneAndDelete({ _id: id, userId });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const activateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await Project.updateMany({ userId }, { isActive: false });

    const project = await Project.findOneAndUpdate(
      { _id: id, userId },
      { isActive: true },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    res.json({ message: 'Project activated successfully', project });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const chatProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { prompt } = req.body;
    const userId = req.user!.id;

    const project = await Project.findOne({ _id: id, userId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    // Pass projectId as required by module 4
    const { explanation, code, fileClass } = await generateManimCode(project._id.toString(), prompt, project.chatHistory, project.currentCode);

    project.chatHistory.push({ role: 'user', prompt, code: '' });
    project.chatHistory.push({ role: 'ai', prompt: explanation, code });
    project.currentCode = code;

    if (project.chatHistory.length === 2 && project.title === 'New Project') {
      project.title = prompt.substring(0, 50);
    }

    await project.save();

    res.status(200).json({ explanation, code, fileClass });
  } catch (err: any) {
    if (err.message === 'AbortError') {
      return res.status(400).json({ error: 'Generation was cancelled' });
    }
    res.status(500).json({ error: err.message });
  }
};

export const cancelGenerationController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const project = await Project.findOne({ _id: id, userId });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const cancelled = cancelGeneration(id);
    if (cancelled) {
      res.json({ message: 'Generation cancelled successfully' });
    } else {
      res.status(400).json({ error: 'No active generation found for this project' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const buildProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fileClass } = req.body;
    const userId = req.user!.id;

    // AWS Queue Overload Shield
    const processingJob = await RenderJob.findOne({ userId, status: JobStatus.PROCESSING });
    if (processingJob) {
      return res.status(429).json({ error: 'Too Many Requests. You already have a render job processing.' });
    }

    const project = await Project.findOne({ _id: id, userId }).populate('activeJobId');
    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    const activeJob = project.activeJobId as any;

    if (activeJob && activeJob.status === JobStatus.PROCESSING) {
      return res.status(429).json({ error: 'A render job is already processing for this project' });
    }

    if (activeJob && activeJob.status === JobStatus.COMPLETED) {
      if (activeJob.videoUrl) {
        const urlParts = activeJob.videoUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        if (filename) {
          const filepath = path.join(VIDEO_DIR, filename);
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        }
      }
      await RenderJob.findByIdAndDelete(activeJob._id);
    } else if (activeJob) {
      await RenderJob.findByIdAndDelete(activeJob._id);
    }

    const newJob = new RenderJob({
      projectId: project._id,
      userId: userId, // Added userId as per 4.2 shield requirements
      status: JobStatus.PENDING,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    await newJob.save();

    project.activeJobId = newJob._id;
    await project.save();

    await addRenderJobToQueue(newJob._id as string, project.currentCode, fileClass || 'MainScene');

    res.status(202).json({ jobId: newJob._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const cancelRender = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const project = await Project.findOne({ _id: id, userId });
    if (!project || !project.activeJobId) {
      return res.status(404).json({ error: 'Project or active job not found' });
    }

    const job = await RenderJob.findOne({ _id: project.activeJobId, userId });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const bullJob = await renderQueue.getJob(job._id);
    if (bullJob) {
      const state = await bullJob.getState();
      if (state === 'waiting' || state === 'delayed') {
        await bullJob.remove();
      }
    }

    job.status = JobStatus.CANCELLED;
    await job.save();

    res.json({ message: 'Render job cancelled successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const saveProjectCode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    const userId = req.user!.id;

    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'Code must be a string' });
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, userId },
      { currentCode: code },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    res.json({ message: 'Code saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
