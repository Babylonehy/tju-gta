# 北洋园沙盘的位置与素材来源

主场景采用用户提供的 `北洋园校园地图_单文件.zip` 中的全校 `Beiyangyuan_OSM_Campus_Compact.glb`。源模型由 OSM2World 0.4.0 生成并在 Blender 整理。原点为 WGS84 东经 117.3058°、北纬 38.9969°，X 向东，Y 向上，Z 向南，单位为米。[OpenStreetMap 版权与许可](https://www.openstreetmap.org/copyright)

[全校 GLB](../assets/osm-campus/beiyang-campus.glb)、[可行走面与障碍物](../assets/osm-campus/layout.json)与游戏地图使用同一份几何。补充的停车场、操场、球场和地标定位来自 [OSM 区域数据](https://api.openstreetmap.org/api/0.6/map?bbox=117.2920,38.9875,117.3195,39.0065)。楼宇位置和水系也参考了用户提供的[高德地图截图入口](https://www.amap.com/ssr/search)与[天津大学北洋园校区文化导览图](https://news.tju.edu.cn/info/1533/609789.htm)。

| 地物 | 定位与模型范围 |
| --- | --- |
| 东门与岗亭 | 入口参考 OSM 节点 5140668915 和 7932755107。岗亭外壳采用 OSM 轮廓 528929232，机动车进出按 OSM 路段 918137130 和 918137132 分流。三条模拟核验闸机设在北侧独立步道。东门中央的十二方碑参考实景重建。北门和南门用 OSM 点位，东北门和东南门根据示意图标注。[北洋园校门](https://wiki.tjubot.cn/campus-infrastructure/gates-peiyang) |
| 32 教与宣怀广场 | 保留南北两环与西侧中轴的原坐标，给西侧环墙开通步行洞口。广场用校方报道中的五边形北洋纪念亭、盛宣怀坐像和地灯作参照。北洋厅使用游戏标识位置。[校方报道](https://news.tju.edu.cn/info/1003/158779.htm) · [32 教介绍](https://wiki.tjubot.cn/classrooms/32nd-teaching-building-peiyang) |
| 中心岛 | 保留 44 教、47 教静算楼、郑东图书馆、三问桥及其源模型坐标。海棠沿中心岛北岸等区域布置。青年湖中的鸟群在水面内游动。[海棠分布](https://news.tju.edu.cn/info/1002/339019.htm) · [湖中鸟群](https://news.tju.edu.cn/info/1533/547559.htm) |
| 55 教 | 保持 OSM 528933946 的 U 形轮廓，依据用户提供的南向照片重建主楼与两翼高差、玻璃门厅、窗洞与前庭。立面尺寸与景观细节按照片估算。计算机科研交互放在南侧前庭。[智能与计算学部](https://cs.tju.edu.cn/) · [校方楼层平面](https://oaa.tju.edu.cn/download/by.pdf) |
| 菜鸟驿站 | 南区使用 OSM 节点 11230506035。北区按用户的地图截图参考定位，取件入口在附近的可通行处。 |
| 南门停车场 | 使用 OSM 面 528929230。停车线、通行空间和可借车辆按轮廓布置。 |
| 北区田径场与南区体育公园 | 使用 OSM 面 528929259、528929993、529020685 与已标注球场面。道线、边线和球门为按轮廓推导的细节。[天津大学南区体育公园](https://tyb.tju.edu.cn/info/1030/1422.htm) |

楼栋图层包含 112 个屋面标记，95 个标记有来源可查的名称。每栋分配稳定的 B 系列沙盘编号。已知教学楼号或宿舍斋号时一起显示，其余名称待核。名称来自 OSM 与校方导览，标签锚点从同一份模型屋面取得。[校方导览](https://news.tju.edu.cn/info/1533/609789.htm) · [教学楼总图](https://oaa.tju.edu.cn/download/by.pdf)

源文件的建筑底面、道路和桥接位置用于游戏，楼高、立面细节、停车标线和场地内饰有估算。校方全景入口本轮访问报错，未用街景逐栋核对。路面、草地、外墙使用 CC0 PBR 材质近似，保留附件里其余通用材质。[全景天大](https://vr.tju.edu.cn/t/7a9c6a1aad2ce727) · [Poly Haven 沥青](https://polyhaven.com/a/asphalt_02) · [混凝土](https://polyhaven.com/a/concrete_wall_009) · [跑道法线参考](https://polyhaven.com/a/asphalt_track) · [草地](https://polyhaven.com/a/leafy_grass) · [红砖](https://polyhaven.com/a/red_bricks_04) · [OSM2World 默认样式](https://github.com/tordanik/OSM2World-default-style)

新帖子以 `OSM1` 保存米制坐标。旧 `AMAP1` 帖子用截图锚点近似配准，原 Issue 内容与编号保持原样。校园模型和地理数据保留 OpenStreetMap 署名，地图数据适用 ODbL 1.0。[OpenStreetMap 版权与许可](https://www.openstreetmap.org/copyright)

共享单车和助力车使用游戏内原创模型，分别采用带车篮的单车和低跨、带电池与脚踏板的助力车型。用户提供的两个预览页面均返回访问验证页。[共享单车参考](https://www.3d66.com/relations/4x5EN9.html) · [共享电动车参考](https://www.3d66.com/relations/Ql5xlR.html)

## 重建

在 `--materials` 指定目录下放置 `asphalt_02`、`asphalt_track`、`concrete_wall_009`、`leafy_grass` 和 `red-bricks-04` 五个素材目录，各包含脚本读取的 Diffuse、Normal GL、AO/Rough/Metal JPG。脚本从现有的 `survey.json` 读补充轮廓。原始附件和下载素材可以放在 `.assetlib/downloads/osm-campus/`。

```sh
python3 scripts/build-osm-campus.py /path/to/Beiyangyuan_OSM_Campus_Compact.glb --materials /path/to/materials
python3 scripts/build-building-labels.py /path/to/region.osm
pnpm exec forgeax asset import --path assets/osm-campus/beiyang-campus.glb --json
pnpm exec forgeax asset verify --json
```
