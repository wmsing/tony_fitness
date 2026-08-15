# 健身拳击小游戏

对着摄像头挥拳或甩头砸角落怪物，活动手臂和颈部，顺便找点乐子。

## 怎么玩

1. 站在镜头前，让**上半身**入镜  
2. 屏幕某个角落会出现**较大**的怪物（先从**右上**开始），头顶有血条  
3. 朝那个方向**快速挥拳**，或用头：**左右甩头躲闪** / **点头冲击**（慢速不算；靠镜头玩也可以）  
4. 击中会明显闪红、抖一下并飘字扣血；打满血条击杀，怪物换到下一个角落（右上 → 左上 → 右下 → 左下）

绿点 / 绿拳套 = 左手，蓝点 / 蓝拳套 = 右手，黄点 / 「头」= 鼻子位置（地图背景模式显示卡通拳套 + 头部标记）。

## 本地启动（必须用 localhost）

摄像头在浏览器里需要安全环境，**不要**直接双击用 `file://` 打开。

```bash
cd /Users/wmsing/Documents/tony_fitness
npx --yes serve .
```

终端里会给出地址（一般是 `http://localhost:3000`），用 Chrome / Edge / Safari 打开即可。

首次进入点「开始运动」，允许摄像头权限。

## 技术说明

- 纯静态网页：`index.html` / `styles.css` / `app.js`
- [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)（CDN）跟踪双手腕与鼻尖
- 命中条件：手腕或头部**从怪物区域外快速进入区域内**（区域内停留或慢晃不算）+ 短冷却，减少误触；头部额外识别左右甩头与点头

## 素材致谢

敌人使用 [Tiny Swords (Free Pack)](https://pixelfrog-assets.itch.io/tiny-swords) 单位精灵图。  
PNG 已解压到 `assets/enemy/tiny-swords/`。四角：Warrior / Archer / Pawn / Monk — 平时 Idle，被击中时播放 Attack（Pawn 挥斧、Monk 为 Heal）。

## 键位 / 操作

无需键盘。用双手挥拳，或甩头 / 点头砸向提示的角落即可。

- **打开 / 关闭摄像头**：单独开关镜头（关闭会停止游戏并释放摄像头）
- **地图背景 / 显示画面**：默认全屏 Tiny Swords 草地地图（顶栏/底栏半透明叠在草地上；摄像头仍识别）；可切回真实画面
- 击中时播放 `assets/sound/punch.wav`
- **开始运动 / 暂停**：开始或暂停砸怪；开始时底部居中小播放器随机播放 YouTube 播放列表（默认[这张列表](https://www.youtube.com/watch?v=MbD7TAlBFDc&list=PLGE-oAi0TRbtlX5kvtO415sergiyGEyUp)）。右上角「播放列表」点开可粘贴新链接或 ID；选择会记在本机。暂停游戏或关闭摄像头时音乐继续播（可用播放器手动停）
