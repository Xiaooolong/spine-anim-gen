
import { retargetPoseToSpine } from '../api/services/retarget.ts';
import fs from 'fs';
import path from 'path';

const JOB_ID = '91f43f99-2040-487f-9c63-876fa535da63';
const JOB_DIR = path.resolve(process.cwd(), 'jobs', JOB_ID);
const POSE_JSON = path.join(JOB_DIR, 'pose_2d.json');
const OUT_SPINE = path.join(JOB_DIR, 'spine_animation.json');

async function run() {
  if (!fs.existsSync(POSE_JSON)) {
      console.error("Pose JSON not found:", POSE_JSON);
      process.exit(1);
  }

  console.log("Reading Pose JSON...");
  const poseData = JSON.parse(fs.readFileSync(POSE_JSON, 'utf-8'));
  
  console.log("Regenerating Spine Animation...");
  await retargetPoseToSpine(poseData, OUT_SPINE, 'spineboy');
  
  console.log("Done! Check", OUT_SPINE);
}

run().catch(console.error);
