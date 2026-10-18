import React from 'react';

export const Cursor: React.FC<{x:number;y:number;opacity?:number;scale?:number;outline?:boolean}> = ({x,y,opacity=1,scale=1,outline=false}) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
    <path d="M0 0 L0 29 L7.8 22.1 L13.6 35.4 L20 32.6 L14.3 19.8 L25.5 19.2 Z" fill={outline?'#090909':'#e3e3e3'} stroke={outline?'#757575':'#111'} strokeWidth="2" strokeLinejoin="round" />
  </g>
);

export const Selection: React.FC<{x:number;y:number;width:number;height:number;opacity?:number;solid?:boolean}> = ({x,y,width,height,opacity=1,solid=false}) => (
  <g opacity={opacity}>
    <rect x={x} y={y} width={width} height={height} fill="none" stroke="#757575" strokeWidth={1.5} strokeDasharray={solid?undefined:'3 5'} />
    {[[x,y],[x+width,y],[x,y+height],[x+width,y+height]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={4.5} fill="#929292"/>)}
  </g>
);

export const Star: React.FC<{x:number;y:number;size:number;color:string;opacity?:number}> = ({x,y,size,color,opacity=1}) => (
  <path d={`M${x} ${y-size} Q${x+size*.12} ${y-size*.13} ${x+size} ${y} Q${x+size*.12} ${y+size*.13} ${x} ${y+size} Q${x-size*.12} ${y+size*.13} ${x-size} ${y} Q${x-size*.12} ${y-size*.13} ${x} ${y-size}Z`} fill={color} opacity={opacity}/>
);
