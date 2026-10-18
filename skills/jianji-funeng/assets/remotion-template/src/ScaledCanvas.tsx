import React from 'react';
import {AbsoluteFill,useVideoConfig} from 'remotion';
export const ScaledCanvas:React.FC<{children:React.ReactNode}> = ({children})=>{
  const {width,height}=useVideoConfig();
  const scale=Math.min(width/1920,height/1080);
  return <AbsoluteFill style={{background:'#080808'}}><div style={{position:'absolute',left:(width-1920*scale)/2,top:(height-1080*scale)/2,width:1920,height:1080,transform:`scale(${scale})`,transformOrigin:'top left'}}>{children}</div></AbsoluteFill>;
};
