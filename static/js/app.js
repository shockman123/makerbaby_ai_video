const state = {
    nodes: [],
    connections: [],
    draggingNode: null,
    dragOffset: { x: 0, y: 0 },
    panning: false,
    panStart: { x: 0, y: 0 },
    canvasPos: { x: 0, y: 0 },
    scale: 1,
    connecting: null,
    assets: []
};

const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('canvas');
const connectionsSvg = document.getElementById('connections-svg');

function getApiKey() {
    return localStorage.getItem('agnes_api_key') || '';
}

function setApiKey(key) {
    localStorage.setItem('agnes_api_key', key);
}

function getQwenKey() {
    return localStorage.getItem('qwen_api_key') || '';
}

function setQwenKey(key) {
    localStorage.setItem('qwen_api_key', key);
}

function toggleQwenKey() {
    const key = getQwenKey();
    const newKey = prompt('请输入千问 API Key:', key);
    if (newKey !== null) {
        setQwenKey(newKey);
        updateQwenKeyBtn();
    }
}

function updateQwenKeyBtn() {
    const btn = document.getElementById('qwen-key-btn');
    const key = getQwenKey();
    if (key) {
        btn.innerHTML = '🔑 千问: ' + key.substring(0, 8) + '...';
    } else {
        btn.innerHTML = '🔑 千问密钥';
    }
}

function updateQwenModel(nodeId, model) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.qwenModel = model;
    scheduleSave();
}

let qwenModels = [
    { id: 'wan2.7-i2v-2026-04-25', name: 'wan2.7-i2v-2026-04-25', type: 'i2v', desc: '万相 2.7 图生视频' },
    { id: 'happyhorse-1.1-i2v', name: 'happyhorse-1.1-i2v', type: 'i2v', desc: 'HAPPYHORSE 1.1 图生视频' },
    { id: 'wan2.7-r2v', name: 'wan2.7-r2v', type: 'r2v', desc: '万相 2.7 参考图生视频' },
    { id: 'happyhorse-1.1-r2v', name: 'happyhorse-1.1-r2v', type: 'r2v', desc: 'HAPPYHORSE 1.1 参考图生视频' },
    { id: 'happyhorse-1.0-r2v', name: 'happyhorse-1.0-r2v', type: 'r2v', desc: 'HAPPYHORSE 1.0 参考图生视频' },
];

let qwenImageModels = [
    { id: 'wan2.7-image-pro', name: 'wan2.7-image-pro', desc: '万相 2.7 图片专业版' },
    { id: 'qwen-image-2.0-pro-2026-04-22', name: 'qwen-image-2.0-pro-2026-04-22', desc: '千问图像 2.0 专业版' },
];

function getQwenModelOptions(selectedId) {
    return qwenModels.map(m => {
        const note = m.type === 'i2v' ? '（仅首帧1张）' : '（支持多张参考图）';
        return `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${m.desc}${note}</option>`;
    }).join('');
}

function getQwenImageModelOptions(selectedId) {
    return qwenImageModels.map(m => `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${m.desc}</option>`).join('');
}

function updateQwenImageModel(nodeId, model) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.qwenImageModel = model;
    scheduleSave();
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    updateApiKeyBadge();
    updateQwenKeyBtn();
    loadAssets();
}

function updateApiKeyBadge() {
    const key = getApiKey();
    const badge = document.getElementById('api-key-badge');
    if (key) {
        badge.innerHTML = `<span class="dot"></span> API Key: ${key.substring(0, 8)}... <button onclick="logout()">切换</button>`;
    }
}

function logout() {
    localStorage.removeItem('agnes_api_key');
    showLogin();
}

function login() {
    const input = document.getElementById('api-key-input');
    const qwenInput = document.getElementById('qwen-key-input');
    const key = input.value.trim();
    const qwenKey = qwenInput.value.trim();
    if (!key) {
        alert('请输入 API Key');
        return;
    }
    setApiKey(key);
    if (qwenKey) {
        setQwenKey(qwenKey);
    }
    showApp();
}

async function loadAssets() {
    try {
        const res = await fetch('/api/assets');
        const data = await res.json();
        if (data.success) {
            state.assets = data.assets;
            renderAssetPanel();
        }
    } catch (e) {
        console.error('Load assets failed:', e);
    }
}

function renderAssetPanel() {
    const list = document.getElementById('asset-list');
    list.innerHTML = '';
    state.assets.forEach(asset => {
        const item = document.createElement('div');
        item.className = 'asset-item';
        item.title = asset.name;
        
        const imgOrVideo = asset.type === 'image' 
            ? `<img src="${asset.url}" alt="${asset.name}" onerror="this.parentElement.innerHTML='<div class=\'asset-error\'>加载失败</div>'">`
            : `<video src="${asset.url}" muted></video>`;
        
        item.innerHTML = `
            ${imgOrVideo}
            <div class="asset-type-icon">${asset.type === 'image' ? '🖼️' : '🎬'}</div>
            <button class="asset-delete-btn" data-asset-id="${asset.id}">×</button>
        `;
        
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('asset-delete-btn')) {
                e.stopPropagation();
                e.preventDefault();
                const assetId = e.target.dataset.assetId;
                deleteAsset(assetId);
            } else {
                addAssetNode(asset);
            }
        });
        
        list.appendChild(item);
    });
}

function uploadAsset() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/assets/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                await loadAssets();
            } else {
                alert('上传失败: ' + data.error);
            }
        } catch (err) {
            alert('上传失败: ' + err.message);
        }
    };
    input.click();
}

async function deleteAsset(assetId) {
    try {
        const res = await fetch(`/api/assets/${assetId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            await loadAssets();
        } else {
            alert('删除失败: ' + data.error);
        }
    } catch (err) {
        alert('删除失败: ' + err.message);
    }
}

function generateId() {
    return 'node_' + Math.random().toString(36).substr(2, 9);
}

function getCanvasCenter() {
    const rect = canvasContainer.getBoundingClientRect();
    const centerX = (rect.width / 2 - state.canvasPos.x) / state.scale;
    const centerY = (rect.height / 2 - state.canvasPos.y) / state.scale;
    return { x: centerX - 125, y: centerY - 100 };
}

function addAssetNode(asset) {
    const center = getCanvasCenter();
    const node = {
        id: generateId(),
        type: 'asset',
        x: center.x + Math.random() * 60 - 30,
        y: center.y + Math.random() * 60 - 30,
        assetId: asset.id,
        assetUrl: asset.url,
        assetType: asset.type,
        assetName: asset.name
    };
    state.nodes.push(node);
    renderNode(node);
    saveWorkflow();
}

function addTextImageNode() {
    const center = getCanvasCenter();
    const node = {
        id: generateId(),
        type: 'image-gen',
        x: center.x + Math.random() * 60 - 30,
        y: center.y + Math.random() * 60 - 30,
        prompt: '',
        size: '1024x768',
        platform: 'agnes',
        outputAsset: null,
        status: 'idle'
    };
    state.nodes.push(node);
    renderNode(node);
    saveWorkflow();
}

function addVideoEditNode() {
    const center = getCanvasCenter();
    const node = {
        id: generateId(),
        type: 'video-edit',
        x: center.x + Math.random() * 60 - 30,
        y: center.y + Math.random() * 60 - 30,
        mode: 'cut',
        cutStart: '0',
        cutEnd: '10',
        subtitles: [{ text: '', start: '0', end: '5', use_tts: false }],
        voice: 'zh-CN-YunjianNeural',
        voices: [],
        outputAsset: null,
        status: 'idle'
    };
    loadVoices(node.id);
    state.nodes.push(node);
    renderNode(node);
    saveWorkflow();
}

async function loadVoices(nodeId) {
    try {
        const res = await fetch('/api/video/voices');
        const data = await res.json();
        if (data.success) {
            const node = state.nodes.find(n => n.id === nodeId);
            if (node) {
                node.voices = data.voices;
                renderNode(node);
            }
        }
    } catch (e) {
        console.error('Load voices failed:', e);
    }
}

function createNextNode(sourceNodeId, type) {
    const sourceNode = state.nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return;
    
    const node = {
        id: generateId(),
        type: type === 'image' ? 'image-gen' : 'video-gen',
        x: sourceNode.x + 300,
        y: sourceNode.y,
        prompt: '',
        size: '1024x768',
        outputAsset: null,
        status: 'idle'
    };
    
    state.nodes.push(node);
    
    const conn = {
        id: 'conn_' + Math.random().toString(36).substr(2, 9),
        from: sourceNode.id,
        to: node.id
    };
    state.connections.push(conn);
    
    renderNode(node);
    renderConnections();
}

function startConnect(fromNodeId) {
    state.connecting = { fromNodeId };
    canvas.style.cursor = 'crosshair';
    
    const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempLine.classList.add('connection-line', 'temp');
    tempLine.id = 'temp-connection-line';
    connectionsSvg.appendChild(tempLine);
}

function onConnectMouseMove(e) {
    if (!state.connecting) return;
    
    const tempLine = document.getElementById('temp-connection-line');
    if (!tempLine) return;
    
    const fromNode = state.nodes.find(n => n.id === state.connecting.fromNodeId);
    if (!fromNode) return;
    
    const fromPos = getPortPosition(fromNode.id, 'output');
    const canvasRect = canvasContainer.getBoundingClientRect();
    const toX = (e.clientX - canvasRect.left - state.canvasPos.x) / state.scale;
    const toY = (e.clientY - canvasRect.top - state.canvasPos.y) / state.scale;
    
    const path = createBezierPath(fromPos.x, fromPos.y, toX, toY);
    tempLine.setAttribute('d', path);
}

function endConnect() {
    if (!state.connecting) return;
    
    const tempLine = document.getElementById('temp-connection-line');
    if (tempLine) tempLine.remove();
    
    state.connecting = null;
    canvas.style.cursor = '';
}

function tryConnectTo(targetNodeId) {
    if (!state.connecting) return false;
    if (state.connecting.fromNodeId === targetNodeId) return false;
    
    const fromNode = state.nodes.find(n => n.id === state.connecting.fromNodeId);
    const toNode = state.nodes.find(n => n.id === targetNodeId);
    if (!fromNode || !toNode) return false;
    
    if (toNode.type === 'asset') return false;
    
    const exists = state.connections.some(c => c.from === fromNode.id && c.to === toNode.id);
    if (exists) return false;
    
    if (toNode.type === 'image-gen') {
        const existingInput = state.connections.some(c => c.to === toNode.id);
        if (existingInput) {
            alert('图像生成节点只能有一个输入');
            return false;
        }
    }
    
    const conn = {
        id: 'conn_' + Math.random().toString(36).substr(2, 9),
        from: fromNode.id,
        to: toNode.id
    };
    state.connections.push(conn);
    renderConnections();
    renderNode(toNode);
    
    return true;
}

function renderNode(node) {
    let el = document.getElementById(node.id);
    if (!el) {
        el = document.createElement('div');
        el.id = node.id;
        el.className = `node ${node.type}`;
        canvas.appendChild(el);
        
        el.addEventListener('click', (e) => {
            if (state.connecting) {
                e.stopPropagation();
                tryConnectTo(node.id);
                endConnect();
            }
        });
    }
    
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    
    let headerIcon, headerTitle;
    if (node.type === 'asset') {
        headerIcon = '📦';
        headerTitle = '资产';
    } else if (node.type === 'image-gen') {
        headerIcon = '🖼️';
        headerTitle = '图像生成';
    } else if (node.type === 'video-edit') {
        headerIcon = '✂️';
        headerTitle = '视频编辑';
    } else {
        headerIcon = '🎬';
        headerTitle = '视频生成';
    }
    
    const inputCount = state.connections.filter(c => c.to === node.id).length;
    
    let bodyHtml = '';
    
    if (node.type === 'asset') {
        const isImage = node.assetType === 'image';
        bodyHtml = `
            <div class="node-preview" ondblclick="event.stopPropagation();showAssetPreview('${node.assetUrl}', '${node.assetType}')">
                ${isImage 
                    ? `<img src="${node.assetUrl}" alt="${node.assetName}" onerror="this.parentElement.innerHTML='<div class=\'img-error\'>图片加载失败</div>'">`
                    : `<div style="position:relative;width:100%;height:100%;">
                         <video src="${node.assetUrl}" muted style="width:100%;height:100%;object-fit:cover;"></video>
                         <div class="video-play-btn" onclick="playVideo(event, '${node.assetUrl}')">▶</div>
                       </div>`
                }
            </div>
            <div style="font-size:11px;color:#666;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:8px;">${node.assetName}</div>
            <div class="node-action-btns">
                ${isImage ? `<button class="action-btn action-btn-blue" onclick="event.stopPropagation();createNextNode('${node.id}', 'image')">🖼️ 生成图像</button>` : ''}
                ${isImage ? `<button class="action-btn action-btn-pink" onclick="event.stopPropagation();createNextNode('${node.id}', 'video')">🎬 生成视频</button>` : ''}
            </div>
        `;
    } else if (node.type === 'image-gen') {
        const hasInput = inputCount > 0;
        
        let inputAssetHtml = '';
        if (hasInput) {
            const inputConn = state.connections.find(c => c.to === node.id);
            if (inputConn) {
                const srcNode = state.nodes.find(n => n.id === inputConn.from);
                if (srcNode) {
                    let imgUrl = null;
                    let name = '';
                    if (srcNode.type === 'asset' && srcNode.assetType === 'image') {
                        imgUrl = srcNode.assetUrl;
                        name = srcNode.assetName;
                    } else if (srcNode.outputAsset && srcNode.outputAsset.type === 'image') {
                        imgUrl = srcNode.outputAsset.url;
                        name = '生成图';
                    }
                    if (imgUrl) {
                        inputAssetHtml = `
                            <div class="input-asset-bar">
                                <div class="input-asset-item" title="${name}">
                                    <img src="${imgUrl}" alt="input" onerror="this.parentElement.innerHTML='<div class=\'img-error\'>加载失败</div>'">
                                    <div class="input-asset-label">输入素材</div>
                                </div>
                            </div>
                        `;
                    }
                }
            }
        }
        
        bodyHtml = `
            <div style="font-size:11px;color:#999;margin-bottom:6px;">输入: ${hasInput ? '1 张图' : '无（文生图）'}</div>
            ${inputAssetHtml}
            <div class="node-preview" ${node.outputAsset ? `ondblclick="event.stopPropagation();showAssetPreview('${node.outputAsset.url}', '${node.outputAsset.type}')"` : ''}>
                ${node.outputAsset
                    ? `<img src="${node.outputAsset.url}" alt="generated" onerror="this.parentElement.innerHTML='<div class=\'img-error\'>图片加载失败</div>'">`
                    : '<div class="placeholder">生成结果预览</div>'
                }
            </div>
            <div class="prompt-row">
                <textarea class="node-prompt-input" placeholder="输入提示词..." onclick="event.stopPropagation()" oninput="updateNodePrompt('${node.id}', this.value)">${node.prompt || ''}</textarea>
            </div>
            <div class="model-select-row">
                <label>平台:</label>
                <select class="model-select" onclick="event.stopPropagation()" onchange="updateImagePlatform('${node.id}', this.value)">
                    <option value="agnes" ${node.platform === 'qwen' ? '' : 'selected'}>Agnes</option>
                    <option value="qwen" ${node.platform === 'qwen' ? 'selected' : ''}>千问</option>
                </select>
            </div>
            ${node.platform === 'qwen' ? `
            <div class="model-select-row">
                <label>千问模型:</label>
                <select class="model-select" onclick="event.stopPropagation()" onchange="updateQwenImageModel('${node.id}', this.value)">
                    ${getQwenImageModelOptions(node.qwenImageModel)}
                </select>
            </div>
            ` : ''}
            <button class="generate-btn" data-action="generate-image" data-node-id="${node.id}" ${node.status === 'generating' ? 'disabled' : ''}>
                ${node.status === 'generating' ? '生成中...' : (node.outputAsset ? '重新生成' : (hasInput ? '图生图' : '文生图'))}
            </button>
            <div class="progress-bar ${node.status === 'generating' ? 'active' : ''}">
                <div class="progress-fill" style="width: ${node.progress || 0}%"></div>
            </div>
            ${node.status === 'generating' ? '<div class="status-text">生成中，请稍候...</div>' : ''}
            ${node.outputAsset ? `
            <div class="node-action-btns" style="margin-top:8px;">
                <button class="action-btn action-btn-blue" onclick="event.stopPropagation();createNextNode('${node.id}', 'image')">🖼️ 生成图像</button>
                <button class="action-btn action-btn-pink" onclick="event.stopPropagation();createNextNode('${node.id}', 'video')">🎬 生成视频</button>
            </div>` : ''}
        `;
    } else if (node.type === 'video-gen') {
        const inputConns = state.connections.filter(c => c.to === node.id);
        const keyframes = [];
        for (const conn of inputConns) {
            const srcNode = state.nodes.find(n => n.id === conn.from);
            if (srcNode) {
                let imgUrl = null;
                let name = '';
                if (srcNode.type === 'asset' && srcNode.assetType === 'image') {
                    imgUrl = srcNode.assetUrl;
                    name = srcNode.assetName;
                } else if (srcNode.outputAsset && srcNode.outputAsset.type === 'image') {
                    imgUrl = srcNode.outputAsset.url;
                    name = '生成图';
                }
                if (imgUrl) {
                    keyframes.push({ url: imgUrl, name, nodeId: srcNode.id });
                }
            }
        }
        
        let keyframesHtml = '';
        if (keyframes.length > 0) {
            keyframesHtml = '<div class="keyframes-bar">';
            keyframes.forEach((kf, idx) => {
                keyframesHtml += `
                    <div class="keyframe-item" title="${kf.name}">
                        <img src="${kf.url}" alt="keyframe ${idx + 1}">
                        <div class="keyframe-label">帧 ${idx + 1}</div>
                    </div>
                `;
            });
            keyframesHtml += '</div>';
        }
        
        const canResume = node.taskId && !node.outputAsset && node.status !== 'generating';
        const qwenModelOptions = getQwenModelOptions(node.qwenModel);
        
        bodyHtml = `
            <div style="font-size:11px;color:#999;margin-bottom:6px;">关键帧: ${inputCount} 张</div>
            ${keyframesHtml}
            <div class="node-preview" ${node.outputAsset ? `ondblclick="event.stopPropagation();showAssetPreview('${node.outputAsset.url}', '${node.outputAsset.type}')"` : ''}>
                ${node.outputAsset 
                    ? `<div style="position:relative;width:100%;height:100%;">
                         <video src="${node.outputAsset.url}" muted style="width:100%;height:100%;object-fit:cover;"></video>
                         <div class="video-play-btn" onclick="event.stopPropagation();playVideo(event, '${node.outputAsset.url}')">▶</div>
                       </div>`
                    : '<div class="placeholder">视频生成结果</div>'
                }
            </div>
            <div class="prompt-row">
                <textarea class="node-prompt-input" placeholder="输入视频描述... 可用 [帧1] [帧2] 标记关键帧" onclick="event.stopPropagation()" oninput="updateNodePrompt('${node.id}', this.value)">${node.prompt || ''}</textarea>
            </div>
            <div class="model-select-row">
                <label>平台:</label>
                <select class="model-select" onclick="event.stopPropagation()" onchange="updateVideoModel('${node.id}', this.value)">
                    <option value="agnes" ${node.model === 'qwen' ? '' : 'selected'}>Agnes Video</option>
                    <option value="qwen" ${node.model === 'qwen' ? 'selected' : ''}>千问</option>
                </select>
            </div>
            ${node.model === 'qwen' ? `
            <div class="model-select-row">
                <label>千问模型:</label>
                <select class="model-select" onclick="event.stopPropagation()" onchange="updateQwenModel('${node.id}', this.value)">
                    ${qwenModelOptions}
                </select>
            </div>
            ` : ''}
            <button class="generate-btn" data-action="generate-video" data-node-id="${node.id}" ${node.status === 'generating' ? 'disabled' : ''}>
                ${node.status === 'generating' ? '生成中...' : '生成视频'}
            </button>
            ${canResume ? `<button class="resume-btn" onclick="event.stopPropagation();resumeVideoPoll('${node.id}')">继续查询进度</button>` : ''}
            ${node.status === 'generating' && node.prevOutputAsset ? `<button class="cancel-btn" onclick="event.stopPropagation();cancelVideoGeneration('${node.id}')">取消生成</button>` : ''}
            <div class="progress-bar ${node.status === 'generating' ? 'active' : ''}">
                <div class="progress-fill" style="width: ${node.progress || 0}%"></div>
            </div>
            ${node.status === 'generating' ? `<div class="status-text">${node.statusText || '生成中...'}</div>` : ''}
        `;
    } else if (node.type === 'video-edit') {
        const inputConns = state.connections.filter(c => c.to === node.id);
        const inputVideos = [];
        for (const conn of inputConns) {
            const srcNode = state.nodes.find(n => n.id === conn.from);
            if (srcNode) {
                let videoUrl = null;
                let name = '';
                if (srcNode.type === 'asset' && srcNode.assetType === 'video') {
                    videoUrl = srcNode.assetUrl;
                    name = srcNode.assetName;
                } else if (srcNode.outputAsset && srcNode.outputAsset.type === 'video') {
                    videoUrl = srcNode.outputAsset.url;
                    name = '生成视频';
                }
                if (videoUrl) {
                    inputVideos.push({ url: videoUrl, name, nodeId: srcNode.id });
                }
            }
        }
        
        let inputVideosHtml = '';
        let videoDurationHtml = '';
        if (inputVideos.length > 0) {
            inputVideosHtml = '<div class="keyframes-bar">';
            inputVideos.forEach((v, idx) => {
                inputVideosHtml += `
                    <div class="keyframe-item" title="${v.name}">
                        <div style="width:60px;height:45px;background:#f0f0f0;border-radius:4px;border:1px solid #e0e0e0;display:flex;align-items:center;justify-content:center;">🎬</div>
                        <div class="keyframe-label">视频 ${idx + 1}</div>
                    </div>
                `;
            });
            inputVideosHtml += '</div>';
            const firstVideoUrl = inputVideos[0].url;
            videoDurationHtml = `<div class="video-duration-info" data-url="${firstVideoUrl}"><span class="duration-label">视频时长:</span> <span class="duration-value">加载中...</span></div>`;
        }
        
        let subtitlesHtml = '';
        if (node.mode === 'subtitle') {
            subtitlesHtml = '<div class="subtitles-list">';
            node.subtitles.forEach((sub, idx) => {
                const subVoice = sub.voice || node.voice || 'zh-CN-YunjianNeural';
                const subVoiceOptions = node.voices.map(v => 
                    `<option value="${v.name}" ${v.name === subVoice ? 'selected' : ''}>${v.description}</option>`
                ).join('');
                
                subtitlesHtml += `
                    <div class="subtitle-item">
                        <input type="text" class="subtitle-text" placeholder="字幕内容" value="${sub.text || ''}" 
                            onclick="event.stopPropagation()" 
                            oninput="updateSubtitleText('${node.id}', ${idx}, this.value)">
                        <div class="subtitle-time">
                            <input type="text" class="subtitle-time-input" placeholder="开始" value="${sub.start || '0'}" 
                                onclick="event.stopPropagation()" 
                                oninput="updateSubtitleTime('${node.id}', ${idx}, 'start', this.value)">
                            <span>-</span>
                            <input type="text" class="subtitle-time-input" placeholder="结束" value="${sub.end || '5'}" 
                                onclick="event.stopPropagation()" 
                                oninput="updateSubtitleTime('${node.id}', ${idx}, 'end', this.value)">
                        </div>
                        <label class="subtitle-tts">
                            <input type="checkbox" ${sub.use_tts ? 'checked' : ''} 
                                onclick="event.stopPropagation();toggleSubtitleTTS('${node.id}', ${idx})">
                            TTS播报
                        </label>
                        ${sub.use_tts ? `
                            <select class="subtitle-voice-select" onclick="event.stopPropagation()" onchange="updateSubtitleVoice('${node.id}', ${idx}, this.value)">
                                ${subVoiceOptions}
                            </select>
                            <input type="number" class="subtitle-rate-input" min="0.5" max="2" step="0.1" 
                                value="${sub.rate || 1}" placeholder="语速"
                                onclick="event.stopPropagation()" 
                                onchange="updateSubtitleRate('${node.id}', ${idx}, this.value)">
                        ` : ''}
                        <button class="subtitle-delete" onclick="event.stopPropagation();removeSubtitle('${node.id}', ${idx})">×</button>
                    </div>
                `;
            });
            subtitlesHtml += `</div><button class="add-subtitle-btn" onclick="event.stopPropagation();addSubtitle('${node.id}')">+ 添加字幕</button>`;
        }
        
        const voicesOptions = node.voices.map(v => 
            `<option value="${v.name}" ${v.name === node.voice ? 'selected' : ''}>${v.description}</option>`
        ).join('');
        
        bodyHtml = `
            <div style="font-size:11px;color:#999;margin-bottom:6px;">输入视频: ${inputVideos.length} 个</div>
            ${inputVideosHtml}
            ${videoDurationHtml}
            <div class="node-preview" ${node.outputAsset ? `ondblclick="event.stopPropagation();showAssetPreview('${node.outputAsset.url}', '${node.outputAsset.type}')"` : ''}>
                ${node.outputAsset
                    ? `<div style="position:relative;width:100%;height:100%;">
                         <video src="${node.outputAsset.url}" muted style="width:100%;height:100%;object-fit:cover;"></video>
                         <div class="video-play-btn" onclick="event.stopPropagation();playVideo(event, '${node.outputAsset.url}')">▶</div>
                       </div>`
                    : '<div class="placeholder">编辑结果预览</div>'
                }
            </div>
            <div class="video-edit-mode">
                <button class="mode-btn ${node.mode === 'cut' ? 'active' : ''}" onclick="event.stopPropagation();setVideoEditMode('${node.id}', 'cut')">✂️ 剪辑</button>
                <button class="mode-btn ${node.mode === 'concat' ? 'active' : ''}" onclick="event.stopPropagation();setVideoEditMode('${node.id}', 'concat')">🔗 拼接</button>
                <button class="mode-btn ${node.mode === 'subtitle' ? 'active' : ''}" onclick="event.stopPropagation();setVideoEditMode('${node.id}', 'subtitle')">📝 字幕</button>
            </div>
            ${node.mode === 'cut' ? `
                <div class="cut-settings">
                    <div class="cut-row">
                        <label>开始时间:</label>
                        <input type="text" class="cut-input" value="${node.cutStart || '0'}" onclick="event.stopPropagation()" oninput="updateCutTime('${node.id}', 'start', this.value)">
                    </div>
                    <div class="cut-row">
                        <label>结束时间:</label>
                        <input type="text" class="cut-input" value="${node.cutEnd || '10'}" onclick="event.stopPropagation()" oninput="updateCutTime('${node.id}', 'end', this.value)">
                    </div>
                </div>
            ` : ''}
            ${node.mode === 'subtitle' ? `
                <div class="subtitle-settings">
                    ${subtitlesHtml}
                </div>
            ` : ''}
            <button class="generate-btn" onclick="event.stopPropagation();processVideoEdit('${node.id}')" ${node.status === 'processing' ? 'disabled' : ''}>
                ${node.status === 'processing' ? '处理中...' : '执行编辑'}
            </button>
            <div class="progress-bar ${node.status === 'processing' ? 'active' : ''}">
                <div class="progress-fill" style="width: ${node.progress || 0}%"></div>
            </div>
            ${node.status === 'processing' ? '<div class="status-text">处理中，请稍候...</div>' : ''}
        `;
    }
    
    const canOutput = node.type === 'asset' || (node.outputAsset && node.status !== 'generating' && node.status !== 'processing');
    const hasInputConn = state.connections.some(c => c.to === node.id);
    const canInput = (node.type === 'video-gen') || (node.type === 'image-gen') || (node.type === 'video-edit');
    
    el.innerHTML = `
        <div class="node-header" onmousedown="startDragNode(event, '${node.id}')">
            <span>${headerIcon}</span>
            <span>${headerTitle}</span>
        </div>
        <button class="delete-btn" onclick="event.stopPropagation();deleteNode('${node.id}')">×</button>
        <div class="node-body">
            ${bodyHtml}
        </div>
        ${canInput ? `<div class="port port-input" title="点击删除连接" onclick="event.stopPropagation();deleteNodeConnections('${node.id}')"></div>` : ''}
        ${canOutput ? `<div class="port port-output" title="按住拖动连线到其他节点" onmousedown="event.stopPropagation();startConnect('${node.id}')">+</div>` : ''}
    `;
    scheduleSave();

    if (node.type === 'video-edit') {
        loadVideoDuration(node.id);
    }

    const genBtn = el.querySelector('[data-action="generate-video"]');
    if (genBtn) {
        genBtn.addEventListener('click', async function(e) {
            e.stopPropagation();
            e.preventDefault();
            const nid = this.getAttribute('data-node-id');
            console.log('[生成按钮点击] 节点ID:', nid);
            try {
                await generateVideo(nid);
            } catch (err) {
                console.error('[生成错误]', err);
                alert('生成错误: ' + err.message);
            }
        });
    }

    const imgGenBtn = el.querySelector('[data-action="generate-image"]');
    if (imgGenBtn) {
        imgGenBtn.addEventListener('click', async function(e) {
            e.stopPropagation();
            e.preventDefault();
            const nid = this.getAttribute('data-node-id');
            console.log('[图像生成按钮点击] 节点ID:', nid);
            try {
                await generateImage(nid);
            } catch (err) {
                console.error('[图像生成错误]', err);
                alert('生成错误: ' + err.message);
            }
        });
    }
}

function loadVideoDuration(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const el = document.getElementById(nodeId);
    if (!el) return;
    
    const durationInfo = el.querySelector('.video-duration-info');
    if (!durationInfo) return;
    
    const url = durationInfo.dataset.url;
    if (!url) return;
    
    const video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';
    
    video.onloadedmetadata = function() {
        const duration = video.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        const durationText = `${minutes}分${seconds}秒 (${duration.toFixed(1)}秒)`;
        const valueSpan = durationInfo.querySelector('.duration-value');
        if (valueSpan) {
            valueSpan.textContent = durationText;
        }
        video.remove();
    };
    
    video.onerror = function() {
        const valueSpan = durationInfo.querySelector('.duration-value');
        if (valueSpan) {
            valueSpan.textContent = '获取失败';
        }
        video.remove();
    };
}

function updateNodePrompt(nodeId, value) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (node) {
        node.prompt = value;
        scheduleSave();
    }
}

function saveWorkflow() {
    const data = {
        nodes: state.nodes,
        connections: state.connections,
        canvasPos: state.canvasPos,
        scale: state.scale
    };
    localStorage.setItem('agnes_workflow', JSON.stringify(data));
}

function loadWorkflow() {
    const saved = localStorage.getItem('agnes_workflow');
    if (!saved) return false;
    
    try {
        const data = JSON.parse(saved);
        state.nodes = data.nodes || [];
        state.connections = data.connections || [];
        state.canvasPos = data.canvasPos || { x: 0, y: 0 };
        state.scale = data.scale || 1;
        
        state.nodes.forEach(node => renderNode(node));
        updateCanvasTransform();
        renderConnections();
        
        state.nodes.forEach(node => {
            if (node.type === 'video-gen' && node.taskId && !node.outputAsset) {
                node.status = 'generating';
                node.statusText = '查询任务状态...';
                renderNode(node);
                // 先验证任务是否有效（一次性检查，不轮询）
                verifyAndPollVideo(node);
            }
            if (node.type === 'image-gen' && node.taskId && !node.outputAsset) {
                node.status = 'generating';
                node.statusText = '查询任务状态...';
                renderNode(node);
                verifyAndPollImage(node);
            }
        });
        
        refreshAllVoices();
        
        return true;
    } catch (e) {
        console.error('Load workflow failed:', e);
        return false;
    }
}

async function refreshAllVoices() {
    try {
        const res = await fetch('/api/video/voices');
        const data = await res.json();
        if (data.success) {
            state.nodes.forEach(node => {
                if (node.type === 'video-edit') {
                    node.voices = data.voices;
                    renderNode(node);
                }
            });
        }
    } catch (e) {
        console.error('Refresh voices failed:', e);
    }
}

function resumeVideoPoll(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !node.taskId) return;
    
    node.status = 'generating';
    node.statusText = '查询中...';
    renderNode(node);
    pollVideoStatus(nodeId);
}

async function generateImage(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !node.prompt.trim()) {
        alert('请先输入提示词');
        return;
    }

    const inputConn = state.connections.find(c => c.to === node.id);
    let referenceAssetId = null;
    if (inputConn) {
        const sourceNode = state.nodes.find(n => n.id === inputConn.from);
        if (sourceNode && sourceNode.type === 'asset' && sourceNode.assetType === 'image') {
            referenceAssetId = sourceNode.assetId;
        } else if (sourceNode && sourceNode.outputAsset) {
            referenceAssetId = sourceNode.outputAsset.id;
        }
    }

    const platform = node.platform || 'agnes';
    const prevOutputAsset = node.outputAsset;
    node.outputAsset = null;
    node.status = 'generating';
    node.progress = 0;
    node.statusText = '提交任务中...';
    renderNode(node);

    try {
        const bodyData = {
            api_key: getApiKey(),
            qwen_api_key: getQwenKey(),
            prompt: node.prompt,
            size: node.size,
            reference_asset_id: referenceAssetId,
            platform: platform
        };
        if (platform === 'qwen') {
            bodyData.qwen_image_model = node.qwenImageModel || 'wan2.7-image-pro';
        }

        const res = await fetch('/api/generate/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });
        const data = await res.json();
        if (data.success) {
            if (data.asset) {
                // Agnes 同步返回
                node.outputAsset = data.asset;
                node.status = 'idle';
                node.progress = 100;
                node.statusText = '完成';
                renderNode(node);
                await loadAssets();
            } else if (data.task_id) {
                // 千问异步任务
                node.taskId = data.task_id;
                node.platform = platform;
                node.statusText = '排队中...';
                renderNode(node);
                pollImageStatus(nodeId);
            }
        } else {
            node.outputAsset = prevOutputAsset;
            node.statusText = data.error || '生成失败';
            renderNode(node);
            alert('生成失败: ' + formatError(data.error));
            node.status = 'idle';
            renderNode(node);
        }
    } catch (e) {
        node.outputAsset = prevOutputAsset;
        node.statusText = e.message || '网络错误';
        renderNode(node);
        alert('生成失败: ' + formatError(e.message));
        node.status = 'idle';
        renderNode(node);
    }
}

async function pollImageStatus(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !node.taskId) return;

    const poll = async () => {
        if (node.status !== 'generating') return;

        try {
            const headers = { 'X-Model': 'qwen' };
            headers['X-Qwen-API-Key'] = getQwenKey();
            const res = await fetch(`/api/generate/image/${node.taskId}`, {
                headers: headers
            });
            const data = await res.json();

            if (data.success) {
                if (data.status === 'completed') {
                    const imageUrl = data.image_url;
                    if (imageUrl) {
                        // 从 imageUrl 提取文件名作为 asset
                        const filename = imageUrl.split('/').pop().split('?')[0] || `qwen_${node.taskId}.png`;
                        node.outputAsset = {
                            id: 'qwen_' + node.taskId,
                            type: 'image',
                            url: imageUrl,
                            name: filename
                        };
                    }
                    node.status = 'idle';
                    node.progress = 100;
                    node.statusText = '完成';
                    renderNode(node);
                    await loadAssets();
                    return;
                } else if (data.status === 'failed') {
                    alert('图片生成失败: ' + (data.error || '未知错误'));
                    node.status = 'idle';
                    renderNode(node);
                    return;
                } else if (data.status === 'in_progress') {
                    node.statusText = `生成中... ${data.progress || 0}%`;
                } else if (data.status === 'queued') {
                    node.statusText = '排队中...';
                } else if (data.status === 'pending') {
                    node.statusText = '等待中...';
                }
                renderNode(node);
                setTimeout(poll, 3000);
            } else {
                const errMsg = data.error || '';
                if (errMsg.includes('400') || errMsg.includes('Bad Request') ||
                    errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Forbidden') ||
                    errMsg.includes('404') || errMsg.includes('Not Found') ||
                    errMsg.includes('expired') || errMsg.includes('expire')) {
                    node.statusText = '任务已过期或无效，请重新生成';
                    node.status = 'idle';
                    delete node.taskId;
                    renderNode(node);
                    saveWorkflow();
                    return;
                }
                node.statusText = `接口错误: ${errMsg || '未知错误'}`;
                renderNode(node);
                setTimeout(poll, 5000);
            }
        } catch (e) {
            node.statusText = `请求失败(${e.message})，重试中...`;
            renderNode(node);
            setTimeout(poll, 5000);
        }
    };
    poll();
}

function updateVideoModel(nodeId, model) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.model = model;
    renderNode(node);
    scheduleSave();
}

function updateImagePlatform(nodeId, platform) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.platform = platform;
    renderNode(node);
    scheduleSave();
}

async function generateVideo(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    console.log('[生成] 节点:', nodeId, '模型:', node?.model, '千问模型:', node?.qwenModel);
    if (!node) {
        alert('节点不存在');
        return;
    }
    const promptText = (node.prompt || '').trim();
    if (!promptText) {
        alert('请先输入视频描述');
        return;
    }
    
    const inputConns = state.connections.filter(c => c.to === node.id);
    const imageAssetIds = [];
    for (const conn of inputConns) {
        const sourceNode = state.nodes.find(n => n.id === conn.from);
        if (sourceNode) {
            if (sourceNode.type === 'asset' && sourceNode.assetType === 'image') {
                imageAssetIds.push(sourceNode.assetId);
            } else if (sourceNode.outputAsset && sourceNode.outputAsset.type === 'image') {
                imageAssetIds.push(sourceNode.outputAsset.id);
            }
        }
    }
    
    node.prevOutputAsset = node.outputAsset;
    node.status = 'generating';
    node.progress = 0;
    node.statusText = '提交任务中...';
    renderNode(node);
    
    try {
        const bodyData = {
            api_key: getApiKey(),
            qwen_api_key: getQwenKey(),
            prompt: promptText,
            image_asset_ids: imageAssetIds,
            num_frames: 241,
            frame_rate: 24,
            model: node.model || 'agnes'
        };
        if (node.model === 'qwen') {
            bodyData.qwen_model = node.qwenModel || 'wan2.7-i2v-2026-04-25';
        }
        
        const res = await fetch('/api/generate/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });
        const data = await res.json();
        if (data.success) {
            node.taskId = data.task_id;
            node.statusText = '排队中...';
            renderNode(node);
            pollVideoStatus(nodeId);
        } else {
            const errMsg = '生成失败: ' + formatError(data.error);
            node.statusText = data.error || '生成失败';
            renderNode(node);
            alert(errMsg);
            node.status = 'idle';
            renderNode(node);
        }
    } catch (e) {
        const errMsg = '生成失败: ' + formatError(e.message);
        node.statusText = e.message || '网络错误';
        renderNode(node);
        alert(errMsg);
        node.status = 'idle';
        renderNode(node);
    }
}

async function verifyAndPollVideo(node) {
    // 先做一次性健康检查
    try {
        const headers = {};
        if (node.model === 'qwen') {
            headers['X-Qwen-API-Key'] = getQwenKey();
            headers['X-Model'] = 'qwen';
        } else {
            headers['X-API-Key'] = getApiKey();
            headers['X-Model'] = 'agnes';
        }
        const res = await fetch(`/api/generate/video/${node.taskId}`, { headers });
        const data = await res.json();
        if (!data.success && data.expired) {
            // 任务已过期
            node.statusText = '任务已过期，请重新生成';
            node.status = 'idle';
            delete node.taskId;
            renderNode(node);
            saveWorkflow();
            return;
        }
    } catch (e) {
        // 网络错误，继续轮询
    }
    // 任务有效，开始正常轮询
    pollVideoStatus(node.id);
}

async function verifyAndPollImage(node) {
    try {
        const headers = { 'X-Model': 'qwen' };
        headers['X-Qwen-API-Key'] = getQwenKey();
        const res = await fetch(`/api/generate/image/${node.taskId}`, { headers });
        const data = await res.json();
        if (!data.success && data.expired) {
            node.statusText = '任务已过期，请重新生成';
            node.status = 'idle';
            delete node.taskId;
            renderNode(node);
            saveWorkflow();
            return;
        }
    } catch (e) {
        // ignore
    }
    pollImageStatus(node.id);
}

async function pollVideoStatus(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !node.taskId) return;
    
    let pollCount = 0;
    const MAX_POLLS = 120; // 最多轮询120次(10分钟)
    const poll = async () => {
        if (node.status !== 'generating') return;
        
        pollCount++;
        console.log(`[轮询] 第${pollCount}次 - taskId: ${node.taskId}`);
        
        if (pollCount > MAX_POLLS) {
            node.statusText = '查询超时，可点击"继续查询"';
            renderNode(node);
            return;
        }
        
        try {
            const headers = {};
            if (node.model === 'qwen') {
                headers['X-Qwen-API-Key'] = getQwenKey();
                headers['X-Model'] = 'qwen';
            } else {
                headers['X-API-Key'] = getApiKey();
                headers['X-Model'] = 'agnes';
            }
            const res = await fetch(`/api/generate/video/${node.taskId}`, {
                headers: headers,
                timeout: 30000
            });
            const data = await res.json();
            
            if (data.success) {
                node.progress = data.progress || 0;
                console.log(`[轮询] 进度: ${node.progress}%, 状态: ${data.status}`);
                
                if (data.status === 'completed') {
                    node.status = 'idle';
                    node.progress = 100;
                    node.statusText = '完成';

                    if (data.video_url) {
                        // 优先使用本地URL（/api/assets/qwen_xxx），这个视频已经在后端下载到本地
                        const localUrl = `/api/assets/qwen_${node.taskId}`;
                        node.outputAsset = {
                            id: 'video_' + node.taskId,
                            type: 'video',
                            url: localUrl,
                            remote_url: data.video_url,
                            name: `qwen_video_${node.taskId}.mp4`
                        };
                    }

                    renderNode(node);
                    loadAssets();
                    console.log('[轮询] 视频生成完成');
                    return;
                } else if (data.status === 'failed') {
                    alert('视频生成失败: ' + (data.error || '未知错误'));
                    node.status = 'idle';
                    renderNode(node);
                    return;
                } else if (data.status === 'in_progress') {
                    node.statusText = `生成中... ${node.progress}%`;
                } else if (data.status === 'queued') {
                    if (data.submit_time) {
                        node.statusText = `排队中... 提交: ${data.submit_time.split(' ')[1] || data.submit_time}`;
                    } else {
                        node.statusText = '排队中...';
                    }
                } else if (data.status === 'pending') {
                    node.statusText = '等待中...';
                }
                
                renderNode(node);
                setTimeout(poll, 5000);
            } else {
                const errMsg = data.error || '';
                // 检测各种无效/过期/未授权错误，停止轮询
                if (errMsg.includes('400') || errMsg.includes('Bad Request') ||
                    errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Forbidden') ||
                    errMsg.includes('404') || errMsg.includes('Not Found') ||
                    errMsg.includes('expired') || errMsg.includes('expire') ||
                    errMsg.includes('令牌') || errMsg.includes('无效')) {
                    node.statusText = '任务已过期或无效，请重新生成';
                    node.status = 'idle';
                    delete node.taskId;
                    renderNode(node);
                    saveWorkflow();
                    return;
                }
                node.statusText = `接口错误: ${errMsg || '未知错误'}`;
                renderNode(node);
                setTimeout(poll, 5000);
            }
        } catch (e) {
            node.statusText = `请求失败(${e.message})，重试中...`;
            renderNode(node);
            setTimeout(poll, 5000);
        }
    };
    
    setTimeout(poll, 5000);
}

function playVideo(event, url) {
    event.stopPropagation();
    const video = event.currentTarget.previousElementSibling;
    if (video.paused) {
        video.play();
        event.currentTarget.style.display = 'none';
        video.onpause = () => {
            event.currentTarget.style.display = 'flex';
        };
    }
}

function showAssetPreview(url, type) {
    let previewOverlay = document.getElementById('asset-preview-overlay');
    if (!previewOverlay) {
        previewOverlay = document.createElement('div');
        previewOverlay.id = 'asset-preview-overlay';
        previewOverlay.className = 'asset-preview-overlay';
        previewOverlay.onclick = () => {
            previewOverlay.remove();
        };
        document.body.appendChild(previewOverlay);
    }
    
    if (type === 'video') {
        previewOverlay.innerHTML = `
            <video src="${url}" controls autoplay style="max-width:90%;max-height:90%;object-fit:contain;"></video>
            <div class="preview-close">×</div>
        `;
    } else {
        previewOverlay.innerHTML = `
            <img src="${url}" style="max-width:90%;max-height:90%;object-fit:contain;" />
            <div class="preview-close">×</div>
        `;
    }
    
    previewOverlay.style.display = 'flex';
}

async function deleteNode(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    
    if (node && node.status === 'generating' && node.taskId) {
        if (node.model === 'qwen') {
            try {
                const res = await fetch(`/api/qwen/cancel/${node.taskId}`, {
                    method: 'POST',
                    headers: {
                        'X-Qwen-API-Key': getQwenKey(),
                        'Content-Type': 'application/json'
                    }
                });
                const data = await res.json();
                if (data.success) {
                    console.log('取消千问任务成功:', data.message);
                } else {
                    console.log('取消千问任务失败:', data.error);
                }
            } catch (e) {
                console.log('取消千问任务异常:', e.message);
            }
        }
    }
    
    const nodeEl = document.getElementById(nodeId);
    if (nodeEl) nodeEl.remove();
    
    state.nodes = state.nodes.filter(n => n.id !== nodeId);
    state.connections = state.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    
    renderConnections();
    saveWorkflow();
}

function startDragNode(e, nodeId) {
    if (e.button !== 0) return;
    if (state.connecting) return;
    e.preventDefault();
    
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    state.draggingNode = node;
    
    const canvasRect = canvasContainer.getBoundingClientRect();
    const mouseCanvasX = (e.clientX - canvasRect.left - state.canvasPos.x) / state.scale;
    const mouseCanvasY = (e.clientY - canvasRect.top - state.canvasPos.y) / state.scale;
    
    state.dragOffset = {
        x: mouseCanvasX - node.x,
        y: mouseCanvasY - node.y
    };
    
    document.addEventListener('mousemove', onDragNode);
    document.addEventListener('mouseup', stopDragNode);
}

function onDragNode(e) {
    if (!state.draggingNode) return;
    
    const canvasRect = canvasContainer.getBoundingClientRect();
    const x = (e.clientX - canvasRect.left - state.canvasPos.x) / state.scale - state.dragOffset.x;
    const y = (e.clientY - canvasRect.top - state.canvasPos.y) / state.scale - state.dragOffset.y;
    
    state.draggingNode.x = x;
    state.draggingNode.y = y;
    
    const el = document.getElementById(state.draggingNode.id);
    if (el) {
        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }
    
    renderConnections();
}

function stopDragNode() {
    state.draggingNode = null;
    document.removeEventListener('mousemove', onDragNode);
    document.removeEventListener('mouseup', stopDragNode);
}

function createBezierPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const offset = Math.max(50, dx * 0.4);
    return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
}

function getPortPosition(nodeId, portType) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    
    const el = document.getElementById(nodeId);
    if (!el) return { x: node.x, y: node.y };
    
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    
    if (portType === 'output') {
        return {
            x: node.x + width,
            y: node.y + height / 2
        };
    } else {
        return {
            x: node.x,
            y: node.y + height / 2
        };
    }
}

function deleteNodeConnections(nodeId) {
    state.connections = state.connections.filter(c => c.to !== nodeId);
    renderConnections();
    scheduleSave();
}

function renderConnections() {
    const existingLines = connectionsSvg.querySelectorAll('.connection-line:not(.temp)');
    existingLines.forEach(line => line.remove());
    
    state.connections.forEach(conn => {
        const fromPos = getPortPosition(conn.from, 'output');
        const toPos = getPortPosition(conn.to, 'input');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('connection-line');
        path.setAttribute('d', createBezierPath(fromPos.x, fromPos.y, toPos.x, toPos.y));
        connectionsSvg.appendChild(path);
    });
    scheduleSave();
}

canvasContainer.addEventListener('mousedown', (e) => {
    if (state.connecting) {
        endConnect();
        return;
    }
    if (e.target === canvasContainer || e.target.id === 'grid-bg' || e.target.id === 'canvas' || e.target.tagName === 'svg') {
        state.panning = true;
        state.panStart = { x: e.clientX - state.canvasPos.x, y: e.clientY - state.canvasPos.y };
        canvasContainer.classList.add('grabbing');
    }
});

document.addEventListener('mousemove', (e) => {
    if (state.connecting) {
        onConnectMouseMove(e);
    }
    if (state.panning) {
        state.canvasPos.x = e.clientX - state.panStart.x;
        state.canvasPos.y = e.clientY - state.panStart.y;
        updateCanvasTransform();
    }
});

document.addEventListener('mouseup', (e) => {
    if (state.connecting) {
        const targetNode = e.target.closest('.node');
        if (targetNode) {
            tryConnectTo(targetNode.id);
        }
        endConnect();
    }
    if (state.panning) {
        state.panning = false;
        canvasContainer.classList.remove('grabbing');
    }
});

canvasContainer.addEventListener('wheel', (e) => {
    const target = e.target;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || 
        target.closest('.node-prompt-input')) {
        return;
    }
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.3, Math.min(2, state.scale * delta));
    
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    state.canvasPos.x = mouseX - (mouseX - state.canvasPos.x) * (newScale / state.scale);
    state.canvasPos.y = mouseY - (mouseY - state.canvasPos.y) * (newScale / state.scale);
    state.scale = newScale;
    
    updateCanvasTransform();
    renderConnections();
}, { passive: false });

function updateCanvasTransform() {
    canvas.style.transform = `translate(${state.canvasPos.x}px, ${state.canvasPos.y}px) scale(${state.scale})`;
}

function formatError(errorMsg) {
    if (!errorMsg) return '未知错误';
    if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('No deployments')) {
        return 'Agnes 服务器繁忙（429限流），请稍后重试，或等待几秒后再试。\n\n这是 Agnes 平台的服务器负载问题，不是代码错误。';
    }
    if (errorMsg.includes('503') || errorMsg.includes('Service Unavailable')) {
        return 'Agnes 服务暂时不可用（503），请稍后重试。';
    }
    if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('invalid_api_key')) {
        return 'API Key 无效，请检查您的 Agnes API Key 是否正确。';
    }
    return errorMsg;
}

function init() {
    const apiKey = getApiKey();
    if (apiKey) {
        showApp();
        loadWorkflow();
    } else {
        showLogin();
    }
    
    updateCanvasTransform();
    
    // 全局错误捕获 - 诊断生成按钮回退问题
    window.addEventListener('error', function(e) {
        console.error('[全局错误]', e.message, e.filename, '行' + e.lineno);
        const node = state.nodes.find(n => n.status === 'generating');
        if (node) {
            node.statusText = '脚本错误: ' + e.message;
            node.status = 'idle';
            renderNode(node);
        }
    });
    
    window.addEventListener('unhandledrejection', function(e) {
        console.error('[未捕获Promise错误]', e.reason?.message || e.reason);
        const node = state.nodes.find(n => n.status === 'generating');
        if (node) {
            node.statusText = '请求错误: ' + (e.reason?.message || '未知');
            node.status = 'idle';
            renderNode(node);
        }
    });
}

function setVideoEditMode(nodeId, mode) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.mode = mode;
    renderNode(node);
}

function updateCutTime(nodeId, field, value) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (field === 'start') {
        node.cutStart = value;
    } else {
        node.cutEnd = value;
    }
}

function updateSubtitleText(nodeId, index, text) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !node.subtitles[index]) return;
    node.subtitles[index].text = text;
}

function updateSubtitleTime(nodeId, index, field, value) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !node.subtitles[index]) return;
    node.subtitles[index][field] = value;
}

function toggleSubtitleTTS(nodeId, index) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !node.subtitles[index]) return;
    node.subtitles[index].use_tts = !node.subtitles[index].use_tts;
    if (!node.subtitles[index].voice) {
        node.subtitles[index].voice = node.voice || 'zh-CN-YunjianNeural';
    }
    renderNode(node);
}

function updateSubtitleVoice(nodeId, index, voice) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !node.subtitles[index]) return;
    node.subtitles[index].voice = voice;
}

function updateSubtitleRate(nodeId, index, rate) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !node.subtitles[index]) return;
    node.subtitles[index].rate = parseFloat(rate);
}

function addSubtitle(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node.subtitles.push({ text: '', start: '0', end: '5', use_tts: false });
    renderNode(node);
}

function removeSubtitle(nodeId, index) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || node.subtitles.length <= 1) return;
    node.subtitles.splice(index, 1);
    renderNode(node);
}

async function cancelVideoGeneration(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    if (node.model === 'qwen' && node.taskId) {
        try {
            const res = await fetch(`/api/qwen/cancel/${node.taskId}`, {
                method: 'POST',
                headers: {
                    'X-Qwen-API-Key': getQwenKey(),
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            if (data.success) {
                console.log('取消千问任务成功:', data.message);
            } else {
                console.log('取消千问任务失败:', data.error);
            }
        } catch (e) {
            console.log('取消千问任务异常:', e.message);
        }
    }
    
    node.status = 'idle';
    node.statusText = '';
    node.progress = 0;
    
    if (node.prevOutputAsset) {
        node.outputAsset = node.prevOutputAsset;
        node.prevOutputAsset = null;
    }
    
    renderNode(node);
}

async function processVideoEdit(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const inputConns = state.connections.filter(c => c.to === node.id);
    const videoUrls = [];
    for (const conn of inputConns) {
        const srcNode = state.nodes.find(n => n.id === conn.from);
        if (srcNode) {
            if (srcNode.type === 'asset' && srcNode.assetType === 'video') {
                videoUrls.push(srcNode.assetUrl);
            } else if (srcNode.outputAsset && srcNode.outputAsset.type === 'video') {
                videoUrls.push(srcNode.outputAsset.url);
            }
        }
    }
    
    if (videoUrls.length === 0) {
        alert('请先连接至少一个视频素材');
        return;
    }
    
    if (node.mode === 'cut' && videoUrls.length > 1) {
        alert('剪辑模式只能有一个输入视频');
        return;
    }
    
    if (node.mode === 'subtitle' && videoUrls.length > 1) {
        alert('字幕模式只能有一个输入视频');
        return;
    }
    
    let params = {};
    if (node.mode === 'cut') {
        params = {
            start: node.cutStart || '0',
            end: node.cutEnd || '10'
        };
    } else if (node.mode === 'concat') {
        params = { order: videoUrls.map((_, i) => i) };
    } else if (node.mode === 'subtitle') {
        params = {
            subtitles: node.subtitles,
            voice: node.voice
        };
    }
    
    node.status = 'processing';
    node.progress = 0;
    renderNode(node);
    
    try {
        const res = await fetch('/api/video/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: getApiKey(),
                mode: node.mode,
                video_urls: videoUrls,
                params: params
            })
        });
        const data = await res.json();
        if (data.success) {
            node.outputAsset = {
                id: data.asset_id,
                type: 'video',
                url: data.url,
                name: `edited_video.mp4`
            };
            node.status = 'idle';
            node.progress = 100;
            renderNode(node);
            await loadAssets();
        } else {
            alert('视频编辑失败: ' + data.error);
            node.status = 'idle';
            renderNode(node);
        }
    } catch (e) {
        alert('视频编辑失败: ' + e.message);
        node.status = 'idle';
        renderNode(node);
    }
}

let saveTimer = null;
function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveWorkflow();
    }, 500);
}

init();
