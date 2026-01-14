import { spawn } from 'child_process';
import { existsSync } from 'fs';
const ffmpegBinCandidate = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
const ffmpegPath = existsSync(ffmpegBinCandidate) ? ffmpegBinCandidate : null;
import { writeFile } from 'fs/promises';
import path from 'path';

export type Keypoint = { name: string; x: number; y: number; c: number };
export type FramePose = { t: number; joints: Keypoint[] };
export type PoseJson = {
  meta: {
    fps: number;
    frame_count: number;
    keypoint_schema: string;
    source_video: string;
  };
  frames: FramePose[];
};

export const reencodeH264 = async (inputPath: string, logPath?: string) => {
  return new Promise<void>((res) => {
    const outPath = inputPath.replace(/\.mp4$/i, '.h264.mp4');
    const exe = ffmpegPath || 'ffmpeg';
    const args = ['-y', '-i', inputPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-preset', 'veryfast', outPath];
    const ff = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = ''; let e = '';
    ff.stdout?.on('data', d => o += d.toString());
    ff.stderr?.on('data', d => e += d.toString());
    ff.on('error', () => res());
    ff.on('close', async (code) => {
      try {
        if (logPath) {
          const log = `FFMPEG OUT:\n${o}\n\nFFMPEG ERR:\n${e}`;
          await writeFile(logPath.replace(/\.log$/i, '.ffmpeg.log'), log);
        }
      } catch {}
      if (code === 0) {
        const mv = spawn('bash', ['-lc', `mv "${outPath}" "${inputPath}"`]);
        mv.on('error', () => res());
        mv.on('close', () => res());
      } else {
        res();
      }
    });
  });
};

/**
 * 使用MediaPipe BlazePose提取2D关键点
 * 输出33点格式，映射到COCO 17点用于后续重定向
 */
export async function extractPose2D(
  videoPath: string,
  outJsonPath: string,
  outOverlayPath: string,
  logPath?: string
): Promise<void> {
  // 33点→17点映射表（取主要关节）
  const mapping33To17: Record<number, string> = {
    0: 'nose',
    11: 'left_shoulder',
    12: 'right_shoulder',
    13: 'left_elbow',
    14: 'right_elbow',
    15: 'left_wrist',
    16: 'right_wrist',
    23: 'left_hip',
    24: 'right_hip',
    25: 'left_knee',
    26: 'right_knee',
    27: 'left_ankle',
    28: 'right_ankle',
  };

  // 使用Python MediaPipe脚本（确保环境中已安装mediapipe opencv-python)
  const keys = Object.keys(mapping33To17).map(Number);
  const names = keys.map((k) => mapping33To17[k]);
  const pyScript = `
import sys, os
import cv2
import json
import urllib.request
import numpy as np
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core import base_options

video_path = sys.argv[1]
out_overlay = sys.argv[2]
out_json = sys.argv[3]
job_dir = os.path.dirname(out_overlay)

MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
MODEL_PATH = os.path.join(job_dir, 'pose_landmarker_full.task')
if not os.path.exists(MODEL_PATH):
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)

cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)
width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
writer = cv2.VideoWriter(out_overlay, fourcc, fps, (width, height))

base_opts = base_options.BaseOptions(model_asset_path=MODEL_PATH)
opts = vision.PoseLandmarkerOptions(
    base_options=base_opts,
    running_mode=vision.RunningMode.VIDEO,
    output_segmentation_masks=True
)
detector = vision.PoseLandmarker.create_from_options(opts)

KEYS = ${JSON.stringify(keys)}
NAMES = ${JSON.stringify(names)}
results_list = []
EDGES = [
    ('left_shoulder','right_shoulder'),
    ('left_shoulder','left_elbow'), ('left_elbow','left_wrist'),
    ('right_shoulder','right_elbow'), ('right_elbow','right_wrist'),
    ('left_hip','right_hip'),
    ('left_hip','left_knee'), ('left_knee','left_ankle'),
    ('right_hip','right_knee'), ('right_knee','right_ankle'),
    ('nose','left_shoulder'), ('nose','right_shoulder'),
]

class EMA:
    def __init__(self, alpha=0.5):
        self.val = None
        self.alpha = alpha
    def update(self, x):
        if self.val is None:
            self.val = x
        else:
            self.val = self.val * (1 - self.alpha) + x * self.alpha
        return self.val

smoothers = {}
for name in NAMES:
    smoothers[name] = {'x': EMA(0.6), 'y': EMA(0.6)}

def save_part(img, mask, center, size, name):
    x, y = int(center[0]), int(center[1])
    w, h = int(size[0]), int(size[1])
    
    x1 = max(0, x - w//2)
    y1 = max(0, y - h//2)
    x2 = min(width, x + w//2)
    y2 = min(height, y + h//2)
    
    if x2 <= x1 or y2 <= y1: return
    
    roi = img[y1:y2, x1:x2]
    # roi is BGRA
    
    # Save
    cv2.imwrite(os.path.join(job_dir, f'{name}.png'), roi)

idx = 0
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    ts = int(idx * 1000 / fps)
    res = detector.detect_for_video(mp_image, ts)
    
    joints = []
    
    # 1. Process Mask & Cutouts (First Frame Only)
    if idx == 0 and res.segmentation_masks:
        mask = res.segmentation_masks[0].numpy_view() # float32 [0,1]
        mask = cv2.resize(mask, (width, height))
        mask_u8 = (mask * 255).astype(np.uint8)
        
        # Apply mask to frame -> BGRA
        b, g, r = cv2.split(frame)
        bgra = cv2.merge([b, g, r, mask_u8])
        
        # Helper to get point
        def get_pt(n):
            for i, lm in enumerate(res.pose_landmarks[0]):
                if i in KEYS and NAMES[KEYS.index(i)] == n:
                    return (lm.x * width, lm.y * height)
            return None
            
        pts = {}
        for n in NAMES:
            p = get_pt(n)
            if p: pts[n] = p
            
        # Define Parts ROI (Center, Size)
        # Head: Nose + Shoulders
        if 'nose' in pts and 'left_shoulder' in pts and 'right_shoulder' in pts:
            sh_w = np.linalg.norm(np.array(pts['left_shoulder']) - np.array(pts['right_shoulder']))
            # Head center = nose, size = 1.5 * shoulder_width
            save_part(bgra, mask_u8, pts['nose'], (sh_w * 1.5, sh_w * 1.5), 'head')
            
        # Torso: Shoulders + Hips
        if 'left_shoulder' in pts and 'right_hip' in pts:
            mid_sh = (np.array(pts['left_shoulder']) + np.array(pts['right_shoulder'])) / 2
            mid_hip = (np.array(pts['left_hip']) + np.array(pts['right_hip'])) / 2
            center = (mid_sh + mid_hip) / 2
            torso_h = np.linalg.norm(mid_sh - mid_hip)
            torso_w = np.linalg.norm(np.array(pts['left_shoulder']) - np.array(pts['right_shoulder']))
            save_part(bgra, mask_u8, center, (torso_w * 2.0, torso_h * 1.5), 'torso')
            
        # Arms & Legs (Generic logic)
        def cut_limb(p1, p2, name):
            if p1 in pts and p2 in pts:
                v1 = np.array(pts[p1])
                v2 = np.array(pts[p2])
                center = (v1 + v2) / 2
                length = np.linalg.norm(v1 - v2)
                # width = length * 0.4 usually
                save_part(bgra, mask_u8, center, (length * 1.5, length * 1.5), name) # Square cut to allow rotation
                
        cut_limb('left_shoulder', 'left_elbow', 'rear_upper_arm')
        cut_limb('left_elbow', 'left_wrist', 'rear_lower_arm')
        cut_limb('right_shoulder', 'right_elbow', 'front_upper_arm')
        cut_limb('right_elbow', 'right_wrist', 'front_lower_arm')
        
        cut_limb('left_hip', 'left_knee', 'rear_thigh')
        cut_limb('left_knee', 'left_ankle', 'rear_shin')
        cut_limb('right_hip', 'right_knee', 'front_thigh')
        cut_limb('right_knee', 'right_ankle', 'front_shin')
        
        # Hips (Pelvis)
        if 'left_hip' in pts and 'right_hip' in pts:
             mid_hip = (np.array(pts['left_hip']) + np.array(pts['right_hip'])) / 2
             hip_w = np.linalg.norm(np.array(pts['left_hip']) - np.array(pts['right_hip']))
             save_part(bgra, mask_u8, mid_hip, (hip_w * 2.0, hip_w * 1.5), 'hip')

    # 2. Extract Joints
    if res and res.pose_landmarks and len(res.pose_landmarks) > 0:
        lms = res.pose_landmarks[0]
        for i, lm in enumerate(lms):
            if i in KEYS:
                idx2 = KEYS.index(i)
                name = NAMES[idx2]
                raw_x = lm.x * width
                raw_y = lm.y * height
                
                # Apply Smoothing
                sx = smoothers[name]['x'].update(raw_x)
                sy = smoothers[name]['y'].update(raw_y)
                
                joints.append({
                    'name': name,
                    'x': sx,
                    'y': sy,
                    'c': 1.0
                })
        
        # Overlay Drawing
        name_to_pt = {j['name']: (int(j['x']), int(j['y'])) for j in joints}
        for a,b in EDGES:
            if a in name_to_pt and b in name_to_pt:
                cv2.line(frame, name_to_pt[a], name_to_pt[b], (0, 255, 0), 2, lineType=cv2.LINE_AA)
        for j in joints:
            cv2.circle(frame, (int(j['x']), int(j['y'])), 3, (0, 255, 0), -1)
            
    writer.write(frame)
    results_list.append({'t': idx / fps, 'joints': joints})
    idx += 1

cap.release()
writer.release()
with open(out_json, 'w') as f:
    json.dump({'meta':{'fps':fps,'frame_count':idx,'keypoint_schema':'33->17','source_video':video_path},'frames':results_list}, f)
`;

  const tmpPy = path.join(path.dirname(outJsonPath), '_tmp_pose.py');
  await writeFile(tmpPy, pyScript);

  const userSite = (process.env.HOME ? path.join(process.env.HOME, 'Library/Python/3.9/lib/python/site-packages') : undefined);

  return new Promise((resolve, reject) => {
    const py = spawn('/Applications/Xcode.app/Contents/Developer/usr/bin/python3', [tmpPy, videoPath, outOverlayPath, outJsonPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONPATH: [userSite, process.env.PYTHONPATH].filter(Boolean).join(':'),
      }
    });
    let out = '';
    let err = '';
    py.stdout?.on('data', (d) => (out += d.toString()));
    py.stderr?.on('data', (d) => (err += d.toString()));
    py.on('close', async (code) => {
      try {
        if (logPath) {
          const log = `STDOUT:\n${out}\n\nSTDERR:\n${err}`;
          await writeFile(logPath, log);
        }
      } catch {}
      if (code === 0) {
        try {
          await reencodeH264(outOverlayPath, logPath);
        } catch {}
        resolve();
      }
      else {
        const tail = (err || out).split('\n').slice(-6).join('\n');
        reject(new Error(`Pose extract failed: ${tail}`));
      }
    });
  });
}

/**
 * 快速单帧测试函数
 */
// reserved: single-frame test helper can be re-added if needed
