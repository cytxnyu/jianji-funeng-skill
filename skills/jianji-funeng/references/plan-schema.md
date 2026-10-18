# edit-plan.json

UTF-8 JSON；秒基于原视频起点，不是截取片段的相对时间。工具会按 `fps` 四舍五入到帧，随后所有环节复用这些帧边界。

```json
{
  "schemaVersion": 1,
  "purpose": "edit",
  "fps": 30,
  "source": {"file": "input.mp4", "width": 1920, "height": 1080, "duration": 12},
  "segments": [
    {
      "id": "chapter-01", "type": "chapter", "start": 0, "end": 2,
      "reason": "从介绍进入整理素材的操作阶段",
      "evidence": [{"start": 0, "end": 2, "quote": "第一步，整理素材。"}],
      "props": {"titleLines": ["整理素材"], "chapter": "01", "subtitle": "", "signature": "cyt"}
    },
    {
      "id": "prompt-01", "type": "prompt", "start": 4, "end": 10,
      "reason": "口播给出可复制的指令，高亮输出格式",
      "evidence": [{"start": 4, "end": 10, "quote": "请按主题归类，输出三列清单。"}],
      "props": {"label": "提示词", "lines": ["请按主题归类", "输出三列清单"], "highlightLine": 1, "caption": "输入这段提示词"}
    }
  ]
}
```

- `purpose: edit`：正式剪辑，必须有真实定时证据，检查阅读时间。`preview`：仅外观样片，可用 2 秒；这个模式不能合成进源视频。
- `source.file` 是可选的媒体位置记录。只有字幕时省略此字段，不伪造媒体文件路径；合成时以明确传入的 `--video` 为准，并重新核对参数。
- `source` 参数来自 ffprobe；只有字幕时用已知画幅、帧率和字幕终点暂作组件导出的范围，收到视频后重新验证。无时间轴文稿不要写正式 edit 计划。
- `segments` 按开始时间排序，允许空数组；id 唯一且只用英文、数字、下划线、连字符。
- `type` 为 `chapter` 或 `prompt`。一段最短 2 秒；章节最多 10 秒，提示词最多 60 秒。
- `evidence` 的 quote 为原文；改写后的内容放在 props，改写理由放在 reason。用 `--cues` 核对引文确实出现在指定时间内。屏幕 OCR 或人工定位没有 SRT 时保留来源说明，另行看画面核对。
- `chapter` props：titleLines（1–3 行）、chapter、signature、subtitle；可选 accentColor、signatureColor。
- `prompt` props：lines（1–5 行）、highlightLine（从 0 开始，且必须指向存在的行）、label、caption；可选 accentColor、highlightColor。
- 所有颜色均为 `#RRGGBB`。默认配色和署名可被明确的用户要求覆盖。
- 不在 props 中写 durationSeconds：它由 start/end 帧差计算，避免两套时间不一致。
- 合成方式固定为原时间轴上的全屏画面替换，保留原声。它不是插入额外秒数，不是透明素材，不自动切掉原片。
