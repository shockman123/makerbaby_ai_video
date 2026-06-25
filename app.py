import os
import json
import uuid
import time
import base64
import urllib.request
import urllib.parse
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, 'assets')
WORKFLOWS_DIR = os.path.join(BASE_DIR, 'workflows')
AGNES_BASE_URL = 'https://apihub.agnes-ai.com/v1'

os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(WORKFLOWS_DIR, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'webm', 'mov'}


def allowed_file(filename, allowed_set):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_set


def get_asset_meta_path():
    return os.path.join(ASSETS_DIR, 'assets.json')


def load_assets():
    meta_path = get_asset_meta_path()
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            assets = json.load(f)

        now = time.time()
        cleaned = []
        for asset in assets:
            filename = asset.get('filename', '')
            if filename:
                file_path = os.path.join(ASSETS_DIR, filename)
                if os.path.exists(file_path):
                    cleaned.append(asset)
                else:
                    # 如果是异步下载的任务（带task_id），且创建时间在5分钟内，不要删除
                    is_downloading = asset.get('task_id')
                    created_at = asset.get('created_at', 0)
                    if is_downloading and (now - created_at) < 300:
                        cleaned.append(asset)
                        print(f"Keep downloading asset: {asset['id']} ({filename})")
                    else:
                        print(f"Removed invalid asset: {asset['id']} ({filename})")

        # 自动恢复本地存在但 assets.json 中缺失的资产
        existing_filenames = {a.get('filename') for a in cleaned}
        for f in os.listdir(ASSETS_DIR):
            full_path = os.path.join(ASSETS_DIR, f)
            if not os.path.isfile(full_path):
                continue
            if f in existing_filenames:
                continue
            if f.startswith('video_qwen_') and f.endswith('.mp4'):
                task_id = f.replace('video_qwen_', '').replace('.mp4', '')
                asset = {
                    'id': f'qwen_{task_id}',
                    'type': 'video',
                    'name': f,
                    'filename': f,
                    'url': f'/api/assets/qwen_{task_id}',
                    'created_at': os.path.getmtime(full_path)
                }
                cleaned.insert(0, asset)
                print(f"Auto-recovered asset: {f}")
            elif f.startswith('qwen_image_') and f.endswith('.png'):
                img_id = f.replace('qwen_image_', '').replace('.png', '')
                asset = {
                    'id': img_id,
                    'type': 'image',
                    'name': f,
                    'filename': f,
                    'url': f'/api/assets/{img_id}',
                    'created_at': os.path.getmtime(full_path)
                }
                cleaned.insert(0, asset)
                print(f"Auto-recovered image: {f}")

        if len(cleaned) != len(assets):
            save_assets(cleaned)

        return cleaned

    return []


def save_assets(assets):
    meta_path = get_asset_meta_path()
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(assets, f, ensure_ascii=False, indent=2)


def agnes_request(api_key, endpoint, method='GET', data=None, max_retries=3):
    url = f'{AGNES_BASE_URL}{endpoint}'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    if data:
        payload = json.dumps(data).encode()
    else:
        payload = None
    
    for attempt in range(max_retries):
        req = urllib.request.Request(url, data=payload, headers=headers, method=method)
        try:
            resp = urllib.request.urlopen(req, timeout=300)
            result = json.loads(resp.read())
            return result, None
        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else str(e)
            if e.code == 429 and attempt < max_retries - 1:
                wait_time = 5 * (attempt + 1)
                print(f'429 rate limited, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})')
                time.sleep(wait_time)
                continue
            return None, f'HTTP {e.code}: {error_body}'
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 3 * (attempt + 1)
                print(f'Request failed, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries}): {e}')
                time.sleep(wait_time)
                continue
            return None, str(e)


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/assets', methods=['GET'])
def list_assets():
    assets = load_assets()
    return jsonify({'success': True, 'assets': assets})


@app.route('/api/assets/upload', methods=['POST'])
def upload_asset():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400

    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

    if ext in ALLOWED_IMAGE_EXTENSIONS:
        asset_type = 'image'
    elif ext in ALLOWED_VIDEO_EXTENSIONS:
        asset_type = 'video'
    else:
        return jsonify({'success': False, 'error': 'Unsupported file type'}), 400

    asset_id = str(uuid.uuid4())[:8]
    saved_name = f'{asset_id}.{ext}'
    save_path = os.path.join(ASSETS_DIR, saved_name)
    file.save(save_path)

    assets = load_assets()
    asset = {
        'id': asset_id,
        'name': filename,
        'type': asset_type,
        'filename': saved_name,
        'url': f'/api/assets/{asset_id}',
        'created_at': time.time()
    }
    assets.insert(0, asset)
    save_assets(assets)

    return jsonify({'success': True, 'asset': asset})


@app.route('/api/assets/<asset_id>', methods=['GET'])
def get_asset(asset_id):
    assets = load_assets()
    asset = next((a for a in assets if a['id'] == asset_id), None)
    if not asset:
        return jsonify({'success': False, 'error': 'Asset not found'}), 404
    
    file_path = os.path.join(ASSETS_DIR, asset['filename'])
    
    if asset.get('remote_url') and not os.path.exists(file_path):
        try:
            req = urllib.request.Request(
                asset['remote_url'],
                headers={'User-Agent': 'Mozilla/5.0 Agnes-Workflow'}
            )
            resp = urllib.request.urlopen(req, timeout=60)
            data = resp.read()
            with open(file_path, 'wb') as f:
                f.write(data)
        except Exception as e:
            print(f"Failed to download remote asset: {e}")
            return redirect(asset['remote_url'])
    
    if not os.path.exists(file_path):
        if asset.get('remote_url'):
            return redirect(asset['remote_url'])
        return jsonify({'success': False, 'error': 'File not found'}), 404
    
    return send_file(file_path)


@app.route('/api/assets/<asset_id>', methods=['DELETE'])
def delete_asset(asset_id):
    assets = load_assets()
    asset = next((a for a in assets if a['id'] == asset_id), None)
    if not asset:
        return jsonify({'success': False, 'error': 'Asset not found'}), 404
    
    file_path = os.path.join(ASSETS_DIR, asset.get('filename', ''))
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Failed to delete file: {e}")
    
    assets = [a for a in assets if a['id'] != asset_id]
    save_assets(assets)
    
    return jsonify({'success': True})


@app.route('/api/generate/image', methods=['POST'])
def generate_image():
    data = request.get_json()
    api_key = data.get('api_key', '')
    qwen_api_key = data.get('qwen_api_key', '')
    prompt = data.get('prompt', '')
    size = data.get('size', '1024x768')
    reference_asset_id = data.get('reference_asset_id')
    platform = data.get('platform', 'agnes')
    qwen_image_model = data.get('qwen_image_model', 'wan2.7-image-pro')

    if not prompt:
        return jsonify({'success': False, 'error': 'Prompt is required'}), 400

    if platform == 'qwen':
        if not qwen_api_key:
            return jsonify({'success': False, 'error': '千问 API Key is required'}), 400
        return generate_image_qwen(qwen_api_key, prompt, size, reference_asset_id, qwen_image_model)

    if not api_key:
        return jsonify({'success': False, 'error': 'API key is required'}), 400

    payload = {
        'model': 'agnes-image-2.1-flash',
        'prompt': prompt,
        'size': size,
        'extra_body': {'response_format': 'url'}
    }

    if reference_asset_id:
        assets = load_assets()
        ref_asset = next((a for a in assets if a['id'] == reference_asset_id), None)
        if ref_asset and ref_asset['type'] == 'image':
            ref_path = os.path.join(ASSETS_DIR, ref_asset['filename'])
            if os.path.exists(ref_path):
                with open(ref_path, 'rb') as f:
                    img_b64 = base64.b64encode(f.read()).decode()
                ext = ref_asset['filename'].rsplit('.', 1)[1].lower()
                mime = f'image/{ext if ext != "jpg" else "jpeg"}'
                payload['extra_body']['image'] = [f'data:{mime};base64,{img_b64}']

    result, error = agnes_request(api_key, '/images/generations', method='POST', data=payload)
    if error:
        return jsonify({'success': False, 'error': error}), 500

    remote_url = result.get('data', [{}])[0].get('url', '')
    if not remote_url:
        return jsonify({'success': False, 'error': 'No image URL in response'}), 500

    try:
        req = urllib.request.Request(remote_url)
        resp = urllib.request.urlopen(req, timeout=60)
        img_data = resp.read()
    except Exception as e:
        return jsonify({'success': False, 'error': f'Download failed: {str(e)}'}), 500

    asset_id = str(uuid.uuid4())[:8]
    saved_name = f'{asset_id}.png'
    save_path = os.path.join(ASSETS_DIR, saved_name)
    with open(save_path, 'wb') as f:
        f.write(img_data)

    assets = load_assets()
    asset = {
        'id': asset_id,
        'name': f'generated_{asset_id}.png',
        'type': 'image',
        'filename': saved_name,
        'url': f'/api/assets/{asset_id}',
        'remote_url': remote_url,
        'created_at': time.time()
    }
    assets.insert(0, asset)
    save_assets(assets)

    return jsonify({'success': True, 'asset': asset})


QWEN_IMAGE_MODELS = [
    {'id': 'wan2.7-image-pro', 'name': 'wan2.7-image-pro', 'desc': '万相 2.7 图片专业版'},
    {'id': 'qwen-image-2.0-pro-2026-04-22', 'name': 'qwen-image-2.0-pro-2026-04-22', 'desc': '千问图像 2.0 专业版'},
]


@app.route('/api/qwen/image-models', methods=['GET'])
def list_qwen_image_models():
    return jsonify({'success': True, 'models': QWEN_IMAGE_MODELS})


def generate_image_qwen(api_key, prompt, size, reference_asset_id, model='wan2.7-image-pro'):
    """千问文生图/图生图"""
    # 千问图像生成API - 同步调用格式
    qwen_url = 'https://llm-0cscgalkvl8qdunu.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

    width, height = size.split('x') if 'x' in size else ('1024', '768')

    # 构建 messages 格式的 content
    content = [{'text': prompt}]

    # 图生图支持
    if reference_asset_id:
        assets = load_assets()
        ref_asset = next((a for a in assets if a['id'] == reference_asset_id), None)
        if ref_asset and ref_asset['type'] == 'image':
            img_url = None
            filename = ref_asset.get('filename') or ref_asset.get('path')
            if filename:
                file_path = os.path.join(ASSETS_DIR, filename)
                if os.path.exists(file_path):
                    import base64
                    with open(file_path, 'rb') as f:
                        img_b64 = base64.b64encode(f.read()).decode()
                    ext = os.path.splitext(filename)[1].lower()
                    mime = 'image/png' if ext == '.png' else 'image/jpeg'
                    img_url = f'data:{mime};base64,{img_b64}'
            if not img_url and ref_asset.get('remote_url'):
                img_url = ref_asset['remote_url']
            if img_url:
                content.append({'image': img_url})

    payload = {
        'model': model,
        'input': {
            'messages': [
                {
                    'role': 'user',
                    'content': content
                }
            ]
        },
        'parameters': {
            'size': f'{width}*{height}',
            'n': 1,
        }
    }

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    import urllib.request
    import json

    req = urllib.request.Request(qwen_url, data=json.dumps(payload).encode(), headers=headers, method='POST')

    try:
        resp = urllib.request.urlopen(req, timeout=120)
        result = json.loads(resp.read().decode())
        print(f'[Qwen Image] 响应: {json.dumps(result, ensure_ascii=False)[:500]}')

        # 千问多模态生成API返回结构: output.choices[0].message.content[0].image
        image_url = None
        output = result.get('output', {})
        choices = output.get('choices', [])
        if choices:
            message = choices[0].get('message', {})
            content_list = message.get('content', [])
            for item in content_list:
                if 'image' in item:
                    image_url = item['image']
                    break

        if image_url:
            # 同步返回图片URL，下载到本地并保存
            try:
                dl_req = urllib.request.Request(image_url, headers={'User-Agent': 'Mozilla/5.0 Qwen-Workflow'})
                dl_resp = urllib.request.urlopen(dl_req, timeout=1000)
                img_data = dl_resp.read()

                asset_id = str(uuid.uuid4())[:8]
                saved_name = f'{asset_id}.png'
                local_path = os.path.join(ASSETS_DIR, saved_name)
                with open(local_path, 'wb') as f:
                    f.write(img_data)

                assets = load_assets()
                asset = {
                    'id': asset_id,
                    'type': 'image',
                    'name': f'qwen_image_{asset_id}.png',
                    'filename': saved_name,
                    'url': f'/api/assets/{asset_id}',
                    'remote_url': image_url,
                    'created_at': time.time()
                }
                assets.insert(0, asset)
                save_assets(assets)

                return jsonify({'success': True, 'asset': asset, 'platform': 'qwen', 'qwen_model': model})
            except Exception as e:
                return jsonify({'success': False, 'error': f'Download failed: {str(e)}'}), 500
        else:
            return jsonify({'success': False, 'error': f'Qwen API error: no image_url in response: {result}'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'Qwen API error: {str(e)}'}), 500


@app.route('/api/generate/video', methods=['POST'])
def generate_video():
    data = request.get_json()
    api_key = data.get('api_key', '')
    qwen_api_key = data.get('qwen_api_key', '')
    prompt = data.get('prompt', '')
    image_asset_ids = data.get('image_asset_ids', [])
    num_frames = data.get('num_frames', 241)
    frame_rate = data.get('frame_rate', 24)
    model = data.get('model', 'agnes')
    qwen_model = data.get('qwen_model', 'wan2.7-i2v-2026-04-25')

    if not prompt:
        return jsonify({'success': False, 'error': 'Prompt is required'}), 400

    if model == 'qwen':
        if not qwen_api_key:
            return jsonify({'success': False, 'error': '千问 API Key is required'}), 400
        
        return generate_video_qwen(qwen_api_key, prompt, image_asset_ids, qwen_model)
    else:
        if not api_key:
            return jsonify({'success': False, 'error': 'API key is required'}), 400
        
        payload = {
            'model': 'agnes-video-v2.0',
            'prompt': prompt,
            'num_frames': num_frames,
            'frame_rate': frame_rate,
            'extra_body': {
                'mode': 'keyframes' if image_asset_ids else 'text'
            }
        }

        if image_asset_ids:
            assets = load_assets()
            image_refs = []
            for aid in image_asset_ids:
                asset = next((a for a in assets if a['id'] == aid), None)
                if asset and asset['type'] == 'image':
                    if asset.get('remote_url'):
                        image_refs.append(asset['remote_url'])
                    elif asset.get('path'):
                        import base64
                        file_path = os.path.join(ASSETS_DIR, asset['path'])
                        if os.path.exists(file_path):
                            with open(file_path, 'rb') as f:
                                img_b64 = base64.b64encode(f.read()).decode()
                            ext = os.path.splitext(asset['path'])[1].lower()
                            mime = 'image/png' if ext == '.png' else 'image/jpeg'
                            image_refs.append(f'data:{mime};base64,{img_b64}')
            if image_refs:
                payload['extra_body']['image'] = image_refs
            else:
                payload['extra_body']['mode'] = 'text'

        result, error = agnes_request(api_key, '/videos', method='POST', data=payload)
        if error:
            return jsonify({'success': False, 'error': error}), 500

        task_id = result.get('id', '')
        return jsonify({'success': True, 'task_id': task_id, 'status': 'queued', 'model': 'agnes'})


QWEN_VIDEO_MODELS = [
    {'id': 'wan2.7-i2v-2026-04-25', 'name': 'wan2.7-i2v-2026-04-25', 'type': 'i2v', 'desc': '万相 2.7 图生视频'},
    {'id': 'happyhorse-1.1-i2v', 'name': 'happyhorse-1.1-i2v', 'type': 'i2v', 'desc': 'HAPPYHORSE 1.1 图生视频'},
    {'id': 'wan2.7-r2v', 'name': 'wan2.7-r2v', 'type': 'r2v', 'desc': '万相 2.7 参考图生视频'},
    {'id': 'happyhorse-1.1-r2v', 'name': 'happyhorse-1.1-r2v', 'type': 'r2v', 'desc': 'HAPPYHORSE 1.1 参考图生视频'},
    {'id': 'happyhorse-1.0-r2v', 'name': 'happyhorse-1.0-r2v', 'type': 'r2v', 'desc': 'HAPPYHORSE 1.0 参考图生视频'},
]


@app.route('/api/qwen/models', methods=['GET'])
def list_qwen_models():
    return jsonify({'success': True, 'models': QWEN_VIDEO_MODELS})


@app.route('/api/qwen/queue/<task_id>', methods=['GET'])
def get_qwen_queue_position(task_id):
    qwen_api_key = request.headers.get('X-Qwen-API-Key', '')
    
    if not qwen_api_key:
        return jsonify({'success': False, 'error': '千问 API Key is required'}), 400
    
    qwen_url = f'https://llm-0cscgalkvl8qdunu.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis/{task_id}'
    
    headers = {
        'Authorization': f'Bearer {qwen_api_key}',
        'Content-Type': 'application/json'
    }
    
    req = urllib.request.Request(qwen_url, headers=headers, method='GET')
    
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        result = json.loads(resp.read().decode())
        
        output = result.get('output', {})
        status = output.get('task_status', 'unknown')
        queue_position = output.get('queue_position')
        progress = output.get('progress', 0)
        
        response = {
            'success': True,
            'task_id': task_id,
            'status': status,
            'progress': progress
        }
        
        if queue_position is not None:
            response['queue_position'] = queue_position
        
        if status == 'PENDING':
            response['message'] = '任务排队中'
        elif status == 'RUNNING':
            response['message'] = '任务处理中'
        elif status == 'SUCCEEDED':
            response['message'] = '任务完成'
            response['video_url'] = output.get('video_url', '')
        elif status == 'FAILED':
            response['message'] = '任务失败'
            response['error'] = output.get('error_message', 'Unknown error')
        
        return jsonify(response)
    except Exception as e:
        return jsonify({'success': False, 'error': f'Qwen API error: {str(e)}'}), 500


@app.route('/api/qwen/cancel/<task_id>', methods=['POST'])
def cancel_qwen_video(task_id):
    qwen_api_key = request.headers.get('X-Qwen-API-Key', '')
    
    if not qwen_api_key:
        return jsonify({'success': False, 'error': '千问 API Key is required'}), 400
    
    qwen_url = f'https://llm-0cscgalkvl8qdunu.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis/{task_id}'
    
    headers = {
        'Authorization': f'Bearer {qwen_api_key}',
        'Content-Type': 'application/json'
    }
    
    req = urllib.request.Request(qwen_url, headers=headers, method='DELETE')
    
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        result = json.loads(resp.read().decode())
        
        output = result.get('output', {})
        status = output.get('task_status', 'unknown')
        
        if status == 'CANCELLED':
            return jsonify({'success': True, 'task_id': task_id, 'message': '任务已取消'})
        else:
            return jsonify({'success': True, 'task_id': task_id, 'status': status, 'message': '取消请求已发送'})
    except Exception as e:
        return jsonify({'success': False, 'error': f'Qwen API error: {str(e)}'}), 500


def generate_video_qwen(api_key, prompt, image_asset_ids, model='wan2.7-i2v-2026-04-25'):
    qwen_url = 'https://llm-0cscgalkvl8qdunu.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis'
    
    model_info = next((m for m in QWEN_VIDEO_MODELS if m['id'] == model), QWEN_VIDEO_MODELS[0])
    model_type = model_info['type']
    
    media = []
    
    if model_type in ('i2v', 'r2v') and image_asset_ids:
        assets = load_assets()
        # i2v 只支持1张first_frame作为首帧, r2v 可用多张reference_image作为参考
        max_images = 1 if model_type == 'i2v' else len(image_asset_ids)
        media_type = 'first_frame' if model_type == 'i2v' else 'reference_image'
        for idx, aid in enumerate(image_asset_ids[:max_images]):
            asset = next((a for a in assets if a['id'] == aid), None)
            if asset and asset['type'] == 'image':
                img_url = None
                # 优先用本地文件（更可靠）
                if asset.get('filename') or asset.get('path'):
                    filename = asset.get('filename') or asset.get('path')
                    file_path = os.path.join(ASSETS_DIR, filename)
                    if os.path.exists(file_path):
                        # 把本地图片用base64编码发给千问
                        import base64
                        with open(file_path, 'rb') as f:
                            img_b64 = base64.b64encode(f.read()).decode()
                        ext = os.path.splitext(filename)[1].lower()
                        mime = 'image/png' if ext == '.png' else 'image/jpeg'
                        img_url = f'data:{mime};base64,{img_b64}'
                # 如果本地没有文件但有远程URL，先下载到本地再base64
                if not img_url and asset.get('remote_url'):
                    try:
                        import urllib.request
                        import base64
                        req = urllib.request.Request(
                            asset['remote_url'],
                            headers={'User-Agent': 'Mozilla/5.0'}
                        )
                        resp = urllib.request.urlopen(req, timeout=60)
                        img_data = resp.read()
                        img_b64 = base64.b64encode(img_data).decode()
                        ext = 'png'
                        mime = 'image/png'
                        img_url = f'data:{mime};base64,{img_b64}'
                        print(f'[Qwen Gen] Downloaded remote image: {asset["remote_url"]}')
                    except Exception as e:
                        print(f'[Qwen Gen] Failed to download remote image: {e}')
                        continue
                if img_url:
                    media.append({
                        'type': media_type,
                        'url': img_url
                    })
                else:
                    print(f'[Qwen Gen] No usable image for asset: {aid}')
            else:
                print(f'[Qwen Gen] Asset not found or not image: {aid}')
    
    payload = {
        'model': model,
        'input': {
            'prompt': prompt,
        },
        'parameters': {
            'resolution': '720P',
            'duration': 10,
            'prompt_extend': True,
            'watermark': True
        }
    }

    if media:
        payload['input']['media'] = media

    print(f'[Qwen Gen] model={model}, media_count={len(media)}, payload={payload}')
    print(f'[Qwen Gen] 实际计费模型: {model}')
    
    headers = {
        'X-DashScope-Async': 'enable',
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    import urllib.request
    import json
    
    req = urllib.request.Request(qwen_url, data=json.dumps(payload).encode(), headers=headers, method='POST')
    
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        result = json.loads(resp.read().decode())
        task_id = result.get('output', {}).get('task_id', '')
        if task_id:
            return jsonify({'success': True, 'task_id': task_id, 'status': 'queued', 'model': 'qwen', 'qwen_model': model})
        else:
            return jsonify({'success': False, 'error': f'Qwen API error: {result}'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': f'Qwen API error: {str(e)}'}), 500


@app.route('/api/generate/image/<task_id>', methods=['GET'])
def get_image_status(task_id):
    api_key = request.headers.get('X-API-Key', '')
    qwen_api_key = request.headers.get('X-Qwen-API-Key', '')
    model = request.headers.get('X-Model', 'agnes')

    if model == 'qwen':
        return get_qwen_image_status(task_id, qwen_api_key)

    if not api_key:
        return jsonify({'success': False, 'error': 'API key is required'}), 400

    result, error = agnes_request(api_key, f'/images/generations/{task_id}', method='GET')
    if error:
        return jsonify({'success': False, 'error': error}), 500

    return jsonify({'success': True, 'task_id': task_id, 'status': result.get('status', 'unknown')})


@app.route('/api/generate/video/<task_id>', methods=['GET'])
def get_video_status(task_id):
    api_key = request.headers.get('X-API-Key', '')
    qwen_api_key = request.headers.get('X-Qwen-API-Key', '')
    model = request.headers.get('X-Model', 'agnes')

    if model == 'qwen':
        return get_qwen_video_status(task_id, qwen_api_key)
    else:
        if not api_key:
            return jsonify({'success': False, 'error': 'API key is required'}), 400

        result, error = agnes_request(api_key, f'/videos/{task_id}', method='GET')
        if error:
            # 401/403/404 表示任务过期或无效
            if '401' in error or '403' in error or '404' in error or 'Forbidden' in error:
                return jsonify({'success': False, 'error': '任务已过期或无效', 'expired': True}), 200
            return jsonify({'success': False, 'error': error}), 500

        status = result.get('status', '')
        progress = result.get('progress', 0)

        response = {
            'success': True,
            'task_id': task_id,
            'status': status,
            'progress': progress
        }

        if status == 'completed':
            video_id = result.get('remixed_from_video_id', '')
            if video_id:
                import datetime
                today = datetime.date.today()
                year = today.year
                month = f'{today.month:02d}'
                day = f'{today.day:02d}'
                video_url = f'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/{year}/{month}/{day}/{video_id}.mp4'
                response['video_url'] = video_url
                
                local_filename = f'video_{video_id}.mp4'
                local_path = os.path.join(ASSETS_DIR, local_filename)
                
                assets = load_assets()
                existing = next((a for a in assets if a.get('remote_url') == video_url), None)
                if not existing:
                    asset = {
                        'id': video_id,
                        'type': 'video',
                        'name': f'video_{video_id}.mp4',
                        'filename': local_filename,
                        'url': f'/api/assets/{video_id}',
                        'remote_url': video_url,
                        'created_at': time.time()
                    }
                    assets.insert(0, asset)
                    save_assets(assets)
                
                if not os.path.exists(local_path):
                    import threading
                    def download_video_async():
                        try:
                            req = urllib.request.Request(video_url, headers={'User-Agent': 'Mozilla/5.0 Agnes-Workflow'})
                            resp = urllib.request.urlopen(req, timeout=1000)
                            with open(local_path, 'wb') as f:
                                f.write(resp.read())
                            print(f'Video downloaded: {local_path}')
                        except Exception as e:
                            print(f'Failed to download video: {e}')
                    threading.Thread(target=download_video_async, daemon=True).start()
        elif status == 'failed':
            response['error'] = result.get('error', 'Unknown error')

        return jsonify(response)


def get_qwen_video_status(task_id, api_key):
    return _get_qwen_task_status(task_id, api_key, 'video')


def get_qwen_image_status(task_id, api_key):
    return _get_qwen_task_status(task_id, api_key, 'image')


def _get_qwen_task_status(task_id, api_key, task_type='video'):
    qwen_url = f'https://llm-0cscgalkvl8qdunu.cn-beijing.maas.aliyuncs.com/api/v1/tasks/{task_id}'
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    import urllib.request
    import json
    
    req = urllib.request.Request(qwen_url, headers=headers, method='GET')
    
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        result = json.loads(resp.read().decode())
        
        print(f'[Qwen Status] task_id={task_id}, full response keys: {list(result.keys())}')
        output = result.get('output', {})
        print(f'[Qwen Status] output keys: {list(output.keys())}')
        
        status = output.get('task_status', 'unknown')
        
        if status == 'SUCCEEDED':
            if task_type == 'image':
                # 千问文生图返回的结果
                image_url = output.get('image_url') or (output.get('results', [{}])[0].get('url') if output.get('results') else '')
                if not image_url and output.get('results'):
                    image_url = output['results'][0].get('url', '')
                response = {
                    'success': True,
                    'task_id': task_id,
                    'status': 'completed',
                    'progress': 100,
                    'image_url': image_url
                }

                if image_url:
                    local_filename = f'qwen_image_{task_id}.png'
                    local_path = os.path.join(ASSETS_DIR, local_filename)

                    assets = load_assets()
                    existing = next((a for a in assets if a.get('remote_url') == image_url), None)
                    if not existing:
                        asset = {
                            'id': f'qwen_{task_id}',
                            'type': 'image',
                            'name': f'qwen_image_{task_id}.png',
                            'filename': local_filename,
                            'url': f'/api/assets/qwen_{task_id}',
                            'remote_url': image_url,
                            'created_at': time.time()
                        }
                        assets.insert(0, asset)
                        save_assets(assets)

                    if not os.path.exists(local_path):
                        import threading
                        def download_image_async():
                            try:
                                req = urllib.request.Request(image_url, headers={'User-Agent': 'Mozilla/5.0 Qwen-Workflow'})
                                resp = urllib.request.urlopen(req, timeout=1000)
                                with open(local_path, 'wb') as f:
                                    f.write(resp.read())
                                print(f'Qwen image downloaded: {local_path}')
                            except Exception as e:
                                print(f'Failed to download qwen image: {e}')
                        threading.Thread(target=download_image_async, daemon=True).start()

                return jsonify(response)

            video_url = output.get('video_url', '')
            response = {
                'success': True,
                'task_id': task_id,
                'status': 'completed',
                'progress': 100,
                'video_url': video_url
            }

            if video_url:
                local_filename = f'video_qwen_{task_id}.mp4'
                local_path = os.path.join(ASSETS_DIR, local_filename)

                assets = load_assets()
                # 用 task_id 去重，而不是 remote_url（remote_url每次都是新的）
                existing = next((a for a in assets if a.get('id') == f'qwen_{task_id}'), None)
                if not existing:
                    asset = {
                        'id': f'qwen_{task_id}',
                        'type': 'video',
                        'name': f'video_qwen_{task_id}.mp4',
                        'filename': local_filename,
                        'url': f'/api/assets/qwen_{task_id}',
                        'remote_url': video_url,
                        'created_at': time.time(),
                        'task_id': task_id  # 标记这是异步下载的资产
                    }
                    assets.insert(0, asset)
                    save_assets(assets)

                if not os.path.exists(local_path):
                    import threading
                    def download_video_async():
                        try:
                            req = urllib.request.Request(video_url, headers={'User-Agent': 'Mozilla/5.0 Qwen-Workflow'})
                            resp = urllib.request.urlopen(req, timeout=1000)
                            with open(local_path, 'wb') as f:
                                f.write(resp.read())
                            print(f'Qwen video downloaded: {local_path}')
                        except Exception as e:
                            print(f'Failed to download qwen video: {e}')
                    threading.Thread(target=download_video_async, daemon=True).start()

            return jsonify(response)
        elif status == 'FAILED':
            print(f'[Qwen FAILED] task_id={task_id}, full output: {output}')
            error_msg = output.get('error_message') or output.get('message') or output.get('error') or str(output)
            return jsonify({
                'success': True,
                'task_id': task_id,
                'status': 'failed',
                'progress': 0,
                'error': error_msg
            })
        elif status == 'RUNNING':
            progress = output.get('progress', 0)
            response = {
                'success': True,
                'task_id': task_id,
                'status': 'in_progress',
                'progress': progress,
                'scheduled_time': output.get('scheduled_time')
            }
            return jsonify(response)
        elif status == 'PENDING':
            response = {
                'success': True,
                'task_id': task_id,
                'status': 'queued',
                'progress': 0,
                'submit_time': output.get('submit_time')
            }
            return jsonify(response)
        else:
            queue_position = output.get('queue_position')
            response = {
                'success': True,
                'task_id': task_id,
                'status': 'in_progress',
                'progress': 0
            }
            if queue_position is not None:
                response['queue_position'] = queue_position
            return jsonify(response)
    except Exception as e:
        return jsonify({'success': False, 'error': f'Qwen API error: {str(e)}'}), 500


@app.route('/api/video/process', methods=['POST'])
def process_video():
    data = request.get_json()
    api_key = data.get('api_key', '')
    mode = data.get('mode', '')
    video_urls = data.get('video_urls', [])
    params = data.get('params', {})
    
    import subprocess
    
    asset_id = str(uuid.uuid4())[:8]
    output_filename = f'{asset_id}.mp4'
    output_path = os.path.join(ASSETS_DIR, output_filename)
    
    try:
        if mode == 'cut':
            start_time = params.get('start', '0')
            end_time = params.get('end', '10')
            video_path = download_video(video_urls[0])
            cmd = [
                'ffmpeg', '-y', '-i', video_path,
                '-ss', start_time, '-to', end_time,
                '-c:v', 'libx264', '-c:a', 'aac',
                output_path
            ]
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f'FFmpeg cut output: {result.stdout}')
            
        elif mode == 'concat':
            files = []
            for url in video_urls:
                path = download_video(url)
                files.append(path)
            
            list_file = os.path.join(ASSETS_DIR, f'{asset_id}_list.txt')
            with open(list_file, 'w', encoding='utf-8') as f:
                for path in files:
                    f.write(f"file '{path}'\n")
            
            cmd = [
                'ffmpeg', '-y', '-f', 'concat', '-safe', '0',
                '-i', list_file, '-c', 'copy',
                output_path
            ]
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f'FFmpeg concat output: {result.stdout}')
            os.remove(list_file)
            
        elif mode == 'subtitle':
            video_path = download_video(video_urls[0])
            subtitles = params.get('subtitles', [])
            default_voice = params.get('voice', 'zh-CN-YunjianNeural')
            
            drawtext_parts = []
            audio_files = []
            
            for i, sub in enumerate(subtitles):
                text = sub.get('text', '')
                start = sub.get('start', '0')
                end = sub.get('end', '5')
                use_tts = sub.get('use_tts', False)
                sub_voice = sub.get('voice', default_voice)
                
                if text:
                    escaped_text = text.replace("'", "\\'").replace('"', '\\"').replace('\n', ' ').replace('\r', '')
                    start = str(start).strip()
                    end = str(end).strip()
                    drawtext_parts.append(f"drawtext=text='{escaped_text}':fontsize=24:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h-80:enable='between(t,{start},{end})'")
                
                if use_tts and text:
                    tts_path = os.path.join(ASSETS_DIR, f'{asset_id}_tts_{i}.mp3')
                    rate = float(sub.get('rate', 1))
                    rate_percent = int((rate - 1) * 100)
                    rate_str = f'{rate_percent:+}%'
                    cmd_tts = ['edge-tts', '--voice', sub_voice, '--text', text, '--rate', rate_str, '--write-media', tts_path]
                    subprocess.run(cmd_tts, check=True, capture_output=True)
                    audio_files.append(tts_path)
            
            cmd = ['ffmpeg', '-y', '-i', video_path]
            for af in audio_files:
                cmd.extend(['-i', af])
            
            filter_complex = []
            
            # Add drawtext filters - use comma to chain multiple drawtext filters
            if drawtext_parts:
                # Chain all drawtext filters together with commas
                filter_complex.append(f"[0:v]{','.join(drawtext_parts)}[outv]")
            
            # Add volume filters and delay for TTS audios, then mix with original audio
            if audio_files:
                # Create delay and volume filters for each TTS audio
                for i, sub in enumerate(subtitles):
                    if sub.get('use_tts', False) and sub.get('text', ''):
                        start_ms = int(float(sub.get('start', '0')) * 1000)
                        filter_complex.append(f"[{i+1}:a]adelay={start_ms}|{start_ms},volume=0.8[aud{i}]")
                
                # Mix original audio with delayed TTS audios
                mix_inputs = '[0:a]' + ''.join([f'[aud{i}]' for i in range(len(audio_files))])
                filter_complex.append(f"{mix_inputs}amix=inputs={len(audio_files) + 1}:duration=first[outa]")
            elif filter_complex:
                # Keep original audio if we have video filters but no TTS
                filter_complex.append(f"[0:a]copy[outa]")
            if filter_complex:
                cmd.extend(['-filter_complex', ';'.join(filter_complex)])
                has_outv = any('[outv]' in f for f in filter_complex)
                if has_outv:
                    cmd.extend(['-map', '[outv]', '-map', '[outa]'])
                else:
                    cmd.extend(['-map', '0:v', '-map', '[outa]'])
            else:
                cmd.extend(['-map', '0:v', '-map', '0:a'])
            
            cmd.extend(['-c:v', 'libx264', '-c:a', 'aac', output_path])
            
            print(f'FFmpeg command: {" ".join(cmd)}')
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f'FFmpeg subtitle output: {result.stdout}')
            
            for af in audio_files:
                if os.path.exists(af):
                    os.remove(af)
        
        else:
            return jsonify({'success': False, 'error': 'Unknown mode'}), 400
        
        assets = load_assets()
        asset = {
            'id': asset_id,
            'type': 'video',
            'name': f'processed_{asset_id}.mp4',
            'filename': output_filename,
            'url': f'/api/assets/{asset_id}',
            'created_at': time.time()
        }
        assets.insert(0, asset)
        save_assets(assets)
        
        return jsonify({'success': True, 'asset_id': asset_id, 'url': f'/api/assets/{asset_id}'})
        
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr if e.stderr else str(e)
        if isinstance(error_msg, bytes):
            error_msg = error_msg.decode('utf-8', errors='ignore')
        return jsonify({'success': False, 'error': f'FFmpeg error: {error_msg}'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def download_video(url):
    if url.startswith('/api/assets/'):
        asset_id = url.split('/')[-1]
        assets = load_assets()
        asset = next((a for a in assets if a['id'] == asset_id), None)
        if asset:
            if asset.get('remote_url'):
                url = asset['remote_url']
            else:
                return os.path.join(ASSETS_DIR, asset['filename'])
    
    local_path = os.path.join(ASSETS_DIR, f'video_{hash(url) % 1000000}.mp4')
    if not os.path.exists(local_path):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=120)
        with open(local_path, 'wb') as f:
            f.write(resp.read())
    return local_path


@app.route('/api/video/voices', methods=['GET'])
def list_voices():
    voices = [
        {'name': 'zh-CN-YunjianNeural', 'description': '云健 - 中文男'},
        {'name': 'zh-CN-YunxiNeural', 'description': '云希 - 中文男'},
        {'name': 'zh-CN-YunxiaNeural', 'description': '云霞 - 中文童声'},
        {'name': 'zh-CN-YunyangNeural', 'description': '云阳 - 中文男'},
        {'name': 'zh-CN-XiaoxiaoNeural', 'description': '晓晓 - 中文女'},
        {'name': 'zh-CN-XiaoyiNeural', 'description': '晓艺 - 中文女'},
        {'name': 'zh-CN-YunfengNeural', 'description': '云枫 - 中文男'},
        {'name': 'zh-CN-shaanxi-XiaoniNeural', 'description': '小妮 - 陕西女童'},
        {'name': 'zh-CN-liaoning-XiaobeiNeural', 'description': '小北 - 辽宁女童'},
    ]
    return jsonify({'success': True, 'voices': voices})


if __name__ == '__main__':
    print('Starting Agnes Workflow Server...')
    print('Open http://localhost:5000 in your browser')
    app.run(host='0.0.0.0', port=5000, debug=True)
