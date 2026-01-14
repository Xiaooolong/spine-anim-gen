import { PoseJson } from './poseExtractor';
import { writeFile, readFile, copyFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export type SpineAnimationJson = {
  skeleton: { hash: string; spine: string; x: number; y: number; width: number; height: number; images: string };
  bones: Array<{ name: string; parent?: string; length?: number; rotation?: number; x?: number; y?: number }>;
  slots: Array<{ name: string; bone: string; attachment?: string }>;
  skins: Array<{ name: string; attachments: Record<string, Record<string, { type?: string; name?: string; x?: number; y?: number; scaleX?: number; scaleY?: number; rotation?: number; width?: number; height?: number }>> }>;
  animations: Record<string, {
    bones?: Record<string, { rotate?: Array<{ time: number; value: number }>; translate?: Array<{ time: number; x: number; y: number }> }>;
  }>;
};

// Helper to get joint pos
const getJ = (frame: any, name: string) => {
  if (name === 'mid_hip') {
    const l = frame.joints.find((j: any) => j.name === 'left_hip');
    const r = frame.joints.find((j: any) => j.name === 'right_hip');
    if (l && r) return { x: (l.x + r.x)/2, y: (l.y + r.y)/2 };
    return l || r;
  }
  if (name === 'mid_shoulder') {
    const l = frame.joints.find((j: any) => j.name === 'left_shoulder');
    const r = frame.joints.find((j: any) => j.name === 'right_shoulder');
    if (l && r) return { x: (l.x + r.x)/2, y: (l.y + r.y)/2 };
    return l || r;
  }
  return frame.joints.find((j: any) => j.name === name);
};

export async function retargetPoseToSpine(
  poseJson: PoseJson,
  outSpineAnimPath: string,
  profile: 'spineboy' | 'custom' = 'spineboy' // Default to spineboy now
): Promise<void> {
  const jobDir = path.dirname(outSpineAnimPath);

  if (profile === 'spineboy') {
    await retargetToSpineboy(poseJson, outSpineAnimPath, jobDir);
  } else {
    // Legacy custom generation (kept for reference or fallback)
    // For now, we only support spineboy as per user request
    await retargetToSpineboy(poseJson, outSpineAnimPath, jobDir);
  }
}

async function retargetToSpineboy(poseJson: PoseJson, outPath: string, jobDir: string) {
  const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets/spine');
  const spineboyJsonPath = path.join(ASSETS_DIR, 'spineboy.json');
  const spineboyAtlasPath = path.join(ASSETS_DIR, 'spineboy.atlas');
  const spineboyPngPath = path.join(ASSETS_DIR, 'spineboy.png');

  // 1. Copy Assets
  await copyFile(spineboyPngPath, path.join(jobDir, 'spineboy.png'));
  // Write atlas but keep reference to spineboy.png
  let atlasContent = await readFile(spineboyAtlasPath, 'utf-8');
  // Ensure the atlas content is valid and ends with newline
  await writeFile(path.join(jobDir, 'spine_animation.atlas'), atlasContent);

  // 2. Read Template
  const template = JSON.parse(await readFile(spineboyJsonPath, 'utf-8')) as SpineAnimationJson;
  // Ensure images path points to current directory since we copy spineboy.png here
  template.skeleton.images = './';

  // 3. Map Bones & Calculate Setup Rotations
  // Bone Map: SpineBone -> MediaPipeJoints (Start, End)
  const boneMap: Record<string, [string, string]> = {
    'root': ['mid_hip', 'mid_hip'], // Dummy
    'hip': ['mid_hip', 'mid_shoulder'], // Hip in Spineboy is usually Root-relative, but visually it's the pelvis. 
                                        // Wait, spineboy 'hip' is the root bone for the upper body/legs.
                                        // Let's treat 'hip' as the pelvis.
    'torso': ['mid_hip', 'mid_shoulder'],
    'head': ['mid_shoulder', 'nose'],
    'rear_thigh': ['left_hip', 'left_knee'],
    'rear_shin': ['left_knee', 'left_ankle'],
    'rear_foot': ['left_ankle', 'left_foot_index'], // Optional
    'front_thigh': ['right_hip', 'right_knee'],
    'front_shin': ['right_knee', 'right_ankle'],
    'front_foot': ['right_ankle', 'right_foot_index'],
    'rear_upper_arm': ['left_shoulder', 'left_elbow'],
    'rear_bracer': ['left_elbow', 'left_wrist'],
    'front_upper_arm': ['right_shoulder', 'right_elbow'],
    'front_bracer': ['right_elbow', 'right_wrist']
  };

  // Calculate Global Setup Rotations for Spineboy
  const boneSetupGlobal: Record<string, number> = {};
  
  // We need to traverse bones in order of hierarchy to compute global angles
  // bones array in JSON is usually ordered? Not guaranteed.
  // Let's build a tree or map
  const boneDefMap = new Map<string, any>();
  template.bones.forEach(b => boneDefMap.set(b.name, b));

  function getGlobalSetup(name: string): number {
    if (boneSetupGlobal[name] !== undefined) return boneSetupGlobal[name];
    
    const b = boneDefMap.get(name);
    if (!b) return 0;

    let rot = b.rotation || 0;
    if (b.parent) {
      rot += getGlobalSetup(b.parent);
    }
    boneSetupGlobal[name] = rot;
    return rot;
  }

  // Pre-calculate all globals
  template.bones.forEach(b => getGlobalSetup(b.name));

  // 4. Generate Animation
  const fps = poseJson.meta.fps || 30;
  const newAnimBones: Record<string, { rotate: any[], translate: any[] }> = {};

  poseJson.frames.forEach((frame, i) => {
    const time = i / fps;
    
    // Compute MediaPipe Global Angles (Converted to Spine Space: -MP)
    const mpGlobals: Record<string, number> = {};

    Object.entries(boneMap).forEach(([spineName, [kpStart, kpEnd]]) => {
      const start = getJ(frame, kpStart);
      const end = getJ(frame, kpEnd);
      
      if (start && end && kpStart !== kpEnd) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        // MP: Y-down. Angle 0 is +X. 90 is +Y (Down).
        // Spine: Y-up. Angle 0 is +X. 90 is +Y (Up).
        // SpineGlobal = -MPAngle
        const mpAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        mpGlobals[spineName] = -mpAngle;
      } else {
        // Fallback or root
        mpGlobals[spineName] = boneSetupGlobal[spineName] || 0;
      }
    });

    // Compute Local Rotations
    Object.keys(boneMap).forEach(spineName => {
      const def = boneDefMap.get(spineName);
      if (!def) return;
      if (spineName === 'root') return; // Skip root

      const targetGlobal = mpGlobals[spineName];
      // Target = ParentGlobal + SetupLocal + AnimLocal
      // AnimLocal = Target - ParentGlobal - SetupLocal
      
      let parentGlobal = 0;
      if (def.parent) {
        // For parent global, should we use the Target global of the parent (strict retargeting)
        // or the actual setup global?
        // To maintain the chain integrity (FK), we should use the TARGET global of the parent.
        // This ensures that if the parent rotates X, the child rotates relative to X to achieve its own target.
        if (boneMap[def.parent]) {
             parentGlobal = mpGlobals[def.parent];
        } else {
             // Parent is not mapped (e.g. 'neck' might be skipped if we map head directly to torso?)
             // If parent is not mapped, we assume it stays at Setup Pose Global?
             // Or we calculate its setup global.
             // Let's use getGlobalSetup(def.parent) but we need to account for any animated ancestors?
             // Simplification: Assume unmapped bones stay rigid relative to mapped ancestors?
             // Better: Use `boneSetupGlobal` for unmapped parents, but added to nearest mapped ancestor's delta?
             // For now: assume parentGlobal = boneSetupGlobal[def.parent] if not mapped.
             parentGlobal = boneSetupGlobal[def.parent];
        }
      }

      const setupLocal = def.rotation || 0;
      let animLocal = targetGlobal - parentGlobal - setupLocal;
      
      // Normalize
      while (animLocal > 180) animLocal -= 360;
      while (animLocal < -180) animLocal += 360;
      
      if (!newAnimBones[spineName]) newAnimBones[spineName] = { rotate: [], translate: [] };
      // Only push if valid number
      if (Number.isFinite(animLocal)) {
        newAnimBones[spineName].rotate.push({ time, value: animLocal });
      }
    });

    // Root/Hip Translation
    const hip = getJ(frame, 'mid_hip');
    if (hip) {
       // Map MP coordinates to Spine coordinates
       // We use the first frame as the origin (0,0) for translation to avoid large offsets
       const firstHip = getJ(poseJson.frames[0], 'mid_hip');
       if (firstHip) {
         // Spine Y is Up, MP Y is Down.
         // Scale? We don't know the scale. Let's assume 1:1 for now or 0.5.
         // MP coordinates are usually ~1000px. Spineboy is ~500px tall?
         // Let's use 1.0 for now.
         
         const dx = hip.x - firstHip.x;
         const dy = hip.y - firstHip.y;
         
         // Invert Y for Spine
         if (!newAnimBones['hip']) newAnimBones['hip'] = { rotate: [], translate: [] };
         // Ensure translate array exists
         if (!newAnimBones['hip'].translate) newAnimBones['hip'].translate = [];
         
         newAnimBones['hip'].translate.push({ 
           time, 
           x: dx, 
           y: -dy 
         });
       }
    }
  });

  // Clean up empty arrays
  Object.keys(newAnimBones).forEach(k => {
    const b = newAnimBones[k];
    if (b.rotate && b.rotate.length === 0) delete (b as any).rotate;
    if (b.translate && b.translate.length === 0) delete (b as any).translate;
    if (!b.rotate && !b.translate) delete newAnimBones[k];
  });

  // 5. Inject Animation
  // Preserve existing animations (walk, run, etc.) and add/overwrite our retarget animation
  template.animations = {
    ...template.animations,
    'video_retarget_v2': {
      bones: newAnimBones
    }
  };
  
  // Remove IK and Transform constraints to avoid interference with FK retargeting
  if ((template as any).ik) (template as any).ik = [];
  if ((template as any).transform) (template as any).transform = [];
  if ((template as any).path) (template as any).path = [];

  // Write Result
  await writeFile(outPath, JSON.stringify(template, null, 2));
}

// Legacy helper (unused now but kept for compilation if referenced elsewhere)
async function getPngSize(filePath: string) { return { width: 0, height: 0 }; }
async function generateAtlas(dir: string, images: string[]) { return ''; }

