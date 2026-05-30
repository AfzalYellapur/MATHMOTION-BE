import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db';
import apiRoutes from './routes/api.routes';
import authRoutes from './routes/auth.routes';
import { startCleanupCron } from './services/cleanup.service';
import { startWorker } from './services/queue/worker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('Backend running');
});
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

const initializeApp = async () => {
  await connectDB();
  startWorker();
  startCleanupCron();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

initializeApp().catch((err) => {
  console.error('Failed to initialize app:', err);
  process.exit(1);
});
