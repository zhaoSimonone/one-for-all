# 视频圣光遮挡 · video-holy-light-censor

## 资产用途

将 palmier-pro 项目中使用的 video-holy-light-censor 技能沉淀为可跨项目复用的提示词与源码快照。用于对视频中由用户指定的胸部、大腿、胯部等区域做跟踪柔边遮挡。

技能来源：`/Users/simon/Desktop/dev/code/palmier-pro/.agents/skills/video-holy-light-censor`。
归档日期：2026-11-01。下方包含完整技能文件，其他项目可按相对路径还原，不依赖原项目代码。

## 常用提示词

> 用 video-holy-light-censor 遮挡这个视频截图红框圈出的胸部。

执行这条提示词时应同时提供原视频和红框定位截图；仅有效果图不能确定源视频、时间段或源像素坐标。

## 可直接交给 Codex 的完整提示词

```text
请使用 video-holy-light-censor 处理原视频：<原视频绝对路径>。
定位参考：<带红框的截图路径>，红框圈出需要遮挡的胸部区域。
效果参考：<遮挡效果图路径>。
处理时间：<开始秒数> 至 <结束秒数>；若未指定，请先检查整段视频并确定实际需要处理的片段。

先读取技能说明，使用 ffprobe 检查源视频参数。将截图中的框映射到原视频像素，确定对应参考帧，再跟踪目标区域；不要直接套用截图坐标，也不要把效果图当作目标定位框。

效果要求：柔和、浅色、磨砂状的圣光遮挡，中心细节被充分模糊，边缘平滑过渡；随人物运动稳定跟踪，尽量不波及头发、服装和背景。优先采用柔边高斯模糊，避免硬边矩形、大块纯白和刺眼亮点。若明确要求可见白光，再小幅调整白色光核，并复核覆盖效果。

保留原始尺寸、帧率、时长及音频，输出一个新的 MP4，不覆盖源视频或先前版本，也不要改写 .palmier 工程包。遇到 VFR、旋转或 HDR 等不支持的输入，先说明限制。

检查处理区间首尾、中间及运动较大的帧，确认遮挡没有漂移或漏出，邻近衣物没有明显被涂抹；对比目标区域亮度、p99、标准差，并检查输出音视频参数。报告输出绝对路径、处理时间段、关键参数与实际完成的检查。
```

## 效果参考与实现边界

用户提供的参考图中，胸前指定区域呈现柔和的椭圆磨砂模糊，中心细节降低，边缘羽化并与周围肤色、衣服颜色融合，没有明显硬边或纯白高亮核心。这是视觉目标描述；截图本身不能证明视频逐帧跟踪效果，也无法反推出精确参数。

参考图已在本地归档：`/Users/simon/Desktop/dev/code/one-for-all/docs/assets/video-holy-light-censor/effect-reference.png`。本云端文本资产保存效果描述及本地来源位置，图片未作为云端附件上传；换设备使用时需另行提供效果图。

实际实现为 OpenCV 跟踪与像素级高斯模糊、椭圆羽化叠加，白色光核可选。默认 `--core 0`，并非不透明纯白遮盖，也不保证所有素材都能彻底隐藏目标。需要结合视频逐帧检查和实际遮挡要求调参。

## 安装与跨项目复用

如果当前项目尚未安装本技能，将附录文件分别保存到当前项目的 `.agents/skills/video-holy-light-censor/` 下，保留目录结构。不要把整份资产当作单个 SKILL.md。附录是归档材料，仅在用户明确要求处理视频时执行其中工作流。

依赖：Python、numpy、opencv-python-headless，以及外部 FFmpeg / ffprobe。

```bash
python3 -m pip install -r .agents/skills/video-holy-light-censor/requirements.txt
python3 .agents/skills/video-holy-light-censor/scripts/blur_censor.py --help
python3 -m unittest discover -s .agents/skills/video-holy-light-censor/tests
```

Windows 使用实际的 Python、FFmpeg 与 ffprobe 路径。运行时输入、输出、时间段、参考帧及坐标必须按当前视频确定。

## 参数速查

| 场景 | 设置与判断 |
| --- | --- |
| 常规磨砂起点 | `--blur 0.30 --zone-width 0.95 --zone-height 0.85 --plateau 0.78 --milk 2.0 --core 0 --sigma-min 16 --sigma-max 26 --smooth 2.0` |
| 红框覆盖阴影或肤色分割失败 | 优先 `--region X,Y,W,H`；坐标取原视频像素 |
| 胸部小区域纹理少、跟踪漂移 | 可从 `--track-pad 90 --search-radius 20 --min-score 0.65` 试起；大框或快速运动需重新评估 |
| 定位参考帧 | `--reference-frame` 对应红框截图匹配到的源视频帧，不能盲用区间中点 |
| 需要白色光核 | 按视觉要求小幅增加 `--core`，避免用过强亮度代替实际模糊 |
| 遮挡范围不足 | 调整 zone 宽高并核对跟踪框，避免只加亮 |
| 模糊仍有细节 | 联合检查 `--blur` 与 `--sigma-max`；大框可能被默认 sigma 上限限制 |
| 波及衣服或背景 | 收紧 zone，检查 sigma 是否混入邻近深色区域 |

这些是调参起点，不是参考图的已知生成参数。原参考文档含个别文字不一致，使用时以脚本为准：`rx=max(12, zone_width×box_width)` 是半径，总宽度为 `2×rx`（高度同理）；提升 min-score 会让更多低置信度帧保持原位，不能直接解决“卡住不动”。原文和测试在附录完整保留，便于溯源。

## 验收与归档范围

- 复核跟踪、覆盖范围、羽化边缘、相邻衣物与背景；单帧效果不能替代运动检查。
- 比较输出尺寸、帧率、时长及音频，处理区间外画面会重新编码，不应宣称逐字节无损。
- 当前技能仅验证 CFR、无旋转的 SDR 输入；长片段会生成逐帧 PNG，需要足够临时磁盘空间。
- 本次为资产整理归档，未运行视频渲染或技能测试，未生成新视频。
- 以下 SHA-256 对应归档时的原始文件，保留源码与文档原文。附录中的示例数值和命令是参考材料，不是本次执行记录。

## 完整技能快照

### 文件：SKILL.md

SHA-256：`0bb05100577c9d49fa02192047fb586e091ef197ff4f0a0633b2b720b8ee623f`

``````markdown
---
name: video-holy-light-censor
description: Obscure a sensitive body region in a video with a tracked, feathered, pixel-level Gaussian blur, optionally adding a small white core. Use this skill when the user asks to 遮挡 / 打码 / 模糊 / 圣光遮挡 a body area such as 大腿, 胯部, 胸部, 臀部, or 露出部位, or asks to apply a "圣光" censoring effect to a video. Do not use it for GIF/PNG sticker overlays (use video-overlay-censor), fixed rectangular sticker or watermark covers (use video-exact-sticker-cover), or makeup and beauty overlays (use video-face-makeup).
---

# Video Holy-Light Censor

Blur a moving body region out of a video by tracking the region frame by frame and compositing a feathered Gaussian blur over it. The result reads as a soft frosted patch, not a sticker, so it survives camera motion without looking pasted on.

This skill owns the *decisions*: which interval needs work, where the region is, how strong the blur should be, and whether the output is acceptable. The script owns the *mechanics*: segmentation, tracking, compositing, and encoding.

## Inputs to collect

- The source video path. If the user sent a screenshot with a red box instead of a video, ask for the video.
- Which region to obscure, in the user's words (大腿 / 胯部 / 胸部 / 臀部 / 露出部位). Map it to one or two seed points in source pixels.
- The time range that needs covering. Inspect the whole clip first: a costume change or a cut usually means only part of the video needs the effect.
- Whether the user wants pure blur or blur plus a visible white glow. Default to pure blur.

If the user supplied a red-box screenshot, treat it as guidance, not as coordinates: map it to source pixels before use. Screenshots carry player chrome, padding, and scaling, so their pixel coordinates are not source-video coordinates.

## Procedure

1. Inspect the source with `ffprobe` before touching anything. Record width, height, frame rate, duration, frame count, and whether an audio stream exists. Do not assume 30 fps, 1080p, or a fixed duration.
   Reason: every downstream number (frame indices, zone radius, blur sigma) is derived from these, and a wrong frame rate silently desynchronises the effect from the motion.

2. Locate the region of interest. Extract candidate frames as PNG and view them; then pick seed points inside the target area in **source-video pixels**. Use skin segmentation in HSV to find the region, then track it — see [references/region-detection.md](references/region-detection.md) for thresholds, seed placement, and how to cut a region free from a neighbouring body part.
   Reason: the target moves. A static rectangle drifts off the subject within a second or two of camera motion.

3. Choose the interval that actually needs the effect. Find the costume change or cut by sampling frames across the clip, and set `--start` / `--end` to the affected range only.
   Reason: blurring the whole clip wastes time and risks degrading parts the user never complained about. It also burns encode quality on frames that never change.

4. Run the script:

   ```bash
   python3 /path/to/skills/video-holy-light-censor/scripts/blur_censor.py \
     --input /path/to/input.mp4 \
     --output /path/to/output.mp4 \
     --start 8.333333 --end 12.166667 \
     --seed 420,1570 --seed 770,1560 \
     --band 500,700 \
     --ffmpeg /opt/homebrew/bin/ffmpeg \
     --ffprobe /opt/homebrew/bin/ffprobe
   ```

   The seeds and the band in this example come from one specific clip; recompute all three for the video in front of you. `--seed X,Y` is a point inside the region to obscure; repeat it for a second region. `--region X,Y,W,H` tracks a fixed-size rectangle instead, for targets that are not skin or that sit in shadow. `--band X1,X2` drops a column range from the skin mask entirely, which both separates two nearby regions that would otherwise merge into one blob and removes a hand that is resting on the target. Without it, a thigh and the torso or a hand are detected as a single component and the blur lands in the wrong place.

   When the region is smooth skin or a shadow, template matching has no texture to latch onto. Give it context with `--track-pad N` (matching only — the blur still covers the region alone), keep the per-frame jump bounded with `--search-radius R`, and reject implausible matches with `--min-score S`.

   The output must be a new `.mp4`; the script refuses to overwrite an existing path and refuses any output whose extension is not `.mp4`.

5. Verify before showing the result. Do not trust a zero exit code.

   - Re-probe the output: same dimensions, same frame rate, same duration, audio still present.
   - Extract frames from the middle and both ends of the covered range and look at them.
   - Measure the covered region numerically: within the target ROI, compare the source and output for mean brightness, `p99`, and standard deviation. The blur must reduce local contrast (std drops) without creating a bright spot (`p99` should fall, not rise).
   - Confirm the shape is gone, not just flattened. Look at the target: the leg or body outline must no longer be readable. A translucent veil that lifts the blacks can drop the std while leaving the silhouette perfectly legible, and that is not a successful censor.
   - Confirm no spill: the neighbouring garment or background must stay clean. A zone that is too wide leaves a grey smear across whatever is next to the target.

   Reason: a blur that is too weak leaves the detail legible; a white core that is too strong leaves a conspicuous hotspot that defeats the purpose of the effect; a veil that flattens the contrast without destroying the shape looks like a filter rather than a cover.

6. Iterate on the knobs rather than rewriting the pipeline. The defaults (`--blur 0.30 --zone-width 0.95 --zone-height 0.85 --plateau 0.78 --milk 2.0 --core 0.0 --sigma-max 26`) are the values that satisfied a real request; they are a starting point, not a law. The full knob ladder, the zone-size arithmetic, and the user-feedback-to-knob mapping are in [references/tuning.md](references/tuning.md).

   Sigma scales with the zone radius, which scales with the tracked box. A box much larger than the ~90 px the defaults were tuned on needs a larger `--sigma-max` to destroy the detail inside it, and a slightly tighter zone to stop the neighbours bleeding into the blur. Measure the ROI before and after instead of assuming the defaults transfer.

7. Deliver the output as a new file with an absolute path, and state which interval was covered and which parameters were used. Keep every earlier version; do not overwrite a previous delivery.

## Output contract

- A new `.mp4` file with the original dimensions, frame rate, and duration, with the source audio preserved (`--audio copy` by default; use `--audio aac` when the source audio cannot be stream-copied).
- Frames outside the processed interval are re-encoded from the original and are visually unchanged.
- The script prints a JSON summary with the interval, frame range, reference frame, region count, tracking mode, and blur fraction. Report the relevant fields when handing the result over.

## Failure handling

- **No skin region found at the seed.** The seed is off the target or the HSV thresholds do not match this footage. Re-extract the frame, view it, and pick the seed again. Adjust `--hue/--sat/--val` only after confirming the seed lands inside the target.
- **The blur lands on the wrong body part.** Two regions merged into one component. Add `--band` to cut them apart, or use `--region` to track a rectangle directly.
- **The mask jitters or slides.** Raise `--smooth` to smooth the track over time, or move `--reference-frame` to a frame where the target is clearly visible.
- **The tracked box drifts off the target (`--region` mode).** The template had no texture to match on and the search window let it wander. Add `--track-pad 60–100` to give the match surrounding context, tighten `--search-radius` to 15–25, and set `--min-score` around 0.6 so an implausible frame holds position instead of jumping.
- **The tracked box lags behind the target.** `--search-radius` is smaller than the real per-frame displacement. Raise it.
- **The box is correct at the start but wrong later.** `--reference-frame` points at a frame the target had already moved away from. Set it to the frame the user's box was drawn on — see the screenshot-mapping procedure in [references/region-detection.md](references/region-detection.md).
- **The output looks like a white glow instead of a blur.** `--core` is non-zero or `--milk` is too high. Set `--core 0` and lower `--milk`.
- **The detail is still legible.** Raise `--blur` (stronger sigma) and/or `--zone-width` / `--zone-height` (larger footprint). Raising `--blur` too far dissolves the body shape; the region stops reading as a leg.
- **The script exits non-zero.** Read stderr. A `CalledProcessError` carries the FFmpeg message. The temporary work directory is created next to the output and is removed on exit, including on failure.
- **Encoding fails on the final mux.** Check disk space for the PNG frame cache; rendering holds full-canvas frames on the output volume.

## Boundaries

- This is pixel-level blur compositing over a tracked region, not semantic detection and not an opaque cover. A strong blur reduces legibility; it is not a guarantee of concealment, and it does not survive a re-encode that sharpens the image.
- Do not use it to cover a watermark, logo, or fixed sticker — those have stable bounds and belong to `video-exact-sticker-cover`. Do not use it to paste a GIF or PNG over the subject — that is `video-overlay-censor`.
- Never crop, retarget, resize, replace, or overwrite the user's source media, and never write into a live `.palmier` package.
- Only CFR, unrotated SDR video is validated here. VFR timing, rotation, HDR metadata, and subtitle or data tracks are not preserved by design; inspect these before use and report unsupported inputs rather than promising lossless preservation.
- Rendering is not a streaming renderer. It materialises one PNG per frame for the covered interval; check disk capacity on long clips.

## Examples

Input: `用 video-holy-light-censor 把这个视频大腿露出来的部分挡一下：/path/to/source.mp4`

Output: a new `source_圣光遮挡.mp4` where the exposed thigh region in the affected interval is covered by a soft feathered blur, with the rest of the clip and the audio untouched.

## Windows (win32) platform notes

The script is cross-platform Python, but FFmpeg and ffprobe are external executables. On Windows, install them and pass the real paths instead of the Homebrew ones, for example `--ffmpeg "C:/ffmpeg/bin/ffmpeg.exe" --ffprobe "C:/ffmpeg/bin/ffprobe.exe"`. Run it as `python scripts/blur_censor.py ...` — the Windows launcher is usually `python`, not `python3`. There are no bash-only constructs inside the script itself.
``````

### 文件：requirements.txt

SHA-256：`fdde51696d8ef04cd42aa6a7f0dfbc63418e092c365254e86e982014298e9ee3`

``````text
numpy
opencv-python-headless
``````

### 文件：agents/openai.yaml

SHA-256：`4f381cd7d1d47d70a017ea511ea30f8ce0bbbc89126bce0250dad1d72dd92ca1`

``````yaml
interface:
  display_name: "视频圣光遮挡"
  short_description: "用跟踪羽化模糊遮挡视频中的敏感区域"
``````

### 文件：references/region-detection.md

SHA-256：`7245193e0563b05f5538b5ce28f6d49115e7a2c76a680ca610471465d79b0fac`

``````markdown
# Region detection and tracking

How the script finds the target, follows it, and keeps the blur on the right body part.

## Coordinate convention

All coordinates are source-video pixels with the origin at the top-left. `x` grows right, `y` grows down. The script works on decoded frames at the video's native resolution, so a coordinate taken from a scaled screenshot must be rescaled first.

## Skin segmentation

The default HSV window isolates bare skin while rejecting the garments that usually surround it:

| Channel | Range | Why |
| --- | --- | --- |
| H | 5 – 34 | skin tones; rejects red cloth (H ≈ 1) and gold armour (H ≈ 15 but low S) |
| S | 85 – 180 | skin sits around S ≈ 92–105; white satin is S ≈ 4–10, gold armour S ≈ 50 |
| V | 120 – 250 | keeps the shadowed edge of a limb from becoming a separate component |

The mask is then cleaned with a 7×7 morphological open and a 15×15 close, which removes speckle and closes the small holes left by fabric edges.

Override the window with `--hue`, `--sat`, `--val` when the footage has a colour cast that pushes skin outside the default range. Use `--hue 0,40` to widen the hue span for very warm or very cool lighting, and raise `--sat` only if the skin is genuinely desaturated.

## Picking a seed point

The seed is a single point that must land **inside** the target, not on its edge and not on a neighbouring part. The script grows the seed into the connected component that contains it, so a seed on a boundary can latch onto the wrong blob.

1. Extract one frame from the middle of the interval you plan to cover.
2. View it and pick a point in the middle of the exposed area.
3. Pass it as `--seed X,Y`.

For a thigh that is a triangle, pick a point in the wide lower part, not the apex: a narrow apex produces a small component that the tracker loses as soon as the limb rotates.

## Turning a red box on a screenshot into source pixels

A screenshot is not the video. It carries player chrome, surrounding desktop, and its own scale, so its pixel coordinates are meaningless in the source frame. Map them through a homography:

1. Crop the screenshot down to the video picture only — drop the control bar and everything outside the player's viewport.
2. Match the cropped screenshot against the decoded frames with SIFT and RANSAC, then map the red box's four corners through `H`. The result is a source-pixel rectangle.

**Match against every frame, not just the first one.** A screenshot is one instant of a moving subject, so the homography that fits it changes with the pose. Compute it for a sample of frames across the clip and pick the frame with the most inliers; neighbouring frames with a similar inlier count confirm the answer. On one real clip the screenshot matched frame 34 with 369 inliers while frame 0 gave only 78 — and the two disagreed by 45 px on the target box. Low inlier counts and boxes that jump around between candidate frames are the signature of a non-rigid mismatch, not of a bad crop.

**Then set `--reference-frame` to that frame.** The tracker pins the box at the reference frame and expands from there in both directions, so the reference frame is where the box is *known* to be correct. Leaving it at the interval midpoint places the box on the target at a moment when the subject may have moved somewhere else entirely. Measured on the clip above, using the correct frame instead of the midpoint moved the tracked box off the chest in the middle of the interval and cut the ROI standard-deviation drop from 57% to 49%.

## Keeping regions apart

A thigh, a hand resting on the hip, and the bare midriff are frequently one connected skin region in the mask. The tracker then measures the whole blob and centres the blur between the legs, leaving the actual target exposed.

The script separates them with a **band**: a column range that is zeroed out of the mask before the connected-component analysis, so the parts on either side of it become different components.

Note what "band" actually does: it **removes every pixel in that column range from the mask**, not just a dividing line. A body part that lies entirely inside the band disappears from the mask and stops dragging the component's bounding box. That is often exactly what you want — putting the band over a hand that is touching the thigh removes the hand and leaves a clean thigh component. It also means a band that is too wide will clip the target itself: any part of the thigh that reaches past the band's edge gets its columns cut off, so the tracked bounding box shrinks and the blur zone follows the clipped shape.

- Give `--band X1,X2` explicitly when you know where the gap between the two regions is. In the reference clip the gap sits at columns 495–705, which also covers the hand resting on the hip.
- Without `--band`, the script uses the middle half of the gap between the two seeds, which is a reasonable default when the two targets are symmetric and separated.

If the two regions touch or overlap in the frame, `--band` cannot separate them without clipping one of them. Track one of them with `--region X,Y,W,H` instead, which uses template matching and ignores the skin segmentation entirely.

## Tracking

`--seed` mode runs a windowed connected-component search:

- The component containing the seed is located in the **reference frame**, which is the middle frame of the interval unless `--reference-frame` says otherwise.
- Tracking then runs **forwards and backwards** from that reference frame. Seeding from the first frame and only tracking forwards fails whenever the target is briefly occluded or poorly segmented at the start.
- Each step searches for the component nearest the previous frame's centre, inside a window that is the previous bounding box grown by a margin. A small search radius keeps the tracker on the same body part even when a larger one would jump across the body.
- When no component is found, the previous box is carried forward, so the track never has holes.

`--region` mode instead matches a fixed-size patch of the reference frame with normalised cross-correlation, which follows a target that is not skin — a hand, a garment edge, an object, a shadowed cleavage.

Three knobs keep that match honest:

- `--track-pad N` adds N pixels of context around the region **for matching only**; the reported box keeps the requested size, so the blur footprint stays exactly where the user pointed. Use it whenever the target is smooth skin or a shadow with no texture of its own — normalised correlation needs *some* structure to anchor on, and bare skin has almost none.
- `--search-radius R` caps the per-frame displacement of the tracked centre. The search window is `centre ± (template_half + R)`. Keep it tight: a loose window lets the template jump onto a similar-looking patch elsewhere on the body.
- `--min-score S` holds the previous position when the best match scores below S, so an implausible frame produces a still box rather than a wild jump.

A `--region` box is a rectangle in source pixels: `X,Y,W,H`, with `X,Y` at the top-left. To convert a red box drawn on a screenshot, first remove the player chrome and the surrounding desktop, then map the four corners through the homography between the screenshot and a decoded frame — see the pitfalls in [tuning.md](tuning.md).

### When the region is a shadow rather than skin

Skin segmentation classifies a shaded cleavage, the underside of a breast, or a shadow under an arm as **background**, so `--seed` mode will not find it no matter how the thresholds are tuned. When the user's red box sits on a shadow, go straight to `--region`: a rectangle the user drew is a better description of the target than any colour rule.

## Temporal smoothing

The tracked centre is smoothed along the time axis with a Gaussian of `--smooth` (default 2.0). Segmentation jitter of a few pixels per frame is normal and is very visible as a wobbling blur edge; smoothing removes it without visibly lagging behind real motion. Raise it for fast camera moves, lower it if the blur visibly trails a sudden movement.

## What the blur geometry means

The tracked bounding box is turned into a feathered ellipse:

- `rx = --zone-width × box_width`, `ry = --zone-height × box_height`. Because the ellipse is centred on the box centre, it spans `zone-width × box_width` in total — so a multiplier of 0.95 gives an ellipse just under twice the width of the skin region, and a multiplier of 1.5 gives one three times as wide. The default 0.95 / 0.85 keeps the feathered rim just outside the target instead of out on the neighbouring garment.
- The mask is 1.0 inside `plateau × r` and falls to 0 at `r`, using a smoothstep so there is no visible boundary. A high plateau (the default 0.78) makes the fully blurred core large relative to the feathered rim, which reads as an overall softening rather than a pasted patch.
- `sigma = --blur × rx`, clamped to `[--sigma-min, --sigma-max]`. Expressing sigma as a fraction of the zone radius keeps the blur proportional when the subject moves closer to the camera. The clamp matters as much as the ratio: the kernel spreads about `3 × sigma`, so a large sigma reaches outside the zone and drags dark neighbours into the blur.
- `--milk` adds a small brightness lift inside the blur, which reads as frosted glass. Keep it small; a large lift creates the bright hotspot that users reject.
``````

### 文件：references/tuning.md

SHA-256：`d08ab77ca6da727651205c1c405286470ccf23a47c8c751ad3e4bd9e1ce2e24f`

``````markdown
# Tuning and verification

The knob ladder, the feedback-to-knob mapping, and the numeric checks that decide whether an iteration is an improvement.

## The knobs

| Flag | Default | What it controls |
| --- | --- | --- |
| `--blur` | 0.30 | blur sigma as a fraction of the zone half-width. Higher = more detail destroyed. |
| `--sigma-min` / `--sigma-max` | 16 / 26 | clamps on the computed sigma in pixels. |
| `--zone-width` | 0.95 | zone radius as a multiple of the tracked box width. |
| `--zone-height` | 0.85 | zone radius as a multiple of the tracked box height. |
| `--plateau` | 0.78 | inner fraction of the zone that gets the full blur; the rest feathers out. |
| `--milk` | 2.0 | brightness lift inside the blur (frosted look). |
| `--core` | 0.0 | white core opacity at the centre. 0 disables it. |
| `--smooth` | 2.0 | temporal smoothing of the tracked centre, in frames. |
| `--reference-frame` | middle | frame used to seed the tracking. Set it to the frame the user's box was drawn on, not the interval midpoint — the tracker pins the box there. |
| `--min-area` | auto | smallest skin blob in pixels that may be tracked. Auto derives it from the frame size (about 0.06% of the frame area, floored at 400 px). Raise it when a small skin-coloured accessory is being picked up as the target. |
| `--hue` / `--sat` / `--val` | `5,34` / `85,180` / `120,250` | the HSV window used for skin detection. |
| `--track-pad` | 0 | extra pixels of context added around a `--region` box **for matching only**. The blur still covers the region alone. Raise it when the target is smooth skin or shadow with no texture of its own. |
| `--search-radius` | 60 | how far a `--region` template's centre may move per frame, in pixels. |
| `--min-score` | 0.0 | hold the previous position when the best template match scores below this (0–1). 0 accepts every match. |

## Zone size arithmetic — get this right first

The zone radius is `rx = --zone-width × (tracked box width)`, and the ellipse is centred on the box centre. So the ellipse spans `zone-width × box_width` in total. A multiplier of 1.5 therefore produces an ellipse **three times** the width of the skin region, and a multiplier of 0.95 produces one that is just under twice as wide.

The feathered rim lands at the ellipse boundary, so a multiplier that is too high pushes the rim onto the neighbouring garment and leaves a wide grey smear across it. Too low and the corners of a triangular limb fall outside the fully blurred core, leaving the tips exposed.

Start at the default 0.95 / 0.85 and move in one direction at a time. Raise it if the corners of the limb are still readable; lower it if the neighbouring garment is smudged.

## Template tracking (`--region`) — the three knobs that decide whether it holds

`--region` mode matches a patch of the reference frame with normalised cross-correlation. Three knobs control how well it stays locked, and they only apply to `--region`, not to `--seed`:

- `--track-pad N` grows the **matched** template by N pixels of context on every side while the **reported** box stays the size you asked for. This is the fix for a target with no texture of its own — bare skin, a shadowed cleavage, a smooth gradient. Without context, the normalised correlation has nothing to anchor on and drifts. The blur footprint is unaffected: the zone is still computed from the region box.
- `--search-radius R` bounds how far the centre may move per frame. The search window is `centre ± (template_half + R)`, so R is literally the per-frame displacement limit. A large radius lets the tracker jump across the body onto a similar-looking patch.
- `--min-score S` holds the previous position when the best match scores below S. A low score means the match is not trustworthy, and following it is worse than standing still.

Measured on a real clip where the target was a 91×90 region over a moving chest: with `pad=0` the track covered the region on average 85% of the frames and failed outright on 10 of 120 frames, with single-frame jumps of 80–102 px. With `pad=90`, `search-radius=20`, `min-score=0.65` the coverage rose to 95% with **zero** failed frames.

Watch out for the trap in the middle: if `--search-radius` is smaller than the target's real per-frame displacement, the tracker lags behind the subject — it stays locked on the *pattern* it was matching, which is correct behaviour, not a bug. Raise the radius rather than blaming the matcher.

**Padding is not always the answer.** It helps a small, textureless target. It hurts a large one: on a 217×184 region the template already carries plenty of structure, so `pad=0` scored best (91% mean coverage, 0 failed frames) while `pad=120` dropped to 86%. Extra padding on a big box pulls moving hands and swinging hair into the template, and those are exactly the parts that change. Measure coverage before reaching for `--track-pad`.

## Sigma reaches beyond the zone

Sigma is the standard deviation of the Gaussian, so the blur kernel spreads roughly `3 × sigma` in each direction. A sigma of 48 reaches about 144 px — far enough to pull the black thigh-high band and the dark background into the thigh's blur and turn it into a dark smear. `--sigma-max 26` keeps the kernel inside the zone.

When the covered region comes out **darker** than the source, that is the signature of sigma reaching into a dark neighbour. Lower `--sigma-max` before touching anything else.

## A big box needs a bigger sigma

`sigma = --blur × rx`, and `rx` scales with the tracked box. A 91×90 box gives `rx ≈ 86` and a sigma of 26; a 217×184 box gives `rx ≈ 191`, where the same `--blur 0.30` asks for a sigma of 57. The default `--sigma-max 26` clamps that hard, and the result is a 217 px patch with a 26 px blur — the detail inside is only lightly softened and stays readable.

So the clamp has to move with the target: for a 217×184 region, `--sigma-max 52–60` restores the intended detail destruction. The cost is real — a large sigma drags the neighbouring colours into the blur, so the ROI mean drops further and the patch picks up their tint. Counter it by shrinking the zone rather than by weakening the blur:

| Box | Zone | Sigma max | Measured spatial high-frequency | ROI mean |
| --- | --- | --- | --- | --- |
| 217×184 | 0.95 / 0.85 | 60 | −75.6% | −6.1% |
| 217×184 | 0.88 / 0.78 | 52 | −68.7% | −5.2% |

Both hide the target completely. The tighter zone keeps the garment's edge clean and the tint bleed smaller, at the cost of a slightly softer blur. When the covered region is large, start tighter than the default.

## Mapping user feedback to a change

This ladder came out of a real six-round iteration. Read the complaint, change one knob, re-render, re-measure.

| The user says | Change | Why |
| --- | --- | --- |
| "太亮了" / "有个亮点" | `--core 0` | The white core is a separate feature from the blur. Turning it off is the fix; raising `--milk` makes it worse. |
| "还是太亮，像蒙了一层白" | `--milk` down to 1–2 | A large lift turns the blur into a bright veil. |
| "范围不够大" / "没挡住" | `--zone-width` / `--zone-height` up | The footprint grows. The blur radius (`--blur`) does not change, so the texture inside stays equally destroyed. |
| "看不清了" / "还是能看出来" | `--blur` up | More sigma = less detail. Watch for the leg losing its shape. |
| "看起来像贴上去的" | `--plateau` up | A larger plateau makes the fully-blurred core bigger relative to the feathered rim. |
| "边在抖" / "糊块在飘" | `--smooth` up | Temporal jitter in the tracked centre. |
| "旁边白衣服脏了" / "糊到裙子上" | `--zone-width` / `--zone-height` down | The rim has spilled onto the neighbouring garment. |
| "腿变黑了" | `--sigma-max` down | The blur is reaching into a dark neighbour. |
| "糊块飘了 / 跟不上" (region mode) | `--track-pad` up, `--search-radius` up | The template had no context to match on and the window was too tight to follow the motion. |
| "糊块卡住不动" (region mode) | `--min-score` up | The match was below the confidence floor and the position was being held. |

Push in this order: disable the core, enlarge the zone, then deepen the blur. Deepening the blur first dissolves the body shape and is hard to undo.

## Default recipe that worked

```
--blur 0.30 --zone-width 0.95 --zone-height 0.85 --plateau 0.78 --milk 2.0 --core 0.0
--sigma-min 16 --sigma-max 26 --smooth 2.0
```

With seeds and a band chosen for the clip, this produced a soft, evenly feathered patch with no hotspot, no legible detail, and no smear on the neighbouring garment. An earlier, wider recipe (`--zone-width 1.50 --zone-height 1.08 --blur 0.20 --sigma-max 48`) hid the target too, but left a broad grey veil across the white costume and pulled the dark background into the blur; the tighter recipe above is the better starting point.

## Numeric verification

Do not verify by eyeballing only. Pick a frame in the middle of the covered range, define the target ROI in source pixels, and measure:

```python
import cv2, numpy as np
box = (323, 1436, 516, 1673)          # x0, y0, x1, y1 in source pixels
for tag, path in (("source", "src.png"), ("output", "out.png")):
    roi = cv2.imread(path)[box[1]:box[3], box[0]:box[2]].max(axis=2)
    print(f"{tag:7s} mean={roi.mean():6.1f} max={roi.max():3d} "
          f"p99={np.percentile(roi, 99):.0f} std={roi.std():5.1f}")
```

How to read it:

- **std** is the local-contrast measure. A working blur drops it substantially — in the reference run, from 88.7 to about 55. If std barely moved, the blur is too weak or the ROI is off the target.
- **p99** guards against a hotspot. A bright core or an excessive `--milk` lifts p99 and max. In the reference run p99 fell from 252 to about 235 and max fell from 255 to about 240, which is what a non-hotspot blur looks like.
- **mean** should stay close to the source mean. A large drop means the region has turned into a dark smear; a large rise means it has turned into a white veil.

Use `max` over channels rather than a single channel: it is the strictest measure of "is anything still legible here".

## A veil is not a blur

A flat, semi-transparent overlay that lifts the blacks can drop the ROI standard deviation while leaving the target completely readable. The number looks good, the picture does not. This is the single most common way a censor fails while still passing a naive contrast check.

Two checks distinguish them:

1. **Look at the target.** The body outline must no longer be readable as a body part. If you can still tell it is a leg, the effect is a veil.
2. **Check the mean.** A veil that lifts the blacks raises the mean and flattens it. A real blur pulls surrounding pixels into the target and keeps the mean near the source value. A covered region whose mean has dropped by more than a few percent is absorbing dark surroundings — lower `--sigma-max` and shrink the zone.

## Checks beyond the ROI

- Compare the full frames of source and output side by side, not just the crop. A zone that is too large leaves a visible smudge on the neighbouring garment.
- Look at the first and last frames of the covered interval. An effect that starts or ends abruptly reads as an edit.
- Look at a frame just outside the interval to confirm the transition is clean.
- Confirm the frames before the interval are visually identical to the source; the re-encode must not shift them.

## Pitfalls recorded from earlier rounds

- A white core produces a bright rectangle edge when its row/column order is transposed. Keep the core array's rows and columns matching the image's rows and columns.
- `cv2.imwrite` expects BGR. Feeding it RGB data shifts the whole frame blue.
- `cv2.connectedComponentsWithStats` returns stats as `[x, y, w, h, area]`. Unpacking them in any other order silently drops every component once an area filter is applied.
- ORB homographies map source→target. To translate a coordinate from a screenshot back into the video frame, invert the matrix.
- Tracking forward from the first frame drifts or dies when the target is briefly occluded. Seed from a reference frame and track in both directions.
``````

### 文件：scripts/blur_censor.py

SHA-256：`b1e5c088b678a0cb22626c8930456052b27ee21d43d08a6f2d786b884028cfc3`

``````python
#!/usr/bin/env python3
"""Blur a tracked region of a video with a soft feathered mask, preserving audio."""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np

HUE_LO, HUE_HI = 5, 34
SAT_LO, SAT_HI = 85, 180
VAL_LO, VAL_HI = 120, 250


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def probe(ffprobe: str, path: Path) -> dict:
    result = run([
        ffprobe, "-v", "error", "-show_entries",
        "format=duration:stream=index,codec_type,codec_name,duration,width,height,r_frame_rate,avg_frame_rate,"
        "nb_frames,sample_rate,channels",
        "-of", "json", str(path),
    ])
    return json.loads(result.stdout)


def finite(value: object, label: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a finite number") from exc
    if not math.isfinite(number):
        raise ValueError(f"{label} must be finite")
    return number


def parse_pair(text: str, label: str) -> tuple[float, float]:
    parts = text.split(",")
    if len(parts) != 2:
        raise ValueError(f"{label} must be X,Y")
    return finite(parts[0], f"{label}.x"), finite(parts[1], f"{label}.y")


def parse_rect(text: str, label: str) -> tuple[float, float, float, float]:
    parts = text.split(",")
    if len(parts) != 4:
        raise ValueError(f"{label} must be X,Y,W,H")
    x, y, w, h = (finite(p, f"{label}[{i}]") for i, p in enumerate(parts))
    if w <= 0 or h <= 0:
        raise ValueError(f"{label} width and height must be positive")
    return x, y, w, h


def skin_mask(img: np.ndarray, hue: tuple[int, int], sat: tuple[int, int], val: tuple[int, int]) -> np.ndarray:
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h = hsv[..., 0].astype(np.int16)
    s = hsv[..., 1].astype(np.int16)
    v = hsv[..., 2].astype(np.int16)
    m = ((h >= hue[0]) & (h <= hue[1]) & (s >= sat[0]) & (s <= sat[1]) &
         (v >= val[0]) & (v <= val[1])).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    return m


def component_at(mask: np.ndarray, px: float, py: float, window: tuple[int, int, int, int],
                 band: tuple[int, int] | None, radius: int, min_area: int) -> dict | None:
    """Bounding box of the mask component nearest to (px, py) inside window."""
    x0, y0, x1, y1 = window
    sub = mask[y0:y1, x0:x1].copy()
    if band is not None:
        lo = max(0, band[0] - x0)
        hi = min(sub.shape[1], band[1] - x0)
        if hi > lo:
            sub[:, lo:hi] = 0
    count, labels, stats, _ = cv2.connectedComponentsWithStats(sub, 8)
    best = None
    for dy in range(-radius, radius + 1, 2):
        for dx in range(-radius, radius + 1, 2):
            x, y = int(px + dx) - x0, int(py + dy) - y0
            if not (0 <= y < sub.shape[0] and 0 <= x < sub.shape[1]):
                continue
            k = labels[y, x]
            if k == 0:
                continue
            bx, by, bw, bh, area = stats[k]
            if area < min_area:
                continue
            distance = dx * dx + dy * dy
            if best is None or distance < best[0]:
                best = (distance, bx, by, bw, bh, area)
    if best is None:
        return None
    _, bx, by, bw, bh, area = best
    return {"x": int(bx + x0), "y": int(by + y0), "w": int(bw), "h": int(bh), "area": int(area),
            "cx": bx + x0 + bw / 2.0, "cy": by + y0 + bh / 2.0}


def expand(box: dict, margin: int, width: int, height: int) -> tuple[int, int, int, int]:
    return (max(0, box["x"] - margin), max(0, box["y"] - margin),
            min(width, box["x"] + box["w"] + margin), min(height, box["y"] + box["h"] + margin))


def track_skin(mask_paths: list[Path], reference: int, seed: tuple[float, float],
               band: tuple[int, int] | None, width: int, height: int,
               margin: int, radius: int, min_area: int) -> list[dict | None]:
    """Track the skin component holding the seed from the reference frame outwards."""
    count = len(mask_paths)
    track: list[dict | None] = [None] * count

    def detect(index: int, px: float, py: float, window) -> dict | None:
        mask = cv2.imread(str(mask_paths[index]), cv2.IMREAD_GRAYSCALE)
        return component_at(mask, px, py, window, band, radius, min_area)

    origin = detect(reference, seed[0], seed[1], (0, 0, width, height))
    if origin is None:
        raise ValueError(f"no skin region found at seed {seed[0]:.0f},{seed[1]:.0f}")
    track[reference] = origin
    for direction in (1, -1):
        index = reference
        current = origin
        while True:
            nxt = index + direction
            if nxt < 0 or nxt >= count:
                break
            found = detect(nxt, current["cx"], current["cy"], expand(current, margin, width, height))
            track[nxt] = found if found else dict(current)
            if found:
                current = found
            index = nxt
    return track


def track_template(frame_paths: list[Path], reference: int, seed: tuple[float, float],
                   size: tuple[int, int], radius: int, pad: int = 0,
                   min_score: float = 0.0) -> list[dict | None]:
    """Track a fixed-size patch around the seed by normalized cross-correlation.

    `pad` grows the matched template with surrounding context while the reported
    box keeps the requested region size, so a smooth target with no texture of
    its own can still be locked onto by the detail around it. `radius` bounds
    how far the centre may move per frame.
    """
    count = len(frame_paths)
    half_w, half_h = max(1, size[0] // 2), max(1, size[1] // 2)
    first = cv2.imread(str(frame_paths[reference]), cv2.IMREAD_GRAYSCALE)
    sx, sy = int(seed[0]), int(seed[1])
    template = first[max(0, sy - half_h - pad):sy + half_h + pad,
                     max(0, sx - half_w - pad):sx + half_w + pad]
    if template.size == 0:
        raise ValueError("seed point is outside the frame")
    th, tw = template.shape[:2]
    track: list[dict | None] = [None] * count
    position = (float(sx), float(sy))
    track[reference] = {"x": sx - size[0] // 2, "y": sy - size[1] // 2, "w": size[0], "h": size[1],
                         "area": size[0] * size[1], "cx": position[0], "cy": position[1]}
    for direction in (1, -1):
        index = reference
        while True:
            nxt = index + direction
            if nxt < 0 or nxt >= count:
                break
            frame = cv2.imread(str(frame_paths[nxt]), cv2.IMREAD_GRAYSCALE)
            px, py = position
            x0 = max(0, int(px - tw // 2 - radius)); x1 = min(frame.shape[1], int(px + tw // 2 + radius + 1))
            y0 = max(0, int(py - th // 2 - radius)); y1 = min(frame.shape[0], int(py + th // 2 + radius + 1))
            window = frame[y0:y1, x0:x1]
            if window.shape[0] < th or window.shape[1] < tw:
                track[nxt] = dict(track[index])
            else:
                response = cv2.matchTemplate(window, template, cv2.TM_CCOEFF_NORMED)
                _, score, _, location = cv2.minMaxLoc(response)
                if score < min_score:
                    track[nxt] = dict(track[index])
                else:
                    position = (x0 + location[0] + tw / 2.0, y0 + location[1] + th / 2.0)
                    track[nxt] = {"x": int(position[0] - size[0] // 2), "y": int(position[1] - size[1] // 2),
                                  "w": size[0], "h": size[1], "area": size[0] * size[1],
                                  "cx": position[0], "cy": position[1]}
            index = nxt
    return track


def smooth_track(track: list[dict | None], sigma: float) -> list[dict]:
    """Fill gaps, then smooth centre positions so the mask does not jitter."""
    filled: list[dict] = []
    last = None
    for box in track:
        if box is None:
            box = dict(last) if last else {"x": 0, "y": 0, "w": 10, "h": 10, "area": 100,
                                           "cx": 0.0, "cy": 0.0}
        filled.append(box)
        last = box
    if sigma > 0 and len(filled) > 3:
        for key in ("cx", "cy"):
            values = np.array([b[key] for b in filled], np.float64)
            values = cv2.GaussianBlur(values.reshape(-1, 1), (0, 0), sigma).ravel()
            for box, value in zip(filled, values):
                box[key] = float(value)
    return filled


def ellipse_mask(x0: int, y0: int, x1: int, y1: int, cx: float, cy: float,
                 rx: float, ry: float, plateau: float) -> np.ndarray:
    """Feathered elliptical falloff over the ROI (x0,y0,x1,y1) only."""
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    d = np.sqrt(((xx - cx) / max(rx, 1.0)) ** 2 + ((yy - cy) / max(ry, 1.0)) ** 2)
    t = np.clip((1.0 - d) / max(1.0 - plateau, 1e-3), 0.0, 1.0)
    return (t * t * (3 - 2 * t)).astype(np.float32)


def white_core(rx: float, ry: float, peak: float) -> np.ndarray:
    height = max(3, int(ry * 2) + 3)
    width = max(3, int(rx * 2) + 3)
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    d = np.sqrt(((xx - width / 2.0) / max(rx, 1.0)) ** 2 + ((yy - height / 2.0) / max(ry, 1.0)) ** 2)
    return (np.clip(1.0 - d, 0.0, 1.0) ** 1.15 * peak).astype(np.float32)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--start", type=float, default=0.0)
    parser.add_argument("--end", type=float)
    parser.add_argument("--seed", action="append", default=[], metavar="X,Y",
                        help="point inside the region to obscure; repeat for a second region")
    parser.add_argument("--region", action="append", default=[], metavar="X,Y,W,H",
                        help="explicit rectangle to track instead of skin detection; repeatable")
    parser.add_argument("--track-pad", type=int, default=0,
                        help="extra pixels of context added around the region for matching only; "
                             "the blur still covers the region alone. Raise it when the target is "
                             "smooth and has no texture of its own")
    parser.add_argument("--search-radius", type=int, default=60,
                        help="how far the tracked centre may move per frame, in pixels")
    parser.add_argument("--min-score", type=float, default=0.0,
                        help="hold the previous position when the best match scores below this; "
                             "0 accepts every match")
    parser.add_argument("--band", default="", metavar="X1,X2",
                        help="column range excluded from skin detection so neighbouring regions "
                             "do not merge; defaults to the middle half of the gap between seeds")
    parser.add_argument("--zone-width", type=float, default=0.95,
                        help="zone radius as a multiple of the tracked box width")
    parser.add_argument("--zone-height", type=float, default=0.85,
                        help="zone radius as a multiple of the tracked box height")
    parser.add_argument("--blur", type=float, default=0.30,
                        help="blur sigma as a fraction of the zone half-width")
    parser.add_argument("--sigma-min", type=float, default=16.0)
    parser.add_argument("--sigma-max", type=float, default=26.0,
                        help="upper clamp on sigma in pixels; a large sigma reaches past the "
                             "zone and drags dark neighbours into the blur")
    parser.add_argument("--plateau", type=float, default=0.78,
                        help="inner fraction of the zone that receives full blur")
    parser.add_argument("--core", type=float, default=0.0,
                        help="white core opacity inside the zone, 0 disables it")
    parser.add_argument("--milk", type=float, default=2.0,
                        help="brightness lift applied inside the blur")
    parser.add_argument("--reference-frame", type=int, default=-1,
                        help="frame index inside the interval used to seed tracking; default is the middle")
    parser.add_argument("--smooth", type=float, default=2.0)
    parser.add_argument("--min-area", type=int, default=0,
                        help="smallest skin blob in pixels that may be tracked; "
                             "0 derives it from the frame size")
    parser.add_argument("--hue", default=f"{HUE_LO},{HUE_HI}")
    parser.add_argument("--sat", default=f"{SAT_LO},{SAT_HI}")
    parser.add_argument("--val", default=f"{VAL_LO},{VAL_HI}")
    parser.add_argument("--audio", choices=("copy", "aac"), default="copy")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.input.is_file():
        raise ValueError(f"input file not found: {args.input}")
    if args.output.exists():
        raise ValueError("output already exists; choose a new filename")
    if args.output.suffix.lower() != ".mp4":
        raise ValueError("output must be an MP4 file")
    if args.output.resolve() == args.input.resolve():
        raise ValueError("output must differ from the input")
    if not args.seed and not args.region:
        raise ValueError("provide at least one --seed or --region")
    if args.seed and args.region:
        raise ValueError("use either --seed or --region, not both")
    if len(args.seed) > 2 or len(args.region) > 2:
        raise ValueError("at most two regions are supported")
    if args.blur < 0 or args.core < 0 or args.core > 1 or args.milk < 0:
        raise ValueError("--blur, --core and --milk must be non-negative and --core at most 1")
    if args.zone_width <= 0 or args.zone_height <= 0:
        raise ValueError("--zone-width and --zone-height must be positive")
    if not 0.0 < args.plateau < 1.0:
        raise ValueError("--plateau must be between 0 and 1")
    if args.track_pad < 0:
        raise ValueError("--track-pad must not be negative")
    if args.search_radius < 0:
        raise ValueError("--search-radius must not be negative")
    if not 0.0 <= args.min_score <= 1.0:
        raise ValueError("--min-score must be between 0 and 1")
    if args.min_area < 0:
        raise ValueError("--min-area must not be negative")

    media = probe(args.ffprobe, args.input)
    video = next((s for s in media.get("streams", []) if s.get("codec_type") == "video"), None)
    if video is None:
        raise ValueError("input has no video stream")
    width, height = int(video["width"]), int(video["height"])
    duration = finite(video.get("duration") or media.get("format", {}).get("duration"),
                      "video duration")
    if duration <= 0:
        raise ValueError("video duration must be positive")
    rate = (video.get("avg_frame_rate") or video.get("r_frame_rate") or "30/1").split("/", 1)
    fps = float(rate[0]) / float(rate[1]) if float(rate[1]) > 0 else 30.0
    if not math.isfinite(fps) or fps <= 0:
        raise ValueError("could not determine a positive frame rate")
    total = int(video.get("nb_frames") or 0) or max(1, round(duration * fps))

    start = max(0.0, finite(args.start, "start"))
    end = duration if args.end is None else finite(args.end, "end")
    if end <= start or end > duration:
        raise ValueError("interval must be inside the video duration")
    first = int(round(start * fps))
    last = min(total, int(round(end * fps)))
    if last - first < 2:
        raise ValueError("interval is too short to track")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".blur-censor-", dir=args.output.parent) as temp_name:
        temp = Path(temp_name)
        frames_dir = temp / "frames"
        mask_dir = temp / "masks"
        out_dir = temp / "rendered"
        frames_dir.mkdir()
        mask_dir.mkdir()
        out_dir.mkdir()

        run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(args.input),
             "-vf", f"trim=start_frame={first}:end_frame={last},setpts=PTS-STARTPTS",
             "-fps_mode", "passthrough", str(frames_dir / "%06d.png")])
        frame_paths = sorted(frames_dir.glob("*.png"))
        if len(frame_paths) != last - first:
            raise ValueError(f"expected {last - first} frames, decoded {len(frame_paths)}")

        reference = args.reference_frame
        if reference < 0:
            reference = len(frame_paths) // 2
        reference = max(0, min(len(frame_paths) - 1, reference))

        if args.seed:
            hue = tuple(int(v) for v in parse_pair(args.hue, "hue"))
            sat = tuple(int(v) for v in parse_pair(args.sat, "sat"))
            val = tuple(int(v) for v in parse_pair(args.val, "val"))
            seeds = [parse_pair(s, "--seed") for s in args.seed]
            band = None
            if args.band:
                band = tuple(int(v) for v in parse_pair(args.band, "--band"))
            elif len(seeds) == 2:
                low = min(seeds[0][0], seeds[1][0])
                high = max(seeds[0][0], seeds[1][0])
                gap = high - low
                band = (int(low + gap * 0.25), int(high - gap * 0.25))
            for index, path in enumerate(frame_paths):
                image = cv2.imread(str(path))
                cv2.imwrite(str(mask_dir / f"{index + 1:06d}.png"), skin_mask(image, hue, sat, val))
            mask_paths = sorted(mask_dir.glob("*.png"))
            min_area = args.min_area or max(400, int(0.0006 * width * height))
            tracks = [track_skin(mask_paths, reference, seed, band, width, height,
                                 margin=24, radius=50, min_area=min_area) for seed in seeds]
        else:
            rects = [parse_rect(r, "--region") for r in args.region]
            tracks = [track_template(frame_paths, reference,
                                     (rect[0] + rect[2] / 2, rect[1] + rect[3] / 2),
                                     (int(rect[2]), int(rect[3])), radius=args.search_radius,
                                     pad=args.track_pad, min_score=args.min_score)
                      for rect in rects]

        smoothed = [smooth_track(track, args.smooth) for track in tracks]

        for index, path in enumerate(frame_paths):
            image = cv2.imread(str(path))
            out = image.astype(np.float32)
            for boxes in smoothed:
                box = boxes[index]
                cx, cy = box["cx"], box["cy"]
                rx = max(12.0, args.zone_width * box["w"])
                ry = max(12.0, args.zone_height * box["h"])
                sigma = float(np.clip(args.blur * rx, args.sigma_min, args.sigma_max))
                pad = int(3 * sigma) + 4
                x0 = max(0, int(cx - rx - pad)); x1 = min(width, int(cx + rx + pad))
                y0 = max(0, int(cy - ry - pad)); y1 = min(height, int(cy + ry + pad))
                patch = image[y0:y1, x0:x1]
                blurred = cv2.GaussianBlur(patch, (0, 0), sigma).astype(np.float32)
                zone = ellipse_mask(x0, y0, x1, y1, cx, cy, rx, ry, args.plateau)
                out[y0:y1, x0:x1] = (out[y0:y1, x0:x1] * (1 - zone[:, :, None]) +
                                     (blurred + args.milk * zone[:, :, None]) * zone[:, :, None])
            out = np.clip(out, 0, 255).astype(np.uint8)
            if args.core > 0:
                for boxes in smoothed:
                    box = boxes[index]
                    cx, cy = box["cx"], box["cy"]
                    rx = max(12.0, args.zone_width * box["w"])
                    ry = max(12.0, args.zone_height * box["h"])
                    core = white_core(rx * 0.36, ry * 0.36, args.core)
                    ch, cw = core.shape
                    sx = int(round(cx - cw / 2)); sy = int(round(cy - ch / 2))
                    ax0, ay0 = max(0, -sx), max(0, -sy)
                    sx = max(0, sx); sy = max(0, sy)
                    sx1 = min(width, sx + cw - ax0); sy1 = min(height, sy + ch - ay0)
                    if sx1 <= sx or sy1 <= sy:
                        continue
                    layer = core[ay0:ay0 + (sy1 - sy), ax0:ax0 + (sx1 - sx)]
                    region = out[sy:sy1, sx:sx1].astype(np.float32)
                    out[sy:sy1, sx:sx1] = np.clip(
                        region * (1 - layer[:, :, None]) + 255.0 * layer[:, :, None], 0, 255).astype(np.uint8)
            cv2.imwrite(str(out_dir / f"{index + 1:06d}.png"), out)

        chains, labels = [], []
        index = 0
        if first > 0:
            chains.append(f"[0:v]trim=start_frame=0:end_frame={first},setpts=PTS-STARTPTS[c{index}]")
            labels.append(f"[c{index}]")
            index += 1
        chains.append(f"[1:v]setpts=PTS-STARTPTS[c{index}]")
        labels.append(f"[c{index}]")
        index += 1
        if last < total:
            chains.append(f"[0:v]trim=start_frame={last},setpts=PTS-STARTPTS[c{index}]")
            labels.append(f"[c{index}]")
        graph = ";".join(chains) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=1[v]"

        staged = temp / "render.mp4"
        run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(args.input), "-framerate", f"{fps:.12g}", "-i", str(out_dir / "%06d.png"),
             "-filter_complex", graph, "-map", "[v]", "-map", "0:a?",
             "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
             "-c:a", args.audio, "-movflags", "+faststart", str(staged)])
        rendered = probe(args.ffprobe, staged)
        if not any(s.get("codec_type") == "video" for s in rendered.get("streams", [])):
            raise ValueError("rendered output has no video stream")
        os.replace(staged, args.output)

    print(json.dumps({
        "output": str(args.output.resolve()),
        "input": str(args.input.resolve()),
        "interval": [start, end],
        "frames": [first, last],
        "referenceFrame": reference,
        "videoFPS": fps,
        "videoSize": [width, height],
        "regions": len(smoothed),
        "mode": "skin-seed" if args.seed else "template-rect",
        "blurFraction": args.blur,
        "audioMode": args.audio,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        detail = exc.stderr if isinstance(exc, subprocess.CalledProcessError) else str(exc)
        print(f"error: {detail}", file=sys.stderr)
        raise SystemExit(2)
``````

### 文件：tests/test_blur_censor.py

SHA-256：`15f2b6716a7a1c94804d55dd147cba3a0a5992b7718acd0c50856425b5487611`

``````python
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import cv2
import numpy as np

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'blur_censor.py'
spec = importlib.util.spec_from_file_location('blur_censor', SCRIPT)
censor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(censor)

FFMPEG = os.environ.get('FFMPEG') or shutil.which('ffmpeg')
FFPROBE = os.environ.get('FFPROBE') or shutil.which('ffprobe')

WIDTH, HEIGHT, FRAMES, FPS = 160, 120, 10, 10


def skin_bgr(value):
    return cv2.cvtColor(np.uint8([[[28, 100, value]]]), cv2.COLOR_HSV2BGR)[0][0]


def make_frame(index):
    """White stage with a moving skin-toned checkerboard block."""
    image = np.full((HEIGHT, WIDTH, 3), 245, np.uint8)
    left = 20 + index * 8
    top = (HEIGHT - 40) // 2
    light, dark = skin_bgr(180), skin_bgr(140)
    grid = (np.add.outer(np.arange(40), np.arange(40)) // 10) % 2
    tile = np.where(grid[..., None] == 0, light, dark)
    image[top:top + 40, left:left + 40] = tile
    return image


class ArgumentTests(unittest.TestCase):
    def test_defaults_match_the_validated_recipe(self):
        with patch.object(sys, 'argv', ['blur_censor', '--input', 'in.mp4', '--output', 'out.mp4']):
            args = censor.parse_args()
        self.assertEqual(args.blur, 0.30)
        self.assertEqual(args.zone_width, 0.95)
        self.assertEqual(args.zone_height, 0.85)
        self.assertEqual(args.plateau, 0.78)
        self.assertEqual(args.milk, 2.0)
        self.assertEqual(args.core, 0.0)
        self.assertEqual(args.sigma_max, 26.0)
        self.assertEqual(args.min_area, 0)

    def test_parse_rect_rejects_non_positive_size(self):
        for text in ('1,2,0,4', '1,2,4,-1', '1,2,4'):
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    censor.parse_rect(text, '--region')

    def test_parse_rect_reads_four_numbers(self):
        self.assertEqual(censor.parse_rect('10,20,30,40', '--region'), (10.0, 20.0, 30.0, 40.0))

    def test_parse_pair_rejects_non_finite(self):
        with self.assertRaises(ValueError):
            censor.parse_pair('nan,1', '--seed')


class MaskTests(unittest.TestCase):
    def test_skin_mask_selects_skin_and_rejects_white_and_red(self):
        image = np.full((40, 40, 3), 245, np.uint8)
        image[10:30, 10:30] = skin_bgr(180)
        image[10:30, 30:40] = (0, 0, 220)
        mask = censor.skin_mask(image, (5, 34), (85, 180), (120, 250))
        self.assertGreater(mask[15:25, 15:25].mean(), 200)
        self.assertLess(mask[15:25, 32:38].mean(), 60)
        self.assertLess(mask[33:38, 15:25].mean(), 60)

    def test_component_at_picks_the_component_under_the_seed(self):
        mask = np.zeros((100, 200), np.uint8)
        mask[10:40, 10:50] = 255
        mask[60:95, 150:195] = 255
        box = censor.component_at(mask, 30.0, 25.0, (0, 0, 200, 100), None, 10, 200)
        self.assertIsNotNone(box)
        self.assertEqual((box['x'], box['y'], box['w'], box['h']), (10, 10, 40, 30))

    def test_component_at_band_separates_neighbours(self):
        mask = np.zeros((60, 120), np.uint8)
        mask[10:50, 10:60] = 255
        mask[10:50, 60:110] = 255
        merged = censor.component_at(mask, 30.0, 30.0, (0, 0, 120, 60), None, 10, 200)
        split = censor.component_at(mask, 30.0, 30.0, (0, 0, 120, 60), (60, 120), 10, 200)
        self.assertEqual(merged['w'], 100)
        self.assertEqual(split['w'], 50)


class GeometryTests(unittest.TestCase):
    def test_ellipse_mask_plateaus_then_feathers_to_zero(self):
        mask = censor.ellipse_mask(0, 0, 100, 100, 50.0, 50.0, 40.0, 50.0, 0.55)
        self.assertGreater(mask[50, 50], 0.99)
        self.assertGreater(mask[50, 72], 0.99)
        self.assertAlmostEqual(float(mask[50, 90]), 0.0, places=5)

    def test_smooth_track_fills_gaps_from_the_previous_box(self):
        box = {'x': 1, 'y': 1, 'w': 10, 'h': 10, 'area': 100, 'cx': 5.0, 'cy': 5.0}
        filled = censor.smooth_track([None, box, None], 0.0)
        self.assertEqual(len(filled), 3)
        self.assertEqual(filled[2]['cx'], 5.0)
        self.assertEqual(filled[0]['cx'], 0.0)

    def test_smooth_track_damps_a_single_frame_jitter(self):
        base = {'x': 0, 'y': 0, 'w': 10, 'h': 10, 'area': 100, 'cx': 50.0, 'cy': 50.0}
        track = [dict(base) for _ in range(9)]
        track[4] = dict(base, cx=90.0)
        smoothed = censor.smooth_track(track, 2.0)
        self.assertLess(abs(smoothed[4]['cx'] - 50.0), 20.0)
        self.assertGreater(abs(smoothed[4]['cx'] - 50.0), 0.0)

    def test_smooth_track_keeps_a_steady_position_steady(self):
        base = {'x': 0, 'y': 0, 'w': 10, 'h': 10, 'area': 100, 'cx': 50.0, 'cy': 70.0}
        smoothed = censor.smooth_track([dict(base) for _ in range(9)], 2.0)
        for box in smoothed:
            self.assertAlmostEqual(box['cx'], 50.0, places=5)
            self.assertAlmostEqual(box['cy'], 70.0, places=5)


class TemplateTrackingTests(unittest.TestCase):
    """The template mode: padded context, bounded search, confidence gate."""

    def _frames(self, root, count=9, shift=6, size=300, start=80):
        """A textured static background with a high-contrast patch moving across it."""
        paths = []
        rng = np.random.RandomState(7)
        background = rng.randint(24, 36, (size, size, 3)).astype(np.uint8)
        patch = rng.randint(0, 255, (40, 40, 3)).astype(np.uint8)
        for i in range(count):
            image = background.copy()
            x, y = start + i * shift, 90
            image[y:y + 40, x:x + 40] = patch
            path = root / f'f{i:04d}.png'
            cv2.imwrite(str(path), image)
            paths.append(path)
        return paths

    def test_track_follows_a_moving_target(self):
        with tempfile.TemporaryDirectory() as temp:
            paths = self._frames(Path(temp))
            track = censor.track_template(paths, 0, (100, 110), (40, 40), radius=20)
            self.assertAlmostEqual(track[8]['cx'], 80 + 8 * 6 + 20, delta=3)
            self.assertAlmostEqual(track[8]['cy'], 110, delta=3)

    def test_track_pad_keeps_the_reported_region_size(self):
        with tempfile.TemporaryDirectory() as temp:
            paths = self._frames(Path(temp))
            track = censor.track_template(paths, 0, (100, 110), (40, 40), radius=20, pad=40)
            for box in track:
                self.assertEqual((box['w'], box['h']), (40, 40))

    def test_track_pad_still_follows_the_target(self):
        with tempfile.TemporaryDirectory() as temp:
            paths = self._frames(Path(temp))
            track = censor.track_template(paths, 0, (100, 110), (40, 40), radius=20, pad=40)
            self.assertAlmostEqual(track[8]['cx'], 80 + 8 * 6 + 20, delta=4)

    def test_min_score_holds_the_position_when_the_target_disappears(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            paths = self._frames(root)
            blank = root / 'blank.png'
            cv2.imwrite(str(blank), np.full((200, 200, 3), 30, np.uint8))
            paths = paths[:5] + [blank, blank, blank, blank]
            track = censor.track_template(paths, 0, (100, 110), (40, 40), radius=20, min_score=0.9)
            self.assertEqual(track[8]['cx'], track[4]['cx'])
            self.assertEqual(track[8]['cy'], track[4]['cy'])

    def test_search_radius_bounds_the_per_frame_movement(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            rng = np.random.RandomState(7)
            background = rng.randint(24, 36, (200, 200, 3)).astype(np.uint8)
            patch = rng.randint(0, 255, (40, 40, 3)).astype(np.uint8)
            paths = []
            for i in range(3):
                image = background.copy()
                x = 80 if i == 0 else 160          # the target jumps 80 px
                image[90:130, x:x + 40] = patch
                path = root / f'f{i:04d}.png'
                cv2.imwrite(str(path), image)
                paths.append(path)
            track = censor.track_template(paths, 0, (100, 110), (40, 40), radius=10)
            self.assertLessEqual(abs(track[1]['cx'] - track[0]['cx']), 11.0)


@unittest.skipUnless(FFMPEG and FFPROBE, 'FFmpeg and ffprobe required')
class RenderTests(unittest.TestCase):
    def build_source(self, root):
        frames = root / 'frames'
        frames.mkdir()
        for index in range(FRAMES):
            cv2.imwrite(str(frames / f'{index + 1:04d}.png'), make_frame(index))
        source = root / 'source.mp4'
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-framerate', str(FPS),
                        '-i', str(frames / '%04d.png'),
                        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
                        '-shortest', str(source)], check=True)
        return source

    def test_blur_reduces_roi_contrast_and_preserves_audio(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = self.build_source(root)
            output = root / 'output.mp4'
            command = [sys.executable, str(SCRIPT), '--input', str(source), '--output', str(output),
                       '--seed', '40,60', '--blur', '0.20', '--zone-width', '1.50',
                       '--zone-height', '1.08', '--plateau', '0.55', '--milk', '2.0',
                       '--ffmpeg', FFMPEG, '--ffprobe', FFPROBE]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)

            streams = censor.probe(FFPROBE, output)['streams']
            self.assertEqual([s['codec_type'] for s in streams], ['video', 'audio'])
            video = next(s for s in streams if s['codec_type'] == 'video')
            self.assertEqual((video['width'], video['height']), (WIDTH, HEIGHT))
            self.assertEqual(int(video['nb_frames']), FRAMES)

            def frame_at(path, index):
                raw = subprocess.run([FFMPEG, '-v', 'error', '-i', str(path), '-f', 'rawvideo',
                                      '-pix_fmt', 'bgr24', '-'], check=True, capture_output=True).stdout
                return np.frombuffer(raw, np.uint8).reshape(-1, HEIGHT, WIDTH, 3)[index]

            source_frame = frame_at(source, 5)
            output_frame = frame_at(output, 5)
            left = 20 + 5 * 8 + 10
            top = (HEIGHT - 40) // 2 + 10
            roi = (slice(top, top + 20), slice(left, left + 20))
            before = source_frame[roi].max(axis=2).std()
            after = output_frame[roi].max(axis=2).std()
            self.assertGreater(before, 10.0)
            self.assertLess(after, before / 3.0)

            before_bytes = output.read_bytes()
            again = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(again.returncode, 0)
            self.assertEqual(before_bytes, output.read_bytes())
            self.assertFalse(list(root.glob('.blur-censor-*')))

    def test_template_region_mode_renders(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = self.build_source(root)
            output = root / 'region.mp4'
            command = [sys.executable, str(SCRIPT), '--input', str(source), '--output', str(output),
                       '--region', '30,40,40,40', '--blur', '0.20',
                       '--ffmpeg', FFMPEG, '--ffprobe', FFPROBE]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(output.is_file())
            self.assertFalse(list(root.glob('.blur-censor-*')))


if __name__ == '__main__':
    unittest.main()
``````

