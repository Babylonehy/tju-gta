# Game Feedback

记录开发期间确认的 Engine、SDK、模板、构建、资产、运行时或浏览器问题。该文件会和根
`README.md` 一起原样进入 Web ZIP；不要写入 token、密码、私有 URL 或其他敏感信息。

```markdown
### YYYY-MM-DD — Short issue title

- Scope: Engine | SDK | template | build | asset | runtime | browser
- Reproduction: exact command or smallest user-visible sequence
- Expected: what should happen
- Actual: what happened
- Evidence: log, screenshot, URL, or commit path
- Status: open | workaround | fixed | blocked
```

### 2026-11-05 — 北侧环岛宽带轮廓自相交

- 范围：地图程序化资产。
- 复现：执行几何 Pack 的 `build()`，生成亲民北道的整条道路轮廓。
- 预期：北侧路面和环岛可分别生成简单轮廓。
- 实际：用主路的整幅宽度绕紧弯偏移时，`road-qinmin-n` 轮廓自相交，ForgeAX 几何构建拒绝该轮廓。
- 证据：`assets/campus/geometry.pack.ts` 的原生构建，`asset-parse-failed`、`contour must not self-intersect`。
- 修复：道路用平顺接线，环岛面与岛心独立建模；自动巡行在环岛前折返。

### 2026-11-05 — 写实人物 GLB 的贴图缺少稳定名称

- 范围：人物 glTF 源资产导入。
- 复现：用 ForgeAX `asset import` 导入 CharacterCreator 导出的学生或门卫 GLB。
- 预期：两套模型的嵌入贴图按材质用途分别生成稳定 GUID。
- 实际：导出器留下多张无名贴图，ForgeAX 返回 `ambiguous-source-key`。
- 证据：`/tmp/beiyang-student-import.json`、`/tmp/beiyang-guard-import.json`。
- 修复：在作者源中用材质名称与贴图用途为纹理命名，再经正式导入器重新导入。
- 同一导出器还为每个贴图重复写入相同的无名采样器；已合并相同采样参数，保留可读名称和原滤镜设置。

### 2026-11-05 — ForgeAX 0.4.8 的多部件人物蒙皮越过绑定窗口

- 范围：Chrome WebGPU，ForgeAX GPU Scene 蒙皮。
- 复现：分别实例化学生和门卫，每个 GLB 把衣物、头发和人体拆成 12 个共享 53 根骨骼的网格节点。从东门绕到学生正面，或向闸机移动。
- 预期：学生和门卫各自的衣物、脸和手始终跟随本人的骨骼。
- 实际：部分网格错位，门卫的部分衣物会出现在学生身上。
- 证据：`/tmp/beiyang-skin-before.rhitape`，SHA-256 `f2068c1eea6cdecf93c48a377d4ec23d230c76ff5895cf8ee1beea23c92c7120`，work 34–59、103–128。`skin-palette` 实际有 24 个写入区段，起点 0–82432；这些 draw 绑定的读取窗口大小为 16320，动态偏移均为 0。
- 项目侧修复：导出时把使用同一骨架的部件合并到一个带多个材质的网格。每位人物只需一份骨骼数据，保留原材质与动画。引擎处理任意数量独立蒙皮网格的限制留待引擎端解决。
- 复验：`/tmp/beiyang-skin-after.rhitape`，SHA-256 `5319a95456f5bec828b97e3ec6ee28ae1700197e8b4570ce3e4323ae33da19a3`。同一读取窗口只有 0、3584 两处写入，各 3392 字节；Chrome 实景中学生、门卫不再错位。

### 2026-11-05 — GLB 合并部件后，重新导入保留已删除的材质槽覆盖

- 范围：ForgeAX 0.4.8 glTF 导入及构建。
- 复现：合并两个 GLB 的网格，再运行 `forgeax asset import --path ...` 和生产构建。
- 预期：保留现有子资产的 GUID，丢弃已不存在的网格槽默认值。
- 实际：导入成功，但侧车仍有旧网格 `sourceOverrides`；构建返回 `pack-malformed-meta`，明细 `unknown-source-key`。
- 修复：删除已退役网格的覆盖条目，保留新网格槽、模型场景、动画和贴图的 GUID。

### 2026-11-05 — OSM 样片的无贴图材质与原校园共享程序键

- 范围：ForgeAX 0.4.8 glTF 材质导入后的 Chrome 运行时。
- 复现：打开地图并进入 44 教。GLB 导入与生产构建成功，载入场景时报 `material-artifact-conflict`。
- 证据：导入的 `Material_8` 和 `Ground fill - neutral grass` 与校园原有 Standard 材质共享程序键 `sha256:242ef579d2bb22182ead022220f98c45674a370af72795792f6737c071be56e5`，但产物的 `alphaChannel` 参数顺序不同。
- 项目侧修复：为桥和底地分别指定附件里的混凝土、草地贴图与米制 UV，经原导入器重新生成材质，保持场景 GUID。

### 2026-11-05 — GLB 插入贴图时，导入器按旧索引复用了 GUID

- 范围：ForgeAX 0.4.8 glTF 重新导入。
- 复现：在 44 教 GLB 增加三张命名的红砖贴图，保留侧车并重新导入。
- 实际：导入成功，构建返回 `pack-guid-collision`。三张新贴图复用了旧 `Image_37`、`Image_36`、`Image_35` 的 GUID。
- 修复：只为三个新贴图分配新的 GUID，保留已有贴图、模型和场景的身份。

### 2026-11-05 — 全校预览的路灯场景字段校验

- 范围：ForgeAX 0.4.8 生产构建后的浏览器启动。
- 复现：构建全校 GLB 版本，在 Chrome 打开 Engine Preview。
- 预期：加载地图并提交首帧。实际：`beiyang/campus` 启动报 `asset-package-invalid`，场景实体 `lamp-0` 的 `PointLight.castShadow` 不是已声明字段。
- 证据：浏览器启动面板 `plugin-startup-failed`，完整详情见本机 `/tmp/beiyang-full-diag.log`。
- 修复：保留灯色、亮度和范围，移除无效字段并重新构建。

### 2026-11-05 — 天空和环境光引用不同的懒加载立方体

- 范围：ForgeAX 0.4.8 浏览器首帧确认。
- 复现：用两个不同的共享 Equirect 句柄设置 `SkyboxBackground` 和 `Skylight`，打开全校生产预览。
- 预期：首帧的两个环境资源就绪，进入游戏。实际：场景已绘制，天空盒句柄 1077 的立方体没有就绪状态，呈现回执持续为 `pending`。实时检查确认全校 GLB 材质均为 `ready`。
- 证据：RHI 捕获 SHA-256 `3d39586230c2c7ad0f3d41ce04366c1706616d5b3075ed43435556c82450055d`，同帧包含标准不透明、阴影与合成通道。本机 `/tmp/beiyang-full-frame-cause.log` 记录了阻塞首帧的立方体状态。
- 项目侧修复：每个时段让背景和 IBL 共用同一个已注册的天空资源。启动继续使用场景原有的白天句柄。

### 2026-11-05 — 地表与建筑贴图可见性

- 范围：Chrome WebGPU 的东门、南门停车场及校园外墙。
- 复现：用上一版全校场景默认视角靠近上述表面。东门门柱和铺面是纯色材质，停车场的深色细粒贴图在常用镜头距离近似纯色，原来的路面 UV 重投影未同步更新切线。
- 修复：东门铺面和门柱使用有纹理的世界坐标投影。路面换成更易辨认的 CC0 沥青，校准地表与外墙 UV 和切线。建筑轮廓仍从原 GLB 读取。
- 证据：新旧浏览器的停车场和东门截图，保存在本轮可视化目录。旧 WebGPU 帧 `3d39586230c2c7ad0f3d41ce04366c1706616d5b3075ed43435556c82450055d` 来自同一旧版 GLB。SDK 的 Dawn 原生回放提供器在此环境未安装，单项回放返回 `replay-backend-unavailable`。

### 2026-11-05 — 切换玩家时 GPU 蒙皮读取超出绘制窗口

- 范围：ForgeAX 0.4.8，Chrome WebGPU，玩家与三个 NPC 的场景。
- 复现：重新实例化女学生网格并销毁男学生网格。角色标签切换成功，但新模型在部分角度变形。
- 证据：切换前 RHI SHA-256 `49e3151aa16b163d759afaeda50ad2fe179025e7510cac92a61ddfc77ec7420c`，四份 3392 字节的骨骼数据位于 0、3584、7168、10752。切换后 RHI SHA-256 `e3241dc135d25f343de67d2555fa2957f34e259019b1965d8bb129320fa517c5`，新数据位于 14336。间接绘制 work 220 的共享蒙皮绑定窗口只有 16320 字节，覆盖不到新模型的完整骨骼。
- 修复：两位学生分别承担玩家和步行 NPC 的职责。切换只更换场景父节点与播放状态，两个蒙皮实体沿用固定身份。
- 复验：切换后 RHI SHA-256 `df426a421d1e4f0d03ce697a92dfa2d73130067617d8b22411e5ef20835a19f8`，四份骨骼数据均在 16320 字节窗口内。Chrome 中双向切换、骑行时切换及刷新恢复均通过。

### 2026-11-06 — 北区灰色外墙与材质诊断

- 范围：北区驿站和周围的 OSM2World 通用建筑。
- 复现：在原 ForgeAX Preview 进入北区菜鸟驿站。旧场景大量外墙共用低饱和灰色灰泥，和原灰白天空接近。
- 证据：已打开旧浏览器画面。另尝试用 \`forgeax dev start --rhi-capture true\` 获取同一位置的开发帧，浏览器启动导航中止。命令结果位于本机 \`/tmp/beiyang-campuslife-before-dev.json\`。
- 修复：保留建筑底面，使用红砖 PBR 材质与补充窗面，保留需要混凝土的墙面。昼间天空加入云层。

### 2026-11-06 — 纪念广场铺装的 PBR 切线缺失

- 范围：ForgeAX 0.4.8，Chrome WebGPU，最终纪念广场铺装首次启动。
- 复现：构建带程序环形铺装网格的项目并打开 ForgeAX Preview。环形网格使用带法线贴图的混凝土。
- 预期：第二帧成功完成阴影和颜色渲染。实际：阴影管线验证返回 \`shader-compile-failed\`，顶点状态缺少插槽 3 的切线。静态构建和资产校验当时已通过。
- 证据：本机 \`/tmp/beiyang-paving-tangent-error.log\`，Chrome WebGPU 第 2 帧。
- 修复：程序铺装网格提供与米制平面 UV 一致的切线。

### 2026-11-06 — 55 教前庭与原混凝土贴图重名

- 范围：ForgeaX 0.4.8 的校园 GLB 导入。新增 55 教前庭时，生成器重复写入已有混凝土纹理，导入返回 duplicate-source-key。
- 预期：前庭和原混凝土表面共用一组贴图。实际：生成了两个 concrete_wall_009_diff_1k，位于纹理索引 49 和 53。
- 修复：在生成器中复用原混凝土贴图引用，保留现有纹理身份。

### 2026-11-06 — 55 教独立材质使预览清单超过大小上限

- 范围：ForgeaX 0.4.8 和本地预览连接器。首次重建 55 教后，生产构建生成 1,142,550 字节的资源清单，连接器报 static manifest is too large。
- 证据：构建为七份新材质各生成 42 个独立的着色器产物。连接器的静态清单校验上限为 1 MiB。
- 修复：55 教复用校园 GLB 已有的 PBR 材质，通过顶点颜色、玻璃纹理的取样区域和实建窗洞区分外观。

### 2026-11-06 — GitHub Pages 冷启动超过 Worker 握手时限

- 范围：ForgeaX 0.4.8，GitHub Pages 部署 `42196510345`，Chrome 1440×960 新会话。
- 复现：清空站点缓存后打开公开 HTTPS 网址。主页、部署配置和资源清单均返回 200，游戏 Worker 仍在获取首帧资源。
- 预期：引擎完成初始化并显示校园。实际：默认生产启动时限为 30 秒，首次加载超过该时限，Host 报 `plugin-startup-failed`，内层错误是 `app-execution-deadline-exceeded`，阶段为 `handshake`。
- 证据：GitHub Actions 运行 `42196510345`；本机 `/tmp/beiyang-pages-public-clean.log` 保存了完整浏览器错误。另一次冷启动中单个着色器请求返回 503，独立重试返回 200 且 SHA-256 与资源名相符。
- 修复：使用 DevKit 的项目启动策略 `package.json#forgeax.startupTimeoutMs`，将启动期限设为 120 秒。该设置只延长启动等待。

### 2026-11-06 — 共享出口耗尽了留言板的匿名 API 配额

- 范围：GitHub Pages 公开站点的校园留言。线上浏览器的 Issues 请求返回 403，响应头 `x-ratelimit-remaining: 0`。同一会话的游戏场景已完成 300 帧。
- 修复：Issues 变更触发 Actions 刷新公开快照。玩家优先读取快照，快照尚未生成时仍可用原有 API 读取。
