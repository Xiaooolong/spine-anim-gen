## 动态展示所有支持的动画方案

为了让你能看到并测试 JSON 文件中包含的所有动画，我将对预览组件进行以下改进：

### 1. 动态提取动画列表
- 在 [SpinePixiPreview.tsx](file:///e:/aivilization/spine-anim-gen/src/components/SpinePixiPreview.tsx) 中，当 Spine 数据加载完成后，从 `spineAnim.skeleton.data.animations` 中提取出所有可用的动画名称。
- 将这些名称存储在组件的 `state` 中。

### 2. UI 升级：动画切换面板
- 移除目前硬编码的三个按钮（Retarget V2, Walk, Run）。
- 新增一个“动画列表”面板（或下拉菜单）：
  - 列出该模型支持的所有动画。
  - 标记当前正在播放的动画。
  - 点击列表中的任意动画名，即可立即切换并循环播放。
- 增加“播放/暂停”以及“调整播放速度”的简易控制。

### 3. 优化交互
- 在预览界面的右上角增加一个带滚动的列表容器，确保在动画数量较多时（如 spineboy 有 10+ 个动画）依然能够方便地选择。

---

## 实施步骤
1. 修改 `SpinePixiPreview.tsx`：
   - 增加 `animations` 状态。
   - 在加载逻辑最后，通过 `spineAnim.skeleton.data.animations.map(a => a.name)` 更新状态。
   - 重构右侧的按钮区域，改为根据 `animations` 数组动态生成。
2. 验证：
   - 在“快速预览”中拖入文件，确认右侧出现了该文件对应的所有动画名称。
   - 在“任务详情”页，确认生成的动画以及原始自带动画都能正常切换。

确认后我将开始实施。