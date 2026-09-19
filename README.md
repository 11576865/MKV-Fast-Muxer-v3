# MKV Fast Muxer v3

一个在浏览器本地运行的 MKV 快捷自动封包工具。

它把视频、ASS 字幕和 TTF/OTF 字体封装进 MKV 容器，视频与音频保持 `copy`，不重新编码。

## 功能

- 支持 MP4 / MKV / WebM / MOV / M4V 输入视频
- ASS 作为软字幕封装
- TTF / OTF 作为字体附件封装
- 视频、音频使用 stream copy，不重新编码
- 全程在浏览器本地处理，不上传媒体文件
- 使用 ffmpeg.wasm，可在 Android 浏览器 / Termux + Vite 环境中运行

## v3 主要改动

v3 处理了 Android/Termux + Vite 下 ffmpeg.wasm 的 Worker 加载问题。

`vite.config.js` 排除了 `@ffmpeg/ffmpeg` 与 `@ffmpeg/util` 的依赖预打包；安装依赖时，`scripts/copy-core.mjs` 会把 ffmpeg.wasm core 和 class worker 复制到 `public/`，供浏览器从本站静态加载。

## 本地运行

需要 Node.js 与 npm。

```bash
npm install
npm run dev -- --host 127.0.0.1
```

然后打开终端显示的本地地址，通常为：

```text
http://127.0.0.1:5173/
```

## 构建

```bash
npm run build
```

构建结果位于 `dist/`。

## GitHub Pages

仓库内包含 `.github/workflows/deploy-pages.yml`。启用 GitHub Pages，并将 Source 设为 **GitHub Actions** 后，每次向 `main` 分支推送都会自动构建并部署。

## 技术说明

封装时核心参数相当于：

```text
-c copy
```

因此媒体流不会因为封装过程被再次压缩。字幕与字体作为 MKV 内部轨道/附件加入。

浏览器版 ffmpeg.wasm 需要把输入文件完整载入浏览器可用内存，因此超大视频的实际可处理上限受设备内存和浏览器限制。

## 许可证

本仓库原创代码采用 [MIT License](./LICENSE)。

项目使用/分发的第三方组件仍按各自许可证授权，其中：

- `@ffmpeg/ffmpeg` 0.12.15 — MIT
- `@ffmpeg/util` 0.12.2 — MIT
- `@ffmpeg/core` 0.12.10 — GPL-2.0-or-later

详细说明见 [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md)。

