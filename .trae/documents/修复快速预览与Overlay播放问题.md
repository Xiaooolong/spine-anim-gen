## 问题结论（基于当前代码与日志）

### 1) 快速预览“资源加载失败”
根因在 [SpinePixiPreview.tsx](file:///e:/aivilization/spine-anim-gen/src/components/SpinePixiPreview.tsx)：
- 本地模式下 `finalUrl` 是 `blob:` URL，不含 `.json` 后缀，当前用 `finalUrl.replace('.json','.atlas')` 推导 atlas 必然失败，导致 fallback 永远加载不到 atlas。
- 你用 `PIXI.Assets.add` 注册 atlas/png 的 alias，但 spine loader 在 blob 场景下无法通过相对路径/推导 URL 去命中这些 alias。
- atlas 内部引用 png 名称可能与 `png.name` 不一致（比如带目录或大小写），即使 atlas 读到了也会贴图丢失。

### 2) 新建任务 Overlay Pose 视频不能播放
Overlay 视频由 Python OpenCV 用 `mp4v` 编码写出（见 [poseExtractor.ts](file:///e:/aivilization/spine-anim-gen/api/services/poseExtractor.ts) 的脚本片段），Chrome/Edge 在 Windows 上经常不支持该编码或无法流式播放。
理论上后端会用 ffmpeg 把 overlay 转成 H.264 + faststart（可播放），但当前实现对 ffmpeg 的启动失败是“静默跳过”，并且缺少明确的重编码结果诊断。

---

## 修复方案（不改变业务逻辑，只增强兼容性/可用性）

### A. 修复快速预览加载链路（推荐做法：显式加载 atlas + 纹理映射）
1. 在 [SpinePixiPreview.tsx](file:///e:/aivilization/spine-anim-gen/src/components/SpinePixiPreview.tsx) 的 `localFiles` 分支中：
   - 不再通过 blob URL 推导 `.atlas`。
   - 改为：
     - 读出 `.atlas` 文本；
     - 用 Pixi 的 `spineTextureAtlasLoader`（见 [atlasLoader.js](file:///e:/aivilization/spine-anim-gen/node_modules/@esotericsoftware/spine-pixi-v8/dist/assets/atlasLoader.js)）加载 atlas，并通过 `data.images` 直接注入本地 png（`TextureSource`），避免任何相对路径 fetch。
     - 用 `AtlasAttachmentLoader + SkeletonJson` 手动 `readSkeletonData`，再 `new Spine(skeletonData)`。
2. 处理多贴图 atlas：
   - 先解析 atlas 的 page name（通常第一段就是 png 文件名），按 page name 去匹配用户拖入的 png 文件。
   - 若匹配不到，给出明确错误（提示缺少哪张贴图/atlas 里引用的名字是什么）。
3. 资源清理：
   - 在组件卸载/重新加载时 revoke `URL.createObjectURL`，并清理 Pixi Assets cache 中临时注册项，避免越用越卡。
4. UI 反馈增强：
   - 在 QuickPreview 中显示“检测到的 json/atlas/png”以及 atlas page 名称，错误时展示具体原因而不是笼统“资源加载失败”。

### B. 修复 Overlay Pose 视频播放（确保生成视频为 H.264 faststart）
1. 在 [poseExtractor.ts](file:///e:/aivilization/spine-anim-gen/api/services/poseExtractor.ts) 的 `reencodeH264`：
   - 改为优先使用 `ffmpeg-static` 默认导出的真实可执行路径（项目已有类型声明 [ffmpeg-static.d.ts](file:///e:/aivilization/spine-anim-gen/types/ffmpeg-static.d.ts)）。
   - 若 ffmpeg 启动失败，不再静默：写入 `pose_extract.log`（或单独 `pose_overlay.ffmpeg.log`）标记重编码失败原因。
2. 在 `extractPose2D` 结束时：
   - 对 `pose_overlay.mp4` 强制重编码：`-c:v libx264 -pix_fmt yuv420p -movflags +faststart`（你当前已有该参数，核心是确保 ffmpeg 一定能跑起来且可诊断）。
3. 前端兜底提示：
   - 在 [JobDetail.tsx](file:///e:/aivilization/spine-anim-gen/src/pages/JobDetail.tsx) 给 overlay `<video>` 加 `onError` + “直接打开链接/下载” 提示，避免用户只看到“不能播放”但无诊断信息。

---

## 验证方式
1. 快速预览：拖入一套 Spine 资源（json+atlas+png），预览应能显示骨骼与动画；缺文件时提示“缺 atlas/缺 png/atlas 引用名不匹配”。
2. Overlay 播放：新建任务跑完后，浏览器中 overlay 视频可正常播放；如果仍失败，UI 会显示可点击的资源直链，并且后端日志里能看到 ffmpeg 重编码是否成功。

我将按 A→B 的顺序改代码并在本地跑一遍验证。确认后我开始动手。