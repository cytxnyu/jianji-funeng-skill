import React from 'react';
import {AbsoluteFill,Easing,Interactive,interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {z} from 'zod';
import {useFontsReady} from './fonts';
import {Star} from './Shapes';

export const promptSchema=z.object({label:z.string(),lines:z.array(z.string()).min(1).max(8),highlightLine:z.number().int().min(0).max(7),caption:z.string(),accentColor:z.string(),highlightColor:z.string().default('#F276AE'),durationSeconds:z.number().min(2).max(60)});
export type PromptProps=z.infer<typeof promptSchema>;
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
const ease=Easing.bezier(.6,.05,.2,1);
const W=1658,H=650;

const Graphic:React.FC<PromptProps&{frame:number;id:string}> = ({label,lines,highlightLine,accentColor,highlightColor,frame,id})=>{
  const maxWidth=Math.max(...lines.map(t=>measureText({text:t,fontFamily:'ReferenceSans',fontSize:34}).width));
  const size=Math.min(34,(W-72)/maxWidth*34);
  const top=142;const step=Math.min(87,420/Math.max(1,lines.length-1));
  const hl=lines[Math.min(highlightLine,lines.length-1)];
  const hlWidth=measureText({text:hl,fontFamily:'ReferenceSans',fontSize:size}).width+14;
  const hp=interpolate(frame,[29,44],[0,1],{...clamp,easing:Easing.bezier(.33,0,.2,1)});
  const glow=.75+Math.sin(frame*.18)*.15;
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
    <defs>
      <radialGradient id={`bloom-${id}`}><stop offset="0" stopColor={accentColor} stopOpacity=".56"/><stop offset="1" stopColor={accentColor} stopOpacity="0"/></radialGradient>
      <linearGradient id={`gold-${id}`} x1="0" x2="1"><stop offset="0" stopColor="#51452c"/><stop offset=".48" stopColor={accentColor}/><stop offset="1" stopColor="#51452c"/></linearGradient>
    </defs>
    <rect x="1" y="1" width={W-2} height={H-2} rx="16" fill="#020202" stroke={`url(#gold-${id})`} strokeWidth="1.5"/>
    <rect x="5" y="5" width={W-10} height={H-10} rx="13" fill="none" stroke="#4a422c" strokeWidth=".8" opacity=".7"/>
    <ellipse cx={W/2} cy={H-5} rx="180" ry="55" fill={`url(#bloom-${id})`} opacity={glow}/>
    <ellipse cx="42" cy="42" rx="54" ry="48" fill={`url(#bloom-${id})`} opacity=".38"/>
    <Star x={39} y={43} size={15} color={accentColor}/><Star x={20} y={23} size={5} color={accentColor}/><Star x={61} y={22} size={6} color={accentColor}/><Star x={62} y={59} size={5} color={accentColor}/>
    <text x="76" y="53" fontFamily="ReferenceSans" fontSize="28" fill={accentColor} letterSpacing="3">{label}</text>
    <rect x="26" y={top+Math.min(highlightLine,lines.length-1)*step-size+1} width={hlWidth*hp} height={size+16} rx="5" fill={highlightColor} opacity={interpolate(frame,[27,30],[0,.72],clamp)}/>
    {lines.map((t,i)=><text key={i} x="33" y={top+i*step} fontFamily="ReferenceSans" fontSize={size} fill="#efefeb">{t}</text>)}
    <Star x={W/2+Math.sin(frame*.07)*16} y={H-4} size={16+Math.sin(frame*.13)*2} color="#fff6ba"/>
  </svg>;
};

export const PromptCard:React.FC<PromptProps> = props=>{
  const f=useCurrentFrame();const {fps}=useVideoConfig();const frame=Math.min(f*30/fps,60);
  const loaded=useFontsReady();if(!loaded)return null;
  const bend=interpolate(frame,[0,18],[1,0],{...clamp,easing:ease});
  const count=24;const step=W/count;
  let sx=0,sz=0;
  const strips=Array.from({length:count},(_,i)=>{
    const theta=bend*(.12+(i/count)*1.88);const pos={x:sx,z:sz,theta};sx+=step*Math.cos(theta);sz+=step*Math.sin(theta);return pos;
  });
  return <AbsoluteFill style={{backgroundColor:'#121212',overflow:'hidden'}}>
    <AbsoluteFill style={{background:'radial-gradient(ellipse at 25% 35%, #373126 0%, #151515 44%, #080808 100%)'}}/>
    <AbsoluteFill style={{backgroundColor:'rgba(0,0,0,.10)'}}/>
    <Interactive.Div name="Prompt card / curl in" style={{position:'absolute',left:131,top:203,width:W,height:H,perspective:1800,perspectiveOrigin:'50% 50%',opacity:interpolate(frame,[0,3],[0,1],clamp),translate:interpolate(frame,[0,18],['-290px 38px','0px 0px'],{...clamp,easing:ease}),scale:interpolate(frame,[0,18],[.78,1],{...clamp,easing:ease})}}>
      {frame<18?strips.map((s,i)=><div key={i} style={{position:'absolute',left:0,top:0,width:step+.6,height:H,overflow:'hidden',transformOrigin:'left center',transform:`translate3d(${s.x}px,${Math.sin(i/count*Math.PI)*bend*34}px,${s.z}px) rotateY(${-s.theta*180/Math.PI}deg)`,backfaceVisibility:'hidden'}}><div style={{position:'absolute',left:-i*step,top:0}}><Graphic {...props} frame={frame} id={`strip-${i}`}/></div><div style={{position:'absolute',inset:0,backgroundColor:'#000',opacity:Math.min(.50,s.theta*.15)}}/></div>):<Graphic {...props} frame={frame} id="flat"/>}
    </Interactive.Div>
    <svg width="1920" height="1080" style={{position:'absolute',inset:0}}><text x="960" y="960" textAnchor="middle" fontFamily="ReferenceSans" fontSize="44" fontWeight="900" fill="white" stroke="#080808" strokeWidth="7" paintOrder="stroke" opacity={interpolate(frame,[5,12],[0,1],clamp)}>{props.caption}</text></svg>
  </AbsoluteFill>;
};
