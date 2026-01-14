
import { retargetPoseToSpine } from '../api/services/retarget.ts';
import { PoseJson } from '../api/services/poseExtractor.ts';
import fs from 'fs';
import path from 'path';

const dummyPose: PoseJson = {
  meta: { fps: 30, frame_count: 2, keypoint_schema: 'mediapipe', source_video: 'test.mp4' },
  frames: [
    {
      // Frame 0: Standing T-pose ish
      joints: [
        { name: 'mid_hip', x: 0.5, y: 0.5, c: 1 },
        { name: 'left_hip', x: 0.6, y: 0.5, c: 1 },
        { name: 'right_hip', x: 0.4, y: 0.5, c: 1 },
        { name: 'mid_shoulder', x: 0.5, y: 0.2, c: 1 }, // Torso up
        { name: 'left_shoulder', x: 0.7, y: 0.2, c: 1 },
        { name: 'right_shoulder', x: 0.3, y: 0.2, c: 1 },
        { name: 'nose', x: 0.5, y: 0.1, c: 1 },
        { name: 'left_elbow', x: 0.8, y: 0.2, c: 1 }, // Arm out
        { name: 'right_elbow', x: 0.2, y: 0.2, c: 1 },
        { name: 'left_wrist', x: 0.9, y: 0.2, c: 1 },
        { name: 'right_wrist', x: 0.1, y: 0.2, c: 1 },
        { name: 'left_knee', x: 0.6, y: 0.7, c: 1 }, // Leg down
        { name: 'right_knee', x: 0.4, y: 0.7, c: 1 },
        { name: 'left_ankle', x: 0.6, y: 0.9, c: 1 },
        { name: 'right_ankle', x: 0.4, y: 0.9, c: 1 },
        { name: 'left_foot_index', x: 0.65, y: 0.95, c: 1 },
        { name: 'right_foot_index', x: 0.35, y: 0.95, c: 1 }
      ]
    },
    {
      // Frame 1: Moved slightly
      joints: [
        { name: 'mid_hip', x: 0.51, y: 0.51, c: 1 },
        { name: 'left_hip', x: 0.61, y: 0.51, c: 1 },
        { name: 'right_hip', x: 0.41, y: 0.51, c: 1 },
        { name: 'mid_shoulder', x: 0.51, y: 0.21, c: 1 },
        { name: 'left_shoulder', x: 0.71, y: 0.21, c: 1 },
        { name: 'right_shoulder', x: 0.31, y: 0.21, c: 1 },
        { name: 'nose', x: 0.51, y: 0.11, c: 1 },
        { name: 'left_elbow', x: 0.81, y: 0.25, c: 1 }, // Arm moves down
        { name: 'right_elbow', x: 0.21, y: 0.21, c: 1 },
        { name: 'left_wrist', x: 0.91, y: 0.3, c: 1 },
        { name: 'right_wrist', x: 0.11, y: 0.21, c: 1 },
        { name: 'left_knee', x: 0.61, y: 0.71, c: 1 },
        { name: 'right_knee', x: 0.41, y: 0.71, c: 1 },
        { name: 'left_ankle', x: 0.61, y: 0.91, c: 1 },
        { name: 'right_ankle', x: 0.41, y: 0.91, c: 1 },
        { name: 'left_foot_index', x: 0.66, y: 0.96, c: 1 },
        { name: 'right_foot_index', x: 0.36, y: 0.96, c: 1 }
      ]
    }
  ]
};

async function run() {
  const outPath = path.resolve(process.cwd(), 'tests/debug_output.json');
  console.log("Running retarget...");
  await retargetPoseToSpine(dummyPose, outPath, 'spineboy');
  
  const content = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  const anim = content.animations.video_retarget;
  
  console.log("Animation Keys found:", Object.keys(anim.bones));
  
  // Print some sample rotations
  ['torso', 'front_upper_arm', 'rear_upper_arm', 'front_thigh'].forEach(b => {
    if (anim.bones[b]) {
        console.log(`Bone ${b}:`, JSON.stringify(anim.bones[b].rotate));
    } else {
        console.log(`Bone ${b}: MISSING`);
    }
  });

  // Check for IK constraints
  console.log("IK Constraints:", content.ik);
  console.log("Transform Constraints:", content.transform);
}

run().catch(console.error);
