\# Agnes-Video-V2.0 API 接入指南





\## 概述





Agnes-Video-V2.0 是一款面向生产环境的视频生成模型，支持 \*\*文生视频\*\*、\*\*图生视频\*\*、\*\*多图视频生成\*\* 和 \*\*关键帧动画\*\* 工作流。





开发者可以通过文本提示词、图片 URL 或多张参考图片生成高质量视频。该模型适用于故事创作、营销视频、产品演示、社交媒体内容、App 动态素材以及 AI 创意工作流。





Agnes-Video-V2.0 采用异步任务式 API。你需要先创建视频生成任务，然后使用返回的 `video\_id` 或 `task\_id` 查询视频结果。





\---





\## 支持能力





| 能力     | 说明                    |

| ------ | --------------------- |

| 文生视频   | 根据文本提示词直接生成视频         |

| 图生视频   | 将静态图片动画化为动态视频         |

| 多图视频生成 | 使用多张参考图片指导视频生成        |

| 关键帧动画  | 在多个关键帧之间生成平滑过渡        |

| 场景运动控制 | 通过提示词控制主体动作、镜头运动和场景动态 |

| 视觉一致性  | 在多帧之间保持主体、风格和场景一致     |

| 电影级输出  | 生成高质量电影级视频            |

| 异步 API | 先提交任务，再查询生成结果         |





\---





\## 适用场景





| 场景          | 示例                       |

| ----------- | ------------------------ |

| 故事创作        | 短片、角色场景、叙事片段             |

| 营销视频        | 产品广告、活动视频、推广内容           |

| 社交媒体内容      | Reels、Shorts、TikTok 风格视频 |

| 图像动画化       | 动画化人像、产品、角色或场景           |

| 产品演示        | 根据文本或图像生成产品展示视频          |

| 关键帧过渡       | 在不同视觉状态之间生成平滑转场          |

| 游戏 / App 素材 | 为数字产品生成动态视觉素材            |

| 沉浸式内容       | 生成电影级 AI 场景和氛围视频         |





\---





\## 准备工作





开始接入前，请确保你已经具备以下条件：



1\. 已获得有效的 Agnes AI API Key。

2\. 当前网络环境可以访问 Agnes AI API Gateway。

3\. 已确认模型名称：`agnes-video-v2.0`。

4\. 已准备好视频生成所需的文本提示词。

5\. 如需使用图生视频、多图视频或关键帧动画，请准备可公网访问的图片 URL。



\---





\## API Endpoints





\### 创建视频任务





| 项目             | 说明                                    |

| -------------- | ------------------------------------- |

| Endpoint       | https://apihub.agnes-ai.com/v1/videos |

| Method         | POST                                  |

| Content-Type   | application/json                      |

| Authentication | Bearer Token                          |

| Header         | Authorization: Bearer YOUR\_API\_KEY    |





\---





\### 查询视频结果：推荐方式





创建视频任务后，响应中会返回 `video\_id`。





推荐使用 `video\_id` 查询视频结果。





| 项目             | 说明                                                       |

| -------------- | -------------------------------------------------------- |

| Endpoint       | https://apihub.agnes-ai.com/agnesapi?video\_id=<VIDEO\_ID> |

| Method         | GET                                                      |

| Authentication | Bearer Token                                             |

| Header         | Authorization: Bearer YOUR\_API\_KEY                       |





\---





\### 查询视频结果：兼容旧方式





旧版任务查询接口仍然支持，用于兼容已有接入逻辑。





| 项目             | 说明                                              |

| -------------- | ----------------------------------------------- |

| Endpoint       | https://apihub.agnes-ai.com/v1/videos/{task\_id} |

| Method         | GET                                             |

| Authentication | Bearer Token                                    |

| Header         | Authorization: Bearer YOUR\_API\_KEY              |





\---





\## 请求参数





\### 创建视频任务参数





| 参数                  | 类型             | 是否必填 | 说明                         |

| ------------------- | -------------- | ---- | -------------------------- |

| model               | string         | 是    | 模型名称，使用 agnes-video-v2.0   |

| prompt              | string         | 是    | 视频内容的文本描述                  |

| image               | string / array | 否    | 图片 URL 或图片 URL 数组          |

| mode                | string         | 否    | 生成模式，例如 ti2vid 或 keyframes |

| height              | integer        | 否    | 视频高度，默认值为 768              |

| width               | integer        | 否    | 视频宽度，默认值为 1152             |

| num\_frames          | integer        | 否    | 视频帧数，必须 ≤ 441，且满足 8n + 1   |

| frame\_rate          | number         | 否    | 视频 FPS，支持范围为 1–60          |

| num\_inference\_steps | integer        | 否    | 推理步数                       |

| seed                | integer        | 否    | 随机种子，用于保证结果可复现             |

| negative\_prompt     | string         | 否    | 负向提示词，用于描述需要避免的内容          |

| extra\_body.image    | array          | 否    | 多图视频或关键帧模式中的输入图片 URL       |

| extra\_body.mode     | string         | 否    | 额外模式设置，例如 keyframes        |





\---





\## 创建视频任务





\### 示例 1：文生视频





用于直接根据文本提示词生成视频。





```bash

curl -X POST https://apihub.agnes-ai.com/v1/videos \\

&#x20; -H "Authorization: Bearer YOUR\_API\_KEY" \\

&#x20; -H "Content-Type: application/json" \\

&#x20; -d '{

&#x20;   "model": "agnes-video-v2.0",

&#x20;   "prompt": "A cinematic shot of a cat walking on the beach at sunset, soft ocean waves, warm golden lighting, realistic motion",

&#x20;   "height": 768,

&#x20;   "width": 1152,

&#x20;   "num\_frames": 121,

&#x20;   "frame\_rate": 24

&#x20; }'

```





\---





\### 示例 2：图生视频





用于将单张图片动画化。





```bash

curl -X POST https://apihub.agnes-ai.com/v1/videos \\

&#x20; -H "Authorization: Bearer YOUR\_API\_KEY" \\

&#x20; -H "Content-Type: application/json" \\

&#x20; -d '{

&#x20;   "model": "agnes-video-v2.0",

&#x20;   "prompt": "The woman slowly turns around and looks back at the camera, natural facial expression, cinematic camera movement",

&#x20;   "image": "https://example.com/image.png",

&#x20;   "num\_frames": 121,

&#x20;   "frame\_rate": 24

&#x20; }'

```





\---





\### 示例 3：多图视频生成





用于通过多张输入图片指导视频生成。





```bash

curl -X POST https://apihub.agnes-ai.com/v1/videos \\

&#x20; -H "Authorization: Bearer YOUR\_API\_KEY" \\

&#x20; -H "Content-Type: application/json" \\

&#x20; -d '{

&#x20;   "model": "agnes-video-v2.0",

&#x20;   "prompt": "Create a smooth transformation scene between the two reference images, cinematic lighting, consistent character identity, natural motion",

&#x20;   "extra\_body": {

&#x20;     "image": \[

&#x20;       "https://example.com/image1.png",

&#x20;       "https://example.com/image2.png"

&#x20;     ]

&#x20;   },

&#x20;   "num\_frames": 121,

&#x20;   "frame\_rate": 24

&#x20; }'

```





\---





\### 示例 4：关键帧动画





用于在多个关键帧之间生成平滑动画。





```bash

curl -X POST https://apihub.agnes-ai.com/v1/videos \\

&#x20; -H "Authorization: Bearer YOUR\_API\_KEY" \\

&#x20; -H "Content-Type: application/json" \\

&#x20; -d '{

&#x20;   "model": "agnes-video-v2.0",

&#x20;   "prompt": "Generate a smooth cinematic transition between the keyframes, maintaining visual consistency and natural camera movement",

&#x20;   "extra\_body": {

&#x20;     "image": \[

&#x20;       "https://example.com/keyframe1.png",

&#x20;       "https://example.com/keyframe2.png"

&#x20;     ],

&#x20;     "mode": "keyframes"

&#x20;   },

&#x20;   "num\_frames": 121,

&#x20;   "frame\_rate": 24

&#x20; }'

```





\---





\## 创建任务响应





视频任务创建成功后，API 会返回任务信息。





响应中会同时包含 `task\_id` 和 `video\_id`。





其中，`video\_id` 是推荐用于查询视频结果的 ID。





```json

{

&#x20; "id": "task\_YOUR\_TASK\_ID",

&#x20; "task\_id": "task\_YOUR\_TASK\_ID",

&#x20; "video\_id": "video\_YOUR\_VIDEO\_ID",

&#x20; "object": "video",

&#x20; "model": "agnes-video-v2.0",

&#x20; "status": "queued",

&#x20; "progress": 0,

&#x20; "created\_at": 1780457477,

&#x20; "seconds": "10.0",

&#x20; "size": "1280x768"

}

```





\### 响应字段说明





| 字段         | 类型      | 说明               |

| ---------- | ------- | ---------------- |

| id         | string  | 任务 ID，可用于旧版查询接口  |

| task\_id    | string  | 任务 ID，作用与 id 相同  |

| video\_id   | string  | 视频 ID，推荐用于查询视频结果 |

| object     | string  | 对象类型，通常为 video   |

| model      | string  | 当前任务使用的模型        |

| status     | string  | 当前任务状态           |

| progress   | integer | 当前任务进度百分比        |

| created\_at | integer | 任务创建时间戳          |

| seconds    | string  | 视频时长，单位为秒        |

| size       | string  | 视频分辨率            |





\---





\## 查询视频结果





\### 推荐方式：使用 `video\_id` 查询





创建视频任务后，使用返回的 `video\_id` 查询视频结果。建议轮询间隔5s。





```bash

curl --location --request GET 'https://apihub.agnes-ai.com/agnesapi?video\_id=<VIDEO\_ID>' \\

&#x20; --header 'Authorization: Bearer <API\_KEY>'

```





示例：





```bash

curl --location --request GET 'https://apihub.agnes-ai.com/agnesapi?video\_id=video\_xxxxxx' \\

&#x20; --header 'Authorization: Bearer <API\_KEY>'

```





\---





\### 可选参数：`model\_name`





查询视频结果时，也可以传入 `model\_name` 显式指定模型名。





```bash

curl --location --request GET 'https://apihub.agnes-ai.com/agnesapi?video\_id=<VIDEO\_ID>\&model\_name=<MODEL>' \\

&#x20; --header 'Authorization: Bearer <API\_KEY>'

```





示例：





```bash

curl --location --request GET 'https://apihub.agnes-ai.com/agnesapi?video\_id=video\_xxxxxx\&model\_name=agnes-video-v2.0' \\

&#x20; --header 'Authorization: Bearer <API\_KEY>'

```





\---





\### 兼容方式：使用 `task\_id` 查询





为了兼容旧版本，仍然可以使用 `task\_id` 查询视频结果。





```bash

curl --location --request GET 'https://apihub.agnes-ai.com/v1/videos/<TASK\_ID>' \\

&#x20; --header 'Authorization: Bearer <API\_KEY>'

```





示例：





```bash

curl --location --request GET 'https://apihub.agnes-ai.com/v1/videos/task\_xxxxxx' \\

&#x20; --header 'Authorization: Bearer <API\_KEY>'

```





该方式仍然支持，但新的接入建议使用 `video\_id` 查询方式。





\---





\## 查询结果响应





当任务完成后，API 会返回最终视频结果。





```json

{

&#x20; "id": "task\_YOUR\_TASK\_ID",

&#x20; "video\_id": "video\_YOUR\_VIDEO\_ID",

&#x20; "model": "agnes-video-v2.0",

&#x20; "object": "video",

&#x20; "status": "completed",

&#x20; "progress": 100,

&#x20; "seconds": "10.0",

&#x20; "size": "1280x768",

&#x20; "remixed\_from\_video\_id": "https://storage.googleapis.com/agnes-aigc/aigc/videos/2026/06/03/video\_xxxxxx.mp4",

&#x20; "error": null

}

```





\### 结果字段说明





| 字段                    | 类型            | 说明                                        |

| --------------------- | ------------- | ----------------------------------------- |

| id                    | string        | 任务 ID                                     |

| video\_id              | string        | 视频 ID                                     |

| model                 | string        | 当前任务使用的模型                                 |

| object                | string        | 对象类型                                      |

| status                | string        | 任务状态                                      |

| progress              | integer       | 任务进度百分比                                   |

| seconds               | string        | 视频时长，单位为秒                                 |

| size                  | string        | 视频分辨率                                     |

| remixed\_from\_video\_id | string        | 本字段为最终生成的视频 URL，仅在 status 为 completed 时可用 |

| error                 | object / null | 错误信息，任务失败时返回                              |





\---





\## 任务状态说明





| 状态          | 说明        |

| ----------- | --------- |

| queued      | 任务正在队列中等待 |

| in\_progress | 视频正在生成中   |

| completed   | 视频已生成完成   |

| failed      | 视频生成失败    |





\---





\## 视频时长控制





Agnes-Video-V2.0 支持通过 `num\_frames` 和 `frame\_rate` 控制视频时长。





计算公式：





```plain text

seconds = num\_frames / frame\_rate

```





其中：



\- `num\_frames` 表示生成的视频总帧数；

\- `frame\_rate` 表示视频帧率，即每秒播放多少帧；

\- `num\_frames` 必须小于或等于 `441`；

\- `num\_frames` 必须满足 `8n + 1`；

\- `frame\_rate` 支持范围为 `1–60`。



\### 常用时长参数





| 目标时长   | 推荐参数                            |

| ------ | ------------------------------- |

| 约 3 秒  | num\_frames: 81, frame\_rate: 24  |

| 约 5 秒  | num\_frames: 121, frame\_rate: 24 |

| 约 10 秒 | num\_frames: 241, frame\_rate: 24 |

| 约 18 秒 | num\_frames: 441, frame\_rate: 24 |





如果希望生成更长的视频，可以增加 `num\_frames` 或降低 `frame\_rate`。





如果希望画面更流畅，可以使用更高的 `frame\_rate`，例如 `24` 或 `30`。但在相同 `num\_frames` 下，`frame\_rate` 越高，视频时长越短。





\---





\## 推荐参数





| 使用场景     | 推荐设置                                                      |

| -------- | --------------------------------------------------------- |

| 标准视频生成   | width: 1152, height: 768, num\_frames: 121, frame\_rate: 24 |

| 短视频社交内容  | num\_frames: 81 或 121, frame\_rate: 24                      |

| 更长视频     | 增加 num\_frames 或降低 frame\_rate                              |

| 更平滑运动    | 使用 frame\_rate: 24 或 30                                    |

| 可复现结果    | 设置固定 seed                                                 |

| 关键帧过渡    | 使用 extra\_body.mode: "keyframes"                           |

| 避免不需要的内容 | 使用 negative\_prompt                                        |





\---





\## Prompt 最佳实践





\### 文生视频 Prompt





文生视频任务建议描述主体、动作、环境、镜头运动、光照和视觉风格。





推荐结构：





```plain text

\[主体] + \[动作] + \[场景] + \[镜头运动] + \[光照] + \[风格]

```





示例：





```plain text

A young astronaut walking across a red desert planet, dust blowing in the wind, slow cinematic tracking shot, dramatic sunset lighting, realistic sci-fi style

```





\---





\### 图生视频 Prompt





图生视频任务建议描述哪些内容需要运动，同时说明哪些主体元素需要保持稳定。





示例：





```plain text

Animate the character with subtle breathing motion, hair moving gently in the wind, background lights flickering softly, while keeping the face and outfit consistent

```





\---





\### 多图视频 Prompt





多图视频任务建议描述输入图片之间的关系，以及画面如何过渡。





示例：





```plain text

Use the first image as the starting scene and the second image as the target scene. Create a smooth transformation with consistent lighting, natural motion, and cinematic pacing

```





\---





\### 关键帧动画 Prompt





关键帧动画任务建议清晰描述关键帧之间的过渡关系。





示例：





```plain text

Create a smooth transition from the first keyframe to the second keyframe, maintaining character identity, consistent camera angle, and natural motion between scenes

```





\---





\## 错误码





| 状态码 | 说明              |

| --- | --------------- |

| 400 | 请求无效，请检查请求参数    |

| 401 | 未授权，请检查 API Key |

| 404 | 任务或视频不存在        |

| 500 | 服务器错误           |

| 503 | 服务繁忙，请稍后重试      |





\---





\## 价格





| 类型             | 标准价格            | 当前价格        |

| -------------- | --------------- | ----------- |

| Video Duration | $0.005 / second | $0 / second |





\---





\## 注意事项



\- 使用 `agnes-video-v2.0` 作为模型名称；

\- 视频生成是异步任务；

\- 需要先创建视频任务，再查询视频结果；

\- 创建任务响应中会同时返回 `task\_id` 和 `video\_id`；

\- 新接入建议使用 `video\_id` 查询视频结果；

\- 旧版 `task\_id` 查询接口仍然支持；

\- `video\_url` 仅在 `status` 为 `completed` 时可用；

\- `num\_frames` 必须小于或等于 `441`；

\- `num\_frames` 必须满足 `8n + 1`，例如 `81`、`121`、`161`、`241` 或 `441`；

\- 文生视频任务仅要求传入 `model` 和 `prompt`；

\- 图生视频任务需要通过 `image` 提供图片 URL；

\- 多图视频任务需要在 `extra\_body.image` 中提供多个图片 URL；

\- 关键帧动画需要设置 `extra\_body.mode` 为 `keyframes`。

