# 人物模型与动作

`assets/characters/beiyang-student.glb`、`beiyang-student-female.glb` 和 `beiyang-guard.glb` 来自 [CharacterCreator](https://github.com/kblood/CharacterCreator) 的自定义角色导出。按其[导出许可说明](https://github.com/kblood/CharacterCreator/blob/master/LICENSE-NOTES.md)，输出模型、网格和贴图为 CC0；基础人物来自 [MakeHuman 的 CC0 基础资产](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md)。这三个形象是虚构校园人物。角色生成器本身不打包进游戏。

人物包含皮肤、头发、服装和鞋的材质及骨骼动画。学生的步行、奔跑、起跳、下落和待机来自角色导出；`scripts/pose-rider.mjs` 根据本游戏车把和脚踏的位置制作普通单车与电动助力车的坐姿。该脚本还为 GLB 内部贴图和采样器命名，并合并共用骨架的网格，保留各部件材质。

重做时，从生成器导出使用 Unreal 命名骨架的 GLB，包含所需动画并启用原地移动。对每个学生运行 `node scripts/pose-rider.mjs 原始学生.glb assets/characters/beiyang-student.glb`，对门卫用同一命令并加 `--name-only`。保留 `*.glb.meta.json`，通过 ForgeAX 重新导入；`assets/characters/rig-refs.ts` 引用其中场景与动作的 GUID。通常无需重做模型，构建直接使用仓库内的三个 GLB。

男女学生各自带有动作片段。访客与步行 NPC 分别使用两位学生。切换时互换角色的场景父节点，沿用各自角色职责的动作时间，角色选项保存在浏览器。
