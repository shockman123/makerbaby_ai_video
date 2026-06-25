# 创客宝贝 AI Video 工作流
<img width="2112" height="1374" alt="image" src="https://github.com/user-attachments/assets/2a1f468f-d3c1-4468-9e2d-9c7a00f8c069" />


基于 Agnes 和千问（Qwen）AI 的可视化视频工作流工具，支持图片生成、视频生成、视频编辑等功能。

## ✨ 功能特性

### 🎬 视频生成
- **多平台支持**：
  - **Agnes Video**：高质量视频生成，支持关键帧控制
  - **千问（Qwen）视频**：阿里云通义万相视频生成
    - `wan2.7-i2v-2026-04-25` - 万相 2.7 图生视频
    - `happyhorse-1.1-i2v` - HAPPYHORSE 1.1 图生视频
    - `wan2.7-r2v` - 万相 2.7 参考图生视频
    - `happyhorse-1.1-r2v` - HAPPYHORSE 1.1 参考图生视频
    - `happyhorse-1.0-r2v` - HAPPYHORSE 1.0 参考图生视频
- **智能轮询**：自动查询任务状态，支持刷新页面恢复查询
- **任务管理**：可取消进行中的千问任务，避免扣费

### 🖼️ 图像生成
- **Agnes Image**：基于 Agnes 平台的图像生成
- **千问图像模型**：
  - `wan2.7-image-pro` - 万相 2.7 图片专业版
  - `qwen-image-2.0-pro-2026-04-22` - 千问图像 2.0 专业版

### ✂️ 视频编辑
- 视频裁剪（开始/结束时间）
- 添加字幕（支持自定义语速和音色）
- 多段 TTS 音频混合
- FFmpeg 强大的视频处理能力

### 📁 资产管理
- 本地资产库（图片/视频）
- 支持上传本地素材
- 自动清理无效资产
- 一键删除（无浏览器确认弹窗）

## 🚀 快速开始

### 环境要求
- Python 3.8+
- FFmpeg（用于视频处理）

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/your-username/创客宝贝-AI-Video-工作流.git
cd 创客宝贝-AI-Video-工作流
```

2. **安装依赖**
```bash
pip install -r requirements.txt
```

3. **运行服务**
```bash
python app.py
```

4. **访问应用**
打开浏览器访问 `http://localhost:5000`

### 配置 API Keys

1. **Agnes API Key**：登录界面输入 Agnes API Key
2. **千问 API Key**：点击右下角"🔑 千问密钥"按钮，输入阿里云百炼 API Key

## 📖 使用说明

### 工作流节点类型

1. **资产节点** - 显示资产库中的图片/视频
2. **文生图节点** - 输入提示词生成图片
3. **视频生成节点** - 连接资产作为关键帧，生成视频
4. **视频编辑节点** - 裁剪视频、添加字幕、TTS 配音

### 关键帧使用
- 视频生成节点支持连接多个资产作为关键帧
- i2v 模型仅使用首帧；r2v 模型可使用多张参考图

## 🛠️ 技术栈

- **后端**：Flask + Python
- **前端**：原生 JavaScript + HTML5 Canvas
- **视频处理**：FFmpeg
- **AI 平台**：Agnes API + 阿里云百炼（DashScope）

## 📝 项目结构

```
├── app.py                  # Flask 后端主程序
├── requirements.txt        # Python 依赖
├── static/
│   ├── index.html          # 前端入口
│   ├── css/style.css       # 样式文件
│   ├── js/app.js           # 前端逻辑
│   ├── favicon.png         # 浏览器图标
│   └── logo.png            # 项目 Logo
└── assets/                 # 本地资产目录（不包含在仓库中）
```

## ⚠️ 注意事项

- 千问 API 调用需要阿里云百炼账户，参考图生视频（r2v）模型免费额度有限
- Agnes API 也需要相应账户和额度
- 视频生成通常需要较长时间，请耐心等待

## 📄 License

MIT License
