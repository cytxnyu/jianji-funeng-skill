import React from 'react';
import {Composition} from 'remotion';
import {ChapterTitle,chapterSchema,ChapterProps} from './ChapterTitle';
import {PromptCard,promptSchema,PromptProps} from './PromptCard';
import {ScaledCanvas} from './ScaledCanvas';
const Chapter:React.FC<ChapterProps> = p=><ScaledCanvas><ChapterTitle {...p}/></ScaledCanvas>;
const Prompt:React.FC<PromptProps> = p=><ScaledCanvas><PromptCard {...p}/></ScaledCanvas>;
export const RemotionRoot:React.FC=()=> <>
  <Composition id="Part01" component={Chapter} width={1920} height={1080} fps={30} durationInFrames={60} schema={chapterSchema} defaultProps={{titleLines:['整理素材'],chapter:'01',signature:'cyt',subtitle:'',signatureColor:'#FFFFFF',accentColor:'#D7AF62',durationSeconds:2}}/>
  <Composition id="PromptCard" component={Prompt} width={1920} height={1080} fps={30} durationInFrames={60} schema={promptSchema} defaultProps={{label:'提示词',lines:['请按主题归类','输出三列清单'],highlightLine:1,caption:'输入这段提示词',highlightColor:'#F276AE',accentColor:'#DDC16B',durationSeconds:2}}/>
</>;
