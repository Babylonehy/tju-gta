# 北洋漫梗 · Beiyang Field Notes

天津大学北洋园校区的 ForgeAX 3D 校园沙盘。附件的全校 OSM2World 场景是主地图，东门、中心岛、南门和北区田径场在同一米制坐标系里。楼宇、道路和水系采用源模型，停车场与球场边界补自 OSM。详见[位置和材质来源](docs/location-sources.md)与[人物资产来源](docs/character-assets.md)。

| 操作 | 玩法 |
| --- | --- |
| WASD 或方向键、拖动、Shift、Space | 移动、转动视角、冲刺、跳跃。冲刺消耗体力，步行或休息时恢复。触屏可用方向按钮与滑动。 |
| M、R | 打开地图、返回东门。地图的「楼栋」可按名称或编号搜索并查看楼内模拟人数。选「设为目的地」后角色自动步行。校外出发会先到东门等待核验。方向键或 WASD 可接管。入校后仍可快速前往地标。 |
| F、V | 在单车点按 F 模拟扫码借还单车或电动助力车。靠近停放的可用汽车时按 V 借用，再按 V 归还。 |
| C | 在男学生和女学生之间切换。当前载具、位置、体力与科研进度共用。 |
| E、J | 东门北侧人行通道模拟人脸核验、驿站取件、调查附近彩蛋或玩家藏梗。发现收进漫游手记。 |
| T | 调整游戏时间。天空、太阳、环境光和部分地标路灯会随时段变化。 |
| 1、2、3、Q | 空手、装备铲子、装备冲击枪、使用当前工具。挖土和命中会消耗体力。东门岗亭外壳和几处器材是可破坏目标。 |
| K | 查看 55 教的计算机科研。路径规划需要到访桥、停车场与田径场。实时光照需要记录昼夜。碰撞模拟需要挖土和做冲击测试。到 55 教提交后解锁对应奖励。 |
| G | 在当前位置留言，或靠近用铲子挖出的土坑藏梗。梗必须写明与天津大学的联系。其他玩家走近后按 E 发现。 |

东门保留两条分别进、出的机动车道，模拟人脸闸机在车道北侧，车道之间是「世纪之门」纪年碑组。32 教西侧门洞可沿中轴步道穿过。宣怀广场包含北洋纪念亭与北洋厅标识。校园人数和在楼人数随游戏时段变化，地图附近显示部分步行人群。东门核验和单车扫码只发生在游戏里。地图沿用北、南两个虚拟驿站。内置彩蛋包括天大校史和景观，也解释用在北洋园语境里的网络梗。浏览器保存取件、发现、科研进度、土坑、破坏状态和时间。

共享留言和照片通过公开仓库的 GitHub Issues 发布。G 打开游戏内发布表单后，登录 GitHub，把图片拖入编辑器并提交，保留预填标题里的地图坐标。返回游戏刷新，访客无需登录即可浏览。藏梗的游戏内发现有距离条件，GitHub Issue 与附件仍公开。维护者可以关闭 Issue 移除内容。

## 部署到 GitHub Pages

1. 将项目推送到 **公开 GitHub 仓库**。在仓库 **Settings → General → Features** 中打开 **Issues**。
2. 进入 **Settings → Pages**，将 **Source** 设为 **GitHub Actions**。
3. 推送默认分支，或在 **Actions → Deploy 北洋漫梗 to GitHub Pages** 手动运行。工作流会构建 ForgeAX 静态站，自动设置 Pages 子路径并绑定当前仓库的 Issues。部署结果页给出访问地址，无需服务器、Token 或数据库。

留言板读取最近最多 100 条符合格式的开放 Issues（最多扫描最近 300 条开放 Issue/PR），每三分钟同步一次，也可以手动刷新。如果 GitHub API 达到速率限制，稍后再试。发布与回复通过 GitHub 完成。账号、内容和附件权限由 GitHub 管理。

参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[GitHub 预填 Issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue)、[图片附件](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)。

## 本地运行

需要 Node.js 22、pnpm 12.10.1，建议用支持 WebGPU 的新版 Chrome 或 Edge。启动后用终端输出的 HTTP 地址打开，不要直接打开 HTML 文件。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm preview
```

本地 ForgeAX Preview 未配置共享仓库时，可以试用示例并保存当前浏览器内的留言和藏梗。要生成与 Pages 一样的静态目录，可以运行 `PAGES_BASE=/仓库名 GITHUB_REPOSITORY=账号/仓库名 node scripts/build-pages.mjs`，结果在 `dist-pages/`，需按相同子路径通过 HTTP(S) 提供。
