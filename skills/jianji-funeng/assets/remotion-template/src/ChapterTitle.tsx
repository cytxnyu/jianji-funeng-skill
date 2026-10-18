import React, {useId} from 'react';
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {z} from 'zod';
import {useFontsReady} from './fonts';
import {Signature} from './Signature';

export const chapterSchema = z.object({
  titleLines: z.array(z.string().min(1)).min(1).max(3),
  chapter: z.string(),
  signature: z.string(),
  subtitle: z.string(),
  accentColor: z.string(),
  signatureColor: z.string().default('#FFFFFF'),
  durationSeconds: z.number().min(1).max(10),
});
export type ChapterProps = z.infer<typeof chapterSchema>;
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(.16, 1, .3, 1);
const runs = (s: string) => s.match(/[\u2e80-\u9fff]+|[^\u2e80-\u9fff]+/g) || [];
const family = (s: string) => /[\u2e80-\u9fff]/.test(s) ? 'ReferenceSerif' : 'ReferenceTimesBold';
const runWidth = (s: string, size: number) => measureText({text:s, fontFamily:family(s), fontSize:size, fontWeight:family(s)==='ReferenceSerif'?'900':'700'}).width;
const textWidth = (s: string, size: number) => runs(s).reduce((sum,r)=>sum+runWidth(r,size),0);
const mix = (hex: string, target: number, amount: number) => {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
  return `rgb(${rgb.map(v => Math.round(v+(target-v)*amount)).join(',')})`;
};

const TitleLine: React.FC<{text:string; baseline:number; size:number; fill:string; stroke?:string}> = ({text,baseline,size,fill,stroke}) => {
  let x=960-textWidth(text,size)/2;
  return <g data-title-line={text}>
    {runs(text).map((r,i)=>{
      const oldX=x; x+=runWidth(r,size);
      return <text key={i} x={oldX} y={baseline} fontFamily={family(r)} fontWeight={family(r)==='ReferenceSerif'?900:700} fontSize={size} fill={fill} stroke={stroke} strokeWidth={.4} paintOrder="stroke" strokeLinejoin="round">{r}</text>;
    })}
  </g>;
};

export const ChapterTitle: React.FC<ChapterProps> = ({titleLines,chapter,signature,subtitle,accentColor,signatureColor}) => {
  const actualFrame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const frame=Math.min(actualFrame*30/fps,60);
  const uid=useId().replace(/:/g,'');
  const ready=useFontsReady();
  if(!ready)return null;

  const maxUnit=Math.max(...titleLines.map(s=>textWidth(s,100)));
  const size=Math.min(titleLines.length===1?232:166,1480/maxUnit*100,titleLines.length===1?232:358/(1+(titleLines.length-1)*1.25));
  const row=size*1.23;
  const firstBaseline=titleLines.length===1?591:(titleLines.length===2?474:430);
  const footerY=titleLines.length===1?728:760;
  const goldId=`gold-${uid}`;
  const glintId=`glint-${uid}`;
  const glintX=interpolate(frame,[15,39],[-330,2220],clamp);
  const rule=interpolate(frame,[0,17],[0,1],{...clamp,easing:ease});

  return <AbsoluteFill style={{backgroundColor:'#060606',overflow:'hidden'}}>
    <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 43%, #211b10 0%, #0c0c0a 43%, #050505 78%)',opacity:interpolate(frame,[0,22],[.55,1],clamp)}}/>
    <Interactive.Svg name="Molten gold chapter / editable title" width="100%" height="100%" viewBox="0 0 1920 1080" style={{position:'absolute',inset:0}} aria-label={`Part.${chapter} ${titleLines.join('')}`}>
      <defs>
        <linearGradient id={goldId} gradientUnits="userSpaceOnUse" x1="0" y1="270" x2="0" y2="700">
          <stop offset="0" stopColor={mix(accentColor,255,.72)}/>
          <stop offset=".22" stopColor={mix(accentColor,0,.18)}/>
          <stop offset=".39" stopColor={mix(accentColor,255,.28)}/>
          <stop offset=".48" stopColor={mix(accentColor,255,.70)}/>
          <stop offset=".54" stopColor={mix(accentColor,0,.22)}/>
          <stop offset=".78" stopColor={mix(accentColor,255,.38)}/>
          <stop offset="1" stopColor={mix(accentColor,0,.17)}/>
        </linearGradient>
        <linearGradient id={glintId} gradientUnits="userSpaceOnUse" x1={glintX-150} y1="0" x2={glintX+150} y2="80">
          <stop offset="0" stopColor="#FFF3D4" stopOpacity="0"/>
          <stop offset=".44" stopColor="#FFF3D4" stopOpacity=".10"/>
          <stop offset=".52" stopColor="#FFF3D4" stopOpacity=".70"/>
          <stop offset=".62" stopColor="#FFF3D4" stopOpacity=".10"/>
          <stop offset="1" stopColor="#FFF3D4" stopOpacity="0"/>
        </linearGradient>
      </defs>

      <g opacity={interpolate(frame,[1,13],[0,1],clamp)} transform={`translate(0 ${interpolate(frame,[0,19],[16,0],{...clamp,easing:ease})})`}>
        <path d={`M${752-130*rule} 249H752 M1168 249H${1168+130*rule}`} stroke={accentColor} strokeWidth="1" opacity=".55"/>
        <text x="960" y="270" textAnchor="middle" fontFamily="ReferenceTimes" fontSize="76" fill={mix(accentColor,255,.35)} letterSpacing="2">Part.{chapter}</text>
      </g>

      {titleLines.map((text,i)=>{
        const start=4+i*4;
        const lift=interpolate(frame,[start,start+20],[54,0],{...clamp,easing:ease});
        const opacity=interpolate(frame,[start,start+12],[0,1],clamp);
        const baseline=firstBaseline+i*row;
        return <g key={i} transform={`translate(0 ${lift})`} opacity={opacity}>
          <g transform="translate(0 2)" opacity=".55"><TitleLine text={text} size={size} baseline={baseline} fill="#5A3D18"/></g>
          <TitleLine text={text} size={size} baseline={baseline} fill={`url(#${goldId})`} stroke={mix(accentColor,255,.20)}/>
          <TitleLine text={text} size={size} baseline={baseline} fill={`url(#${glintId})`}/>
        </g>;
      })}

      <g opacity={interpolate(frame,[21,33],[0,1],clamp)}>
        <path d={`M${960-68*interpolate(frame,[20,34],[0,1],{...clamp,easing:ease})} ${footerY-49}H${960+68*interpolate(frame,[20,34],[0,1],{...clamp,easing:ease})}`} stroke={accentColor} strokeWidth="1.1" opacity=".60"/>
        <text x="960" y={footerY} textAnchor="middle" fontFamily="ReferenceSans" fontSize="19" letterSpacing="7" fill={accentColor} opacity=".68">{subtitle}</text>
      </g>
    </Interactive.Svg>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,pointerEvents:'none'}} aria-label={`${signature} signature`}>
      <Signature frame={frame} x={960} baseline={footerY+130} color={signatureColor} text={signature}/>
    </svg>
  </AbsoluteFill>;
};
