import { Router } from 'express';
import {
  getProjects,
  createProject,
  deleteProject,
  activateProject,
  chatProject,
  buildProject,
  cancelGenerationController,
  cancelRender,
  saveProjectCode
} from '../controllers/project.controller';
import { streamStatus } from '../controllers/stream.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { expensiveEndpointLimiter } from '../middleware/rate-limiter.middleware';

const router = Router();

// Apply auth middleware to all project routes
router.use('/projects', requireAuth);

// Workspace Initialization & Management
router.get('/projects', getProjects);
router.post('/projects/new', createProject);
router.delete('/projects/:id', deleteProject);
router.put('/projects/:id/activate', activateProject);

// Drafting & Versioning & Cancellation
router.post('/projects/:id/chat', expensiveEndpointLimiter, chatProject);
router.post('/projects/:id/cancel-generation', cancelGenerationController);
router.put('/projects/:id/code', saveProjectCode);

// The Build Queue & Cancellation
router.post('/projects/:id/build', expensiveEndpointLimiter, buildProject);
router.post('/projects/:id/cancel-render', cancelRender);

// Real-Time Telemetry
router.get('/projects/:id/status/stream', streamStatus);

export default router;
