import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IChatMessage {
  role: 'user' | 'ai';
  prompt: string;
  code?: string;
}

export interface IProject {
  _id: string;
  userId: mongoose.Types.ObjectId;
  title: string;
  chatHistory: IChatMessage[];
  currentCode: string;
  activeJobId: mongoose.Types.ObjectId | string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  fileClass?: string;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ['user', 'ai'], required: true },
    prompt: { type: String, required: true },
    code: { type: String, required: false },
  },
  { _id: false }
);

const ProjectSchema = new Schema<IProject>(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'New Project' },
    chatHistory: { type: [ChatMessageSchema], default: [] },
    currentCode: { type: String, default: '' },
    activeJobId: { type: String, default: null, ref: 'RenderJob' },
    isActive: { type: Boolean, default: true },
    fileClass: {
    type: String,
    required: false,
    default: null
  }
  },
  { timestamps: true }
);

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
