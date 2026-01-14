
import fs from 'fs';
import path from 'path';

const JOB_ID = '91f43f99-2040-487f-9c63-876fa535da63';
const JSON_PATH = path.join(process.cwd(), 'jobs', JOB_ID, 'spine_animation.json');

function compare() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error('File not found:', JSON_PATH);
    return;
  }

  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  const anims = data.animations;

  if (!anims) {
    console.error('No animations found');
    return;
  }

  const walk = anims['walk'];
  const generated = anims['video_retarget_v2'];

  if (!walk) console.error('Walk animation not found');
  if (!generated) console.error('Generated animation not found');

  if (walk && generated) {
    console.log('=== STRUCTURE COMPARISON ===');
    
    // Compare Bones keys
    const walkBones = walk.bones ? Object.keys(walk.bones) : [];
    const genBones = generated.bones ? Object.keys(generated.bones) : [];
    console.log(`Walk Bones Count: ${walkBones.length}`);
    console.log(`Gen Bones Count: ${genBones.length}`);
    
    // Pick a common bone
    const commonBone = 'head'; // 'hip' or 'front_thigh'
    
    console.log(`\n=== BONE: ${commonBone} ===`);
    
    if (walk.bones && walk.bones[commonBone]) {
        console.log('[WALK] Keys:', Object.keys(walk.bones[commonBone]));
        if (walk.bones[commonBone].rotate) {
            console.log('[WALK] Rotate Frame 0:', JSON.stringify(walk.bones[commonBone].rotate[0], null, 2));
        } else {
            console.log('[WALK] No rotate timeline');
        }
        if (walk.bones[commonBone].translate) {
            console.log('[WALK] Translate Frame 0:', JSON.stringify(walk.bones[commonBone].translate[0], null, 2));
        }
    } else {
        console.log('[WALK] Bone not found');
    }

    if (generated.bones && generated.bones[commonBone]) {
        console.log('[GEN] Keys:', Object.keys(generated.bones[commonBone]));
        if (generated.bones[commonBone].rotate) {
            console.log('[GEN] Rotate Frame 0:', JSON.stringify(generated.bones[commonBone].rotate[0], null, 2));
        } else {
            console.log('[GEN] No rotate timeline');
        }
    } else {
        console.log('[GEN] Bone not found');
    }

    // Check hip specifically for translation vs rotation
    console.log(`\n=== BONE: hip ===`);
    if (walk.bones && walk.bones['hip']) {
        console.log('[WALK] Hip Keys:', Object.keys(walk.bones['hip']));
    }
    if (generated.bones && generated.bones['hip']) {
        console.log('[GEN] Hip Keys:', Object.keys(generated.bones['hip']));
    }
  }
}

compare();
