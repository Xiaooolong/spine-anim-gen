
import fs from 'fs';
import path from 'path';

const JOB_ID = '2720fb3f-5b7d-431b-bf51-3768280288e3';
const JOB_DIR = path.resolve(process.cwd(), 'jobs', JOB_ID);
const OUT_SPINE = path.join(JOB_DIR, 'spine_animation.json');

const content = JSON.parse(fs.readFileSync(OUT_SPINE, 'utf-8'));
const anim = content.animations['video_retarget_v2'];

if (!anim) {
    console.error("Animation video_retarget_v2 NOT FOUND!");
} else {
    console.log("Animation found.");
    const bones = Object.keys(anim.bones || {});
    console.log("Bones in animation:", bones);
    
    if (bones.includes('head')) {
        console.log("Head rotation sample:", anim.bones.head.rotate.slice(0, 5));
    } else {
        console.error("HEAD BONE MISSING in animation data!");
    }
}
