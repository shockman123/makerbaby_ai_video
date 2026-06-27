# Agnes API 使用指南

> 供其他 Agent 调用 Agnes 生成图像/视频的参考文档

---

## 基本信息

| 配置项 | 值 |
|--------|-----|
| API Key | `sk-0uTsjwkM6ncXmndbaPA87cp5KgkELnIvsjmRqtIk4StkLUqQ` |
| Base URL | `https://apihub.agnes-ai.com/v1/` |

---

## 1. LLM 对话（可选）

**Endpoint:** `https://apihub.agnes-ai.com/v1/chat/completions`

**Model:** `agnes-2.0-flash`（⚠️ 必须全小写）

**示例：**
```bash
curl -X POST "https://apihub.agnes-ai.com/v1/chat/completions" \
  -H "Authorization: Bearer sk-0uTsjwkM6ncXmndbaPA87cp5KgkELnIvsjmRqtIk4StkLUqQ" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-2.0-flash",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

---

## 2. 图生图（推荐用于分镜）

**Endpoint:** `https://apihub.agnes-ai.com/v1/images/generations`

**Model:** `agnes-image-2.1-flash`

### 基础用法

```python
import json, urllib.request

payload = json.dumps({
    "model": "agnes-image-2.1-flash",
    "prompt": "A cinematic scene description in English",
    "size": "1024x768",
    "extra_body": {"response_format": "url"}
}).encode()

req = urllib.request.Request(
    "https://apihub.agnes-ai.com/v1/images/generations",
    data=payload,
    headers={
        "Authorization": "Bearer sk-0uTsjwkM6ncXmndbaPA87cp5KgkELnIvsjmRqtIk4StkLUqQ",
        "Content-Type": "application/json"
    }
)
resp = urllib.request.urlopen(req, timeout=120)
result = json.loads(resp.read())
url = result["data"][0]["url"]
print(url)
```

### 带参考图（图生图 i2i）

当需要保持道具一致性（如产品设计）时，用 base64 编码的参考图：

```python
import base64, json, urllib.request

# 读取本地图片并转为 base64
with open("your_reference_image.png", "rb") as f:
    img_base64 = "data:image/png;base64," + base64.b64encode(f.read()).decode()

payload = json.dumps({
    "model": "agnes-image-2.1-flash",
    "prompt": "Your scene description emphasizing the reference design",
    "size": "1024x768",
    "extra_body": {
        "image": [img_base64],  # 参考图
        "response_format": "url"
    }
}).encode()
```

**参数说明：**
- `prompt`: 英文场景描述
- `size`: `1024x768`（横版）或 `768x1024`（竖版）
- `image[]`: base64 编码的参考图数组（可选，用于 i2i 模式）
- `response_format`: `url`（返回URL）或 `b64_json`（返回base64）

---

## 3. 视频生成

**Endpoint:** `https://apihub.agnes-ai.com/v1/videos`

**Model:** `agnes-video-v2.0`

### 提交任务

```python
import json, urllib.request

payload = json.dumps({
    "model": "agnes-video-v2.0",
    "prompt": "A cinematic movie sequence description. Scene 1: ... Scene 2: ...",
    "extra_body": {
        "image": [
            "https://platform-outputs.agnes-ai.space/images/xxx1.png",
            "https://platform-outputs.agnes-ai.space/images/xxx2.png",
            "https://platform-outputs.agnes-ai.space/images/xxx3.png"
        ],
        "mode": "keyframes"
    },
    "num_frames": 241,   # 10秒 = 241帧（24fps）
    "frame_rate": 24
}).encode()

req = urllib.request.Request(
    "https://apihub.agnes-ai.com/v1/videos",
    data=payload,
    headers={
        "Authorization": "Bearer sk-0uTsjwkM6ncXmndbaPA87cp5KgkELnIvsjmRqtIk4StkLUqQ",
        "Content-Type": "application/json"
    }
)
resp = urllib.request.urlopen(req, timeout=120)
result = json.loads(resp.read())
task_id = result["id"]
print(f"task_id: {task_id}")
```

**返回：**
```json
{
  "id": "task_xxx",
  "status": "queued",
  "video_id": "video_xxx"
}
```

### 查询任务状态

```python
import time, json, urllib.request

task_id = "task_xxx"
while True:
    req = urllib.request.Request(
        f"https://apihub.agnes-ai.com/v1/videos/{task_id}",
        headers={"Authorization": "Bearer sk-0uTsjwkM6ncXmndbaPA87cp5KgkELnIvsjmRqtIk4StkLUqQ"}
    )
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read())
    
    status = result["status"]
    progress = result.get("progress", 0)
    print(f"Status: {status}, Progress: {progress}%")
    
    if status == "completed":
        video_url = result["remixed_from_video_id"]
        print(f"Video URL: {video_url}")
        break
    elif status == "failed":
        print(f"Error: {result.get('error')}")
        break
    
    time.sleep(60)  # 约每分钟轮询一次
```

**任务状态：**
- `queued`: 排队中
- `in_progress`: 生成中
- `completed`: 完成
- `failed`: 失败

### 下载视频

```bash
curl -L -o output.mp4 "https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/2026/06/18/video_xxx.mp4"
```

---

## 4. 音视频合成（使用 FFmpeg）

### 配音 + 原声混合

```bash
# 混合原视频声音 + 新配音
ffmpeg -y -i video.mp4 -i voiceover.mp3 \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[outa]" \
  -map 0:v -map "[outa]" \
  -c:v copy -c:a aac -b:a 192k output_with_voice.mp4
```

### 添加 Logo

```bash
# Logo 放右上角（120px宽）
ffmpeg -y -i video_with_voice.mp4 -i logo.png \
  -filter_complex "[1:v]scale=120:-1[logo];[0:v][logo]overlay=W-w-20:20[outv]" \
  -map "[outv]" -map 0:a \
  -c:v libx264 -preset fast -crf 23 -c:a copy final_output.mp4
```

### 语音合成（TTS）

```bash
# 使用 edge-tts 生成中文配音
edge-tts --voice zh-CN-YunjianNeural --text "你的文案内容" --write-media voiceover.mp3
```

**可选声音：**
- `zh-CN-YunjianNeural`（云健磁性男声）
- `zh-CN-XiaoxiaoNeural`（云夏活力女声）
- `zh-CN-YunxiNeural`（云希知性男声）

---

## 5. 工作流程总结

```
1. 策划分镜 → 写好5个场景描述（中文 + 英文prompt）

2. 图生图 → 生成5张分镜图，返回URL
   - 普通分镜：直接生成
   - 需要道具一致性：用 base64 参考图 i2i

3. 下载图片 → curl -L -o scene1.png "URL"

4. 视频生成 → 提交任务，获得 task_id

5. 轮询状态 → 约5-8分钟完成

6. 下载视频 → curl -L -o video.mp4 "URL"

7. 配音合成 → edge-tts 生成 mp3

8. 音视频合成 → FFmpeg 混合音频 + 添加Logo

9. 最终输出 → final_output.mp4
```

---

## 常见问题

**Q: 视频生成需要多久？**
A: 通常 5-8 分钟，取决于服务器负载。

**Q: 模型名报错 503？**
A: 检查模型名是否全小写，如 `agnes-2.0-flash`，不是 `Agnes-2.0-Flash`。

**Q: 如何保持分镜间道具一致？**
A: 使用参考图的 i2i 模式，将道具图片 base64 编码后传入 `image` 字段。

**Q: 视频没有声音？**
A: 视频API默认有BGM，需要叠加配音时用 `amix` 混合，不要覆盖原音轨。

---

## 文件路径

- 用户桌面：`C:\Users\65105\Desktop\agnes_api_guide.md`
- 工作目录：`C:\Users\65105\Desktop\agnes\media\`
- API Key 存储：`C:\Users\65105\Desktop\agnes\MEMORY.md`
