# 健身拳击小游戏

对着摄像头挥拳砸角落怪物，活动手臂，顺便找点乐子。

## 怎么玩

1. 站在镜头前，让**上半身**入镜  
2. 屏幕某个角落会出现怪物（先从**右上**开始）  
3. 朝那个方向**快速挥拳**（慢伸手不算）  
4. 击中会扣血；打满血条击杀，怪物换到下一个角落（右上 → 左上 → 右下 → 左下）

绿点 = 左手腕，蓝点 = 右手腕。

## 本地启动（必须用 localhost）

摄像头在浏览器里需要安全环境，**不要**直接双击用 `file://` 打开。

```bash
cd /Users/wmsing/Documents/sakuga-fighter
npx --yes serve .
```

终端里会给出地址（一般是 `http://localhost:3000`），用 Chrome / Edge / Safari 打开即可。

首次进入点「开始运动」，允许摄像头权限。

## 技术说明

- 纯静态网页：`index.html` / `styles.css` / `app.js`
- [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)（CDN）跟踪双手腕
- 命中条件：手腕进入怪物区域 **且** 移动速度够快 + 短冷却，减少误触

## 键位 / 操作

无需键盘。用双手挥向提示的角落即可。

- **打开 / 关闭摄像头**：单独开关镜头（关闭会停止游戏并释放摄像头）
- **开始运动 / 暂停**：开始或暂停砸怪
