"""
wan2.7-videoedit 模型独立测试脚本

用法:
  python test_videoedit.py --api-key YOUR_KEY --video-url https://xxx/video.mp4 --prompt "将画面转为黏土风格"

说明:
  - wan2.7-videoedit 的视频输入必须是公网可访问的 URL（不支持 base64）
  - 视频限制: MP4/MOV, 2-10秒, 最大100MB, 分辨率 240-4096px
  - 任务通常需要 1-5 分钟
"""
import sys
import json
import time
import argparse
import urllib.request
import urllib.error

QWEN_URL = 'https://llm-0cscgalkvl8qdunu.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis'
QWEN_STATUS_URL = 'https://llm-0cscgalkvl8qdunu.cn-beijing.maas.aliyuncs.com/api/v1/tasks'


def create_task(api_key, video_url, prompt, model='wan2.7-videoedit'):
    """创建视频编辑任务"""
    payload = {
        'model': model,
        'input': {
            'prompt': prompt,
            'media': [
                {
                    'type': 'video',
                    'url': video_url
                }
            ]
        },
        'parameters': {
            'resolution': '720P',
            'prompt_extend': True,
            'watermark': False
        }
    }

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
    }

    data = json.dumps(payload).encode()
    req = urllib.request.Request(QWEN_URL, data=data, headers=headers, method='POST')

    try:
        resp = urllib.request.urlopen(req, timeout=60)
        result = json.loads(resp.read().decode())
        print(f'[创建任务] 响应: {json.dumps(result, ensure_ascii=False, indent=2)}')
        task_id = result.get('output', {}).get('task_id')
        if task_id:
            print(f'[创建任务] 成功! task_id: {task_id}')
            return task_id
        else:
            print(f'[创建任务] 失败: 未返回 task_id')
            return None
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        print(f'[创建任务] HTTP错误 {e.code}: {body}')
        return None
    except Exception as e:
        print(f'[创建任务] 异常: {e}')
        return None


def poll_task(api_key, task_id, max_polls=60, interval=5):
    """轮询任务状态"""
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    for i in range(1, max_polls + 1):
        url = f'{QWEN_STATUS_URL}/{task_id}'
        req = urllib.request.Request(url, headers=headers, method='GET')

        try:
            resp = urllib.request.urlopen(req, timeout=30)
            result = json.loads(resp.read().decode())
            output = result.get('output', {})
            status = output.get('task_status', 'unknown')
            progress = output.get('progress', 0)

            print(f'[轮询 {i}/{max_polls}] 状态: {status}, 进度: {progress}%, output keys: {list(output.keys())}')

            if status == 'SUCCEEDED':
                video_url = output.get('video_url', '')
                print(f'\n[成功] 视频URL: {video_url}')
                return video_url
            elif status == 'FAILED':
                error_msg = output.get('error_message') or output.get('message') or output.get('error') or str(output)
                print(f'\n[失败] 错误信息: {error_msg}')
                print(f'[失败] 完整output: {json.dumps(output, ensure_ascii=False, indent=2)}')
                return None
            elif status == 'CANCELLED':
                print(f'\n[取消] 任务已取消')
                return None

        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else ''
            print(f'[轮询 {i}] HTTP错误 {e.code}: {body[:200]}')
            if e.code in (400, 404):
                print('[轮询] 任务不存在或已过期')
                return None
        except Exception as e:
            print(f'[轮询 {i}] 异常: {e}')

        time.sleep(interval)

    print(f'\n[超时] 轮询 {max_polls} 次后仍未完成')
    return None


def main():
    parser = argparse.ArgumentParser(description='测试 wan2.7-videoedit 模型')
    parser.add_argument('--api-key', required=True, help='千问 API Key')
    parser.add_argument('--video-url', required=True, help='公网可访问的视频URL')
    parser.add_argument('--prompt', default='将整个画面转换为黏土风格', help='编辑指令')
    parser.add_argument('--model', default='wan2.7-videoedit', help='模型名称')
    parser.add_argument('--max-polls', type=int, default=60, help='最大轮询次数')
    args = parser.parse_args()

    print(f'=== wan2.7-videoedit 测试 ===')
    print(f'模型: {args.model}')
    print(f'视频URL: {args.video_url}')
    print(f'提示词: {args.prompt}')
    print()

    # 步骤1: 创建任务
    task_id = create_task(args.api_key, args.video_url, args.prompt, args.model)
    if not task_id:
        print('创建任务失败，退出')
        sys.exit(1)

    print()
    # 步骤2: 轮询状态
    video_url = poll_task(args.api_key, task_id, args.max_polls)

    if video_url:
        print(f'\n=== 测试成功 ===')
        print(f'输出视频URL: {video_url}')
    else:
        print(f'\n=== 测试失败 ===')
        sys.exit(1)


if __name__ == '__main__':
    main()
