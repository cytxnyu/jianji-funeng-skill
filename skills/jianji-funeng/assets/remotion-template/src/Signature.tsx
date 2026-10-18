import React,{useId} from 'react';
import {Easing,interpolate} from 'remotion';

const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};

/** Small white signature, isolated from the title and written once, then held. */
export const Signature:React.FC<{frame:number;x:number;baseline:number;color:string;text:string}> = ({frame,x,baseline,color,text}) => {
  const id=`signature-${useId().replace(/:/g,'')}`;
  const progress=interpolate(frame,[31,46],[0,1],{...clamp,easing:Easing.bezier(.28,.05,.30,1)});
  const underline=interpolate(frame,[43,52],[0,1],{...clamp,easing:Easing.bezier(.2,.5,.2,1)});
  if(!text)return null;
  return <g aria-label={text}>
    <defs><clipPath id={id}><rect x={x-118} y={baseline-140} width={236*progress} height="192"/></clipPath></defs>
    <text x={x} y={baseline} textAnchor="middle" fontFamily="ReferenceScript" fontSize="152" textLength="184" lengthAdjust="spacingAndGlyphs" fill={color} clipPath={`url(#${id})`}>{text}</text>
    {underline>0&&<path d={`M${x-75} ${baseline+27} Q${x+16} ${baseline+7} ${x+94} ${baseline+14}`} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1-underline} opacity=".74"/>}
  </g>;
};
