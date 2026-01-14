import express from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { mkdir, readdir, stat, copyFile } from 'fs/promises';
import { extractPose2D, reencodeH264 } from '../services/poseExtractor';
import { retargetPoseToSpine } from '../services/retarget';
import { readFile } from 'fs/promises';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

export type JobStatus = 'CREATED' | 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export interface JobMeta {
  id: string;
  status: JobStatus;
  progress: number;
  config: { poseModel: string; smooth: boolean; retarget: string };
  artifacts: Array<{ name: string; type: string; url: string; size: number }>;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

const jobsDb = new Map<string, JobMeta>();

router.post('/', upload.single('video'), async (req, res) => {
  const file = (req as any).file;
  if (!file) return res.status(400).json({ error: 'missing video' });
  const jobId = uuid();
  const jobDir = path.join('jobs', jobId);
  await mkdir(jobDir, { recursive: true });

  const meta: JobMeta = {
    id: jobId,
    status: 'CREATED',
    progress: 0,
    config: {
      poseModel: (req.body.poseModel as string) || 'mediapipe',
      smooth: (req.body.smooth as string) === 'true',
      retarget: (req.body.retarget as string) || 'rotate',
    },
    artifacts: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobsDb.set(jobId, meta);

  // 立即启动异步处理（演示简化，无队列）
  processJob(jobId, file.path, jobDir).catch((e) => {
    console.error(e);
    const m = jobsDb.get(jobId);
    if (m) {
      m.status = 'FAILED';
      m.error = e instanceof Error ? e.message : String(e);
      m.updatedAt = Date.now();
    }
  });

  res.json({ jobId });
});

router.get('/:id', async (req, res) => {
  const job = jobsDb.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job);
});

router.get('/', async (req, res) => {
  const list = Array.from(jobsDb.values()).sort((a, b) => b.createdAt - a.createdAt);
  res.json(list);
});

router.get('/:id/artifacts', async (req, res) => {
  const job = jobsDb.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job.artifacts);
});

export default router;

/**
 * 处理流水线：提取→重定向→导出
 */
async function processJob(jobId: string, videoPath: string, jobDir: string) {
  const meta = jobsDb.get(jobId)!;
  meta.status = 'RUNNING';
  meta.progress = 10;
  meta.updatedAt = Date.now();

  const poseJsonPath = path.join(jobDir, 'pose_2d.json');
  const overlayPath = path.join(jobDir, 'pose_overlay.mp4');
  const spineAnimPath = path.join(jobDir, 'spine_animation.json');
  const originalPath = path.join(jobDir, 'original.mp4');
  const poseLogPath = path.join(jobDir, 'pose_extract.log');

  try {
    // 0. 保存原始视频到job目录，便于失败时也能预览
    await copyFile(videoPath, originalPath);
    console.log(`[job ${jobId}] copied original to ${originalPath}`);
    try {
      await reencodeH264(originalPath, poseLogPath);
    } catch {}

    // 1. 提取关键点+overlay
    await extractPose2D(videoPath, poseJsonPath, overlayPath, poseLogPath);
    console.log(`[job ${jobId}] pose extracted`);
    meta.progress = 50;
    meta.updatedAt = Date.now();

    // 2. 重定向到Spine
    const poseJson = JSON.parse(await readFile(poseJsonPath, 'utf-8'));
    await retargetPoseToSpine(poseJson, spineAnimPath);
    console.log(`[job ${jobId}] retarget done`);
    meta.progress = 90;
    meta.updatedAt = Date.now();

    // 3. 生成artifacts列表（本地演示用相对URL）
    const artifacts = [
      { name: 'original.mp4', type: 'video', url: `/jobs/${jobId}/original.mp4`, size: (await stat(originalPath)).size },
      { name: 'pose_2d.json', type: 'json', url: `/jobs/${jobId}/pose_2d.json`, size: (await stat(poseJsonPath)).size },
      { name: 'pose_overlay.mp4', type: 'video', url: `/jobs/${jobId}/pose_overlay.mp4`, size: (await stat(overlayPath)).size },
      { name: 'spine_animation.json', type: 'json', url: `/jobs/${jobId}/spine_animation.json`, size: (await stat(spineAnimPath)).size },
      { name: 'pose_extract.log', type: 'log', url: `/jobs/${jobId}/pose_extract.log`, size: (await stat(poseLogPath)).size },
    ];
    meta.artifacts = artifacts;
    meta.status = 'SUCCEEDED';
    meta.progress = 100;
    meta.updatedAt = Date.now();
    console.log(`[job ${jobId}] succeeded`);
  } catch (e) {
    meta.status = 'FAILED';
    meta.error = e instanceof Error ? e.message : String(e);
    console.error(`[job ${jobId}] failed: ${meta.error}`);
    // 尽量提供已生成的产物，便于诊断
    const artifacts: Array<{ name: string; type: string; url: string; size: number }> = [];
    try { artifacts.push({ name: 'original.mp4', type: 'video', url: `/jobs/${jobId}/original.mp4`, size: (await stat(originalPath)).size }); } catch {}
    try { artifacts.push({ name: 'pose_extract.log', type: 'log', url: `/jobs/${jobId}/pose_extract.log`, size: (await stat(poseLogPath)).size }); } catch {}
    meta.artifacts = artifacts;
    meta.updatedAt = Date.now();
    throw e;
  }
}
