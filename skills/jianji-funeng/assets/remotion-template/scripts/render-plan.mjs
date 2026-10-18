import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option=name=>{
  const index=process.argv.indexOf(name);
  if(index<0 || !process.argv[index+1]) throw new Error(`Missing ${name}`);
  return path.resolve(process.argv[index+1]);
};
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
let browser;
try {
  const planFile=option('--plan'), out=option('--out');
  const checked=spawnSync(process.env.PYTHON || 'python', [path.join(root,'scripts/validate-plan.py'),'validate','--plan',planFile], {encoding:'utf8'});
  if(checked.error) throw checked.error;
  if(checked.status!==0) throw new Error(checked.stderr || checked.stdout || 'Plan validation failed');
  const bytes=fs.readFileSync(planFile);
  const plan=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  if(fs.existsSync(out)) throw new Error('Output directory already exists; choose a fresh directory');
  fs.mkdirSync(out,{recursive:true});
  const manifest={schemaVersion:1,planSha256:hash(bytes),fps:plan.fps,width:plan.source.width,height:plan.source.height,clips:[]};
  if(plan.segments.length){
    const serveUrl=await bundle({entryPoint:path.join(root,'src/index.ts'),publicDir:path.join(root,'public')});
    browser=await openBrowser('chrome',{browserExecutable:process.env.REMOTION_BROWSER_EXECUTABLE || null,chromiumOptions:{gl:'swangle'}});
    for(const segment of plan.segments){
      const frames=Math.round(segment.end*plan.fps)-Math.round(segment.start*plan.fps);
      const defaults=segment.type==='chapter'
        ? {chapter:'01',signature:'cyt',subtitle:'',signatureColor:'#FFFFFF',accentColor:'#D7AF62'}
        : {label:'提示词',highlightLine:0,caption:'输入这段提示词',highlightColor:'#F276AE',accentColor:'#DDC16B'};
      const inputProps={...defaults,...segment.props,durationSeconds:frames/plan.fps};
      const id=segment.type==='chapter'?'Part01':'PromptCard';
      const selected=await selectComposition({serveUrl,id,inputProps,puppeteerInstance:browser});
      const composition={...selected,durationInFrames:frames,fps:plan.fps,width:plan.source.width,height:plan.source.height};
      const file=`${segment.id}.mp4`, still=`${segment.id}.png`;
      await renderStill({serveUrl,composition,inputProps,frame:frames-1,output:path.join(out,still),imageFormat:'png',puppeteerInstance:browser});
      await renderMedia({serveUrl,composition,inputProps,codec:'h264',crf:18,pixelFormat:'yuv420p',imageFormat:'png',
        outputLocation:path.join(out,file),puppeteerInstance:browser,concurrency:2});
      manifest.clips.push({id:segment.id,file,still,composition:id,frames,duration:frames/plan.fps,props:inputProps,
        sha256:hash(fs.readFileSync(path.join(out,file)))});
      console.log(JSON.stringify({result:'PASS',id:segment.id,frames,fps:plan.fps,file}));
    }
  }
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(JSON.stringify({result:'PASS',clips:manifest.clips.length,manifest:path.join(out,'manifest.json')}));
} catch(error){
  console.error(JSON.stringify({result:'FAIL',error:error.message}));
  process.exitCode=1;
} finally {
  if(browser) await browser.close({silent:true});
}
