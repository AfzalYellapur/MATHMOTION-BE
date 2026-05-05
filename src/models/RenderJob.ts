import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface IRenderJob {
  _id: string;
  projectId: string;
  userId: mongoose.Types.ObjectId;
  status: JobStatus;
  videoUrl?: string;
  errorMessage?: string;
  expiresAt: Date;
}

const RenderJobSchema = new Schema<IRenderJob>(
  {
    _id: { type: String, default: uuidv4 },
    projectId: { type: String, required: true, ref: 'Project' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: Object.values(JobStatus),
      default: JobStatus.PENDING,
    },
    videoUrl: { type: String },
    errorMessage: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const RenderJob = mongoose.model<IRenderJob>('RenderJob', RenderJobSchema);
