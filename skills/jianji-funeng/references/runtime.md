# 运行与验收

## 环境

Python 3.10+（脚本仅用标准库）、FFmpeg／ffprobe 在 PATH，Node.js 20.19+／22.13+／24+ 与 npm。Remotion、React 和 Zod 版本由模板 lockfile 固定。Chrome 首次运行可由 Remotion 下载；已有 Chrome 时设置 `REMOTION_BROWSER_EXECUTABLE`，代码不绑定任何人的电脑路径。

命令中的 `SKILL_DIR`、`WORK`、`PLAN`、`OUT` 均由执行者替换为实际路径；含空格时引用路径。PowerShell 可使用 `python`、`node`、`npm.cmd`；不要假定 Python 或 Node 的安装盘符。

## 常规视频任务

```bash
python SKILL_DIR/scripts/pipeline.py inspect --video input.mp4 --srt subtitles.srt --out analysis
python SKILL_DIR/scripts/pipeline.py init --workdir WORK
```

先读 `analysis/media.json`、`analysis/cues.json` 并查看 sample 图片与候选时间点。Agent 根据内容写 PLAN，然后：

```bash
python SKILL_DIR/scripts/pipeline.py validate --plan PLAN --cues analysis/cues.json
cd WORK
npm ci
npm run typecheck
node scripts/render-plan.mjs --plan PLAN --out OUT
python SKILL_DIR/scripts/pipeline.py assemble --video input.mp4 --plan PLAN --clips OUT --out enhanced.mp4
```

所有跨目录路径使用绝对路径，避免 cd 之后定位错误。`render-plan.mjs` 再次调用同一校验器，所以 init 会把校验器一并放到工作工程的 `scripts/validate-plan.py`。可用环境变量 `PYTHON` 指定 Python 可执行文件。

渲染输出每段 MP4、最后一帧 PNG、manifest.json（包含计划与 MP4 SHA-256）。计划或视频片段被改动后必须重新渲染，合成器会阻止错配。输出目录必须是新的；不会静默覆盖已有成片。

## 只有字幕／稿件

- SRT：`python SKILL_DIR/scripts/pipeline.py cues --srt subtitles.srt --out cues.json`；先做计划、组件和时间表，得到视频再合成。
- 无时间轴稿件：先给语义选点和文字，不把估算秒数当真实位置。需要外观时使用 `purpose=preview` 独立导出；问一个问题取得媒体或时间轴即可。
- 没有匹配内容：edit 计划允许空 segments；合成器复制源视频到新文件，保持字节一致，并明确“没有添加组件”。

## 两段 2 秒演示

把 `assets/examples/preview-plan.json` 复制到工作目录，validate 后执行 render-plan。里面的文字是公开合成示例，不是从用户视频偷取的字幕。两段演示分别为鎏金标题／白色 cyt、中文提示词／粉色高亮。

## 验收

1. typecheck 与计划校验通过；校验脚本不会代替语义判断。
2. ffprobe 检查输出时长＝对应帧差／fps；FFmpeg 完整解码没有错误。
3. 查看入场、稳定、高亮和末帧；标题、署名、提示词、颜色、换行、符号与计划一致。
4. 合成片长与原片相差最多 2 帧；源文件 SHA-256 不变，原音轨存在，试听检查连续性。AAC／MP3／ALAC 音轨直接复制；其他音频转 AAC，结果会记录 audioCodecMode。
5. 逐个切入／退出点检查误遮挡、跳切、错时与阅读速度。2 秒样片不证明长提示词已经能读完。

## 复用到已有 Remotion 工程

复制模板的 `src/ChapterTitle.tsx`、`PromptCard.tsx`、`Signature.tsx`、`Shapes.tsx`、`fonts.ts` 和对应 public/fonts。版本匹配后从 components.ts 导入。两个组件是 1920×1080 设计画布，其他横版尺寸由 ScaledCanvas 等比例缩放。

```tsx
<Sequence from={startFrame} durationInFrames={durationFrames}>
  <ScaledCanvas>
    <ChapterTitle {...props} durationSeconds={durationFrames / fps} />
  </ScaledCanvas>
</Sequence>
```

动画按组件局部 useCurrentFrame 播放，在前约 1.8 秒完成，然后停留，不随整片时长拉慢。多个组件都需要自己的 Sequence；不要把整段视频总时长传为该组件时长。

## 回退

保留输入视频；重做时创建新输出目录。撤回某个组件只需修改计划并重新渲染，不覆盖源媒体或全局技能目录。命令失败时保留错误与现有产物，修正实际原因，不重复无依据的渲染或上传。
