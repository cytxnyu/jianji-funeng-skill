import {useEffect, useState} from 'react';
import {loadFont} from '@remotion/fonts';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
const ready = Promise.all([
  loadFont({family:'ReferenceSerif', url:staticFile('fonts/SourceHanSerifCN-Heavy.otf'), weight:'900'}),
  loadFont({family:'ReferenceTimes', url:staticFile('fonts/LibreBaskerville.ttf'), weight:'400'}),
  loadFont({family:'ReferenceTimesBold', url:staticFile('fonts/LibreBaskerville.ttf'), weight:'700'}),
  loadFont({family:'ReferenceScript', url:staticFile('fonts/Allura-Regular.ttf')}),
  loadFont({family:'ReferenceSans', url:staticFile('fonts/NotoSansSC-Regular.otf')}),
]);
export const useFontsReady = () => {
  const [loaded,setLoaded]=useState(false);
  const [handle]=useState(()=>delayRender('Loading bundled OFL fonts'));
  useEffect(()=>{ready.then(()=>{setLoaded(true);continueRender(handle);}).catch(cancelRender);},[handle]);
  return loaded;
};
