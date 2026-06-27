# 创客宝贝 AI Video

基于 Agnes 和千问（Qwen）的 AI 视频生成工作流工具。通过可视化节点编辑器，串联图片生成、视频生成、视频编辑等环节，快速创建 AI 视频内容。

## 环境要求

- **Python 3.8+**
- **FFmpeg**（已内置）：`tools/ffmpeg/` 中已附带 ffmpeg.exe 和 ffprobe.exe，程序自动检测使用，无需手动安装或配置环境变量。
  - 如果你的系统已安装 ffmpeg 并加入 PATH，程序会优先使用项目自带的版本。
  - 如需自行下载：https://www.gyan.dev/ffmpeg/builds/ （选 essentials 版本，解压后放到 `tools/ffmpeg/` 即可）

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务
python app.py

# 3. 打开浏览器访问
#    http://127.0.0.1:5000
```

## 配置 API Key

首次打开网页后，在登录界面输入：

- **Agnes API Key**：从 https://agnes-ai.com 获取
- **千问 API Key**（可选）：从阿里云百炼平台获取，用于千问视频/图像生成

API Key 保存在浏览器 localStorage 中，不会上传到服务器。

## 功能说明

- **图像生成**：支持 Agnes 和千问（wan2.7-image-pro、qwen-image-2.0 等）多模型文生图/图生图
- **视频生成**：支持 Agnes 和千问（wan2.7-i2v、wan2.7-t2v、happyhorse 系列等）多模型图生视频/文生视频
- **视频编辑**：千问 wan2.7-videoedit 等模型，对已有视频进行风格转换
- **工作流编辑器**：可视化节点拖拽，连接资产和生成节点
- **资产管理**：自动保存生成的图片和视频，支持手动上传
- **任务历史**：记录所有生成任务的 ID、模型、状态

## 目录结构

```
MakerBaby-AI-Video/
├── app.py              # 后端主程序
├── requirements.txt    # Python 依赖
├── README.md
├── static/             # 前端文件
│   ├── index.html
│   ├── favicon.png
│   ├── logo.png
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── tools/
│   └── ffmpeg/          # ffmpeg.exe + ffprobe.exe（192MB，已附带）
├── assets/             # 生成的图片/视频（自动创建）
└── workflows/          # 保存的工作流（自动创建）
```

## 常见问题

**Q: ffmpeg 相关问题？**
A: 项目已在 `tools/ffmpeg/` 中附带 ffmpeg，程序会自动使用。如果报错找不到 ffmpeg，检查该目录下的 exe 文件是否完整。

**Q: 视频生成一直排队？**
A: 免费额度有排队机制，高峰期可能需要等待。也可以切换不同模型尝试。

**Q: 浏览器页面没有更新？**
A: 使用 Ctrl+F5 强制刷新浏览器缓存。
