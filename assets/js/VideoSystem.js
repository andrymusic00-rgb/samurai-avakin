const VideoSystem = (() => {
  const DB_NAME = 'SamuraiVideoDB';
  const DB_VERSION = 2;
  const STORE_NAME = 'videos';
  const CACHE_STORE = 'videoCache';
  const MAX_CACHE_SIZE = 50 * 1024 * 1024;
  
  let db = null;
  let isOnline = navigator.onLine;
  const pendingUploads = new Map();
  const uploadQueue = [];
  let isProcessingQueue = false;
  
  const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
  const MAX_FILE_SIZE = 500 * 1024 * 1024;
  const CHUNK_SIZE = 5 * 1024 * 1024;
  
  let eventHandlers = {
    onUploadProgress: null,
    onUploadComplete: null,
    onUploadError: null,
    onVideoSaved: null,
    onSyncStatusChange: null
  };
  
  function init() {
    return openDatabase().then(() => {
      setupOnlineListener();
      processPendingUploads();
      startPeriodicSync();
      return { ready: true };
    });
  }
  
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
        
        if (!database.objectStoreNames.contains(CACHE_STORE)) {
          const cacheStore = database.createObjectStore(CACHE_STORE, { keyPath: 'url' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
          cacheStore.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }
  
  function setupOnlineListener() {
    window.addEventListener('online', () => {
      isOnline = true;
      notifySyncStatusChange(true);
      processPendingUploads();
    });
    
    window.addEventListener('offline', () => {
      isOnline = false;
      notifySyncStatusChange(false);
    });
  }
  
  function notifySyncStatusChange(online) {
    if (eventHandlers.onSyncStatusChange) {
      eventHandlers.onSyncStatusChange(online);
    }
    document.dispatchEvent(new CustomEvent('video:syncStatus', { detail: { online } }));
  }
  
  function startPeriodicSync() {
    setInterval(() => {
      if (isOnline && uploadQueue.length > 0) {
        processPendingUploads();
      }
      cleanupCache();
    }, 30000);
  }
  
  function generateId() {
    return `vid_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  function validateFile(file) {
    if (!VIDEO_TYPES.includes(file.type)) {
      throw new Error(`Tipo file non supportato: ${file.type}. Supportati: MP4, WebM, MOV, AVI, MKV`);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File troppo grande: ${(file.size / 1024 / 1024).toFixed(1)}MB. Massimo: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }
    return true;
  }
  
  async function uploadVideo(file, metadata = {}) {
    validateFile(file);
    
    const videoId = generateId();
    const videoData = {
      id: videoId,
      title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
      description: metadata.description || '',
      category: metadata.category || 'video',
      tags: metadata.tags || [],
      author: metadata.author || null,
      visibility: metadata.visibility || 'public',
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      duration: metadata.duration || 0,
      thumbnail: metadata.thumbnail || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
      localPath: null,
      serverUrl: null,
      serverId: null,
      chunks: [],
      uploadProgress: 0
    };
    
    try {
      await saveToIndexedDB(videoData);
      await cacheVideoFile(videoId, file);
      
      const chunkCount = Math.ceil(file.size / CHUNK_SIZE);
      videoData.chunks = Array.from({ length: chunkCount }, (_, i) => ({
        index: i,
        start: i * CHUNK_SIZE,
        end: Math.min((i + 1) * CHUNK_SIZE, file.size),
        uploaded: false,
        retries: 0
      }));
      
      await updateVideoInDB(videoId, { chunks: videoData.chunks, uploadProgress: 0 });
      
      if (eventHandlers.onVideoSaved) {
        eventHandlers.onVideoSaved(videoData);
      }
      
      if (isOnline) {
        return uploadToServer(videoData, file);
      } else {
        queueForUpload(videoData, file);
        return { success: true, videoId, queued: true };
      }
    } catch (error) {
      if (eventHandlers.onUploadError) {
        eventHandlers.onUploadError(videoId, error);
      }
      throw error;
    }
  }
  
  async function uploadToServer(videoData, file) {
    const videoId = videoData.id;
    
    try {
      await updateVideoInDB(videoId, { uploadProgress: 0, synced: false });
      
      if (file.size <= CHUNK_SIZE) {
        return await uploadSingleChunk(videoData, file);
      } else {
        return await uploadChunked(videoData, file);
      }
    } catch (error) {
      await updateVideoInDB(videoId, { synced: false, uploadError: error.message });
      queueForUpload(videoData, file);
      throw error;
    }
  }
  
  async function uploadSingleChunk(videoData, file) {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('metadata', JSON.stringify({
      id: videoData.id,
      title: videoData.title,
      description: videoData.description,
      category: videoData.category,
      tags: videoData.tags,
      visibility: videoData.visibility
    }));
    
    return await sendUploadRequest('/api/video/upload', formData, videoData);
  }
  
  async function uploadChunked(videoData, file) {
    const totalChunks = videoData.chunks.length;
    let uploadedChunks = 0;
    
    for (const chunk of videoData.chunks) {
      if (chunk.uploaded) {
        uploadedChunks++;
        continue;
      }
      
      const blob = file.slice(chunk.start, chunk.end);
      const chunkFile = new File([blob], `${videoData.id}_chunk_${chunk.index}`, { type: file.type });
      
      const formData = new FormData();
      formData.append('chunk', chunkFile);
      formData.append('videoId', videoData.id);
      formData.append('chunkIndex', chunk.index.toString());
      formData.append('totalChunks', videoData.chunks.length.toString());
      formData.append('metadata', JSON.stringify({
        id: videoData.id,
        title: videoData.title,
        description: videoData.description,
        category: videoData.category,
        tags: videoData.tags,
        visibility: videoData.visibility
      }));
      
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          const result = await sendUploadRequest('/api/video/upload-chunk', formData, videoData);
          
          if (result.success) {
            chunk.uploaded = true;
            uploadedChunks++;
            
            const progress = Math.round((uploadedChunks / totalChunks) * 100);
            await updateVideoInDB(videoData.id, { uploadProgress: progress });
            
            if (eventHandlers.onUploadProgress) {
              eventHandlers.onUploadProgress(videoData.id, progress);
            }
            break;
          } else {
            throw new Error(result.message || 'Upload failed');
          }
        } catch (error) {
          retries++;
          chunk.retries = retries;
          if (retries >= maxRetries) throw error;
          await new Promise(r => setTimeout(r, 1000 * retries));
        }
      }
    }
    
    const finalizeForm = new FormData();
    finalizeForm.append('videoId', videoData.id);
    finalizeForm.append('totalChunks', videoData.chunks.length.toString());
    
    const finalResult = await sendUploadRequest('/api/video/finalize', finalizeForm, videoData);
    
    if (finalResult.success) {
      const updatedData = {
        ...videoData,
        synced: true,
        serverUrl: finalResult.url,
        serverId: finalResult.id,
        uploadProgress: 100,
        updatedAt: new Date().toISOString()
      };
      
      await updateVideoInDB(videoData.id, updatedData);
      await clearCachedFile(videoData.id);
      
      if (eventHandlers.onUploadComplete) {
        eventHandlers.onUploadComplete(updatedData);
      }
      
      return updatedData;
    } else {
      throw new Error(finalResult.message || 'Finalizzazione fallita');
    }
  }
  
  async function sendUploadRequest(endpoint, formData, videoData) {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Errore di rete' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  function queueForUpload(videoData, file) {
    const uploadItem = {
      videoId: videoData.id,
      videoData: { ...videoData },
      file: file,
      queuedAt: Date.now(),
      retries: 0
    };
    
    pendingUploads.set(videoData.id, uploadItem);
    uploadQueue.push(uploadItem);
    
    if (eventHandlers.onSyncStatusChange) {
      eventHandlers.onSyncStatusChange(false);
    }
  }
  
  async function processPendingUploads() {
    if (isProcessingQueue || uploadQueue.length === 0 || !isOnline) return;
    
    isProcessingQueue = true;
    
    while (uploadQueue.length > 0 && isOnline) {
      const item = uploadQueue.shift();
      pendingUploads.delete(item.videoId);
      
      try {
        await uploadToServer(item.videoData, item.file);
      } catch (error) {
        item.retries++;
        if (item.retries < 3) {
          uploadQueue.push(item);
          pendingUploads.set(item.videoId, item);
        } else {
          await updateVideoInDB(item.videoId, { 
            uploadError: error.message, 
            uploadProgress: item.videoData.uploadProgress 
          });
        }
      }
    }
    
    isProcessingQueue = false;
  }
  
  async function saveToIndexedDB(videoData) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(videoData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async function updateVideoInDB(id, updates) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) return reject(new Error('Video non trovato'));
        
        const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(putRequest.result);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }
  
  async function cacheVideoFile(videoId, file) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(CACHE_STORE);
      
      const reader = new FileReader();
      reader.onload = () => {
        const request = store.put({
          url: `video://${videoId}`,
          videoId,
          data: reader.result,
          size: file.size,
          mimeType: file.type,
          timestamp: Date.now()
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
  
  async function clearCachedFile(videoId) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(CACHE_STORE);
      const request = store.delete(`video://${videoId}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async function getVideoFromCache(videoId) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHE_STORE], 'readonly');
      const store = transaction.objectStore(CACHE_STORE);
      const request = store.get(`video://${videoId}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async function getVideoFromDB(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async function getAllVideos(filters = {}) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        let videos = request.result || [];
        
        if (filters.category) {
          videos = videos.filter(v => v.category === filters.category);
        }
        if (filters.synced !== undefined) {
          videos = videos.filter(v => v.synced === filters.synced);
        }
        if (filters.tags && filters.tags.length) {
          videos = videos.filter(v => filters.tags.some(t => v.tags?.includes(t)));
        }
        if (filters.search) {
          const search = filters.search.toLowerCase();
          videos = videos.filter(v => 
            v.title.toLowerCase().includes(search) ||
            v.description.toLowerCase().includes(search) ||
            v.tags?.some(t => t.toLowerCase().includes(search))
          );
        }
        
        videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(videos);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  async function deleteVideo(id, deleteFromServer = true) {
    await deleteFromIndexedDB(id);
    await clearCachedFile(id);
    
    if (deleteFromServer && isOnline) {
      try {
        await fetch(`/api/video/${id}`, { method: 'DELETE', credentials: 'include' });
      } catch (error) {
        console.warn('Eliminazione server fallita:', error);
      }
    }
  }
  
  async function deleteFromIndexedDB(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async function cleanupCache() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(CACHE_STORE);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');
      
      let totalSize = 0;
      const items = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          totalSize += cursor.value.size;
          items.push({ url: cursor.primaryKey, size: cursor.value.size, timestamp: cursor.value.timestamp });
          cursor.continue();
        } else {
          if (totalSize > MAX_CACHE_SIZE) {
            items.sort((a, b) => a.timestamp - b.timestamp);
            const toDelete = totalSize - MAX_CACHE_SIZE;
            let deleted = 0;
            
            const deleteTransaction = db.transaction([CACHE_STORE], 'readwrite');
            const deleteStore = deleteTransaction.objectStore(CACHE_STORE);
            
            for (const item of items) {
              if (deleted >= toDelete) break;
              deleteStore.delete(item.url);
              deleted += item.size;
            }
          }
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  function createVideoElement(videoData, options = {}) {
    const {
      showControls = true,
      autoPlay = false,
      loop = false,
      muted = false,
      poster = videoData.thumbnail,
      className = 'video-player',
      onPlay = null,
      onPause = null,
      onEnded = null,
      onError = null,
      onTimeUpdate = null
    } = options;
    
    const container = document.createElement('div');
    container.className = `video-container ${className}`;
    container.dataset.videoId = videoData.id;
    
    const video = document.createElement('video');
    video.className = 'video-element';
    video.controls = showControls;
    video.autoplay = autoPlay;
    video.loop = loop;
    video.muted = muted;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    
    if (poster) video.poster = poster;
    
    const source = document.createElement('source');
    if (videoData.serverUrl) {
      source.src = videoData.serverUrl;
    } else if (videoData.localPath) {
      source.src = videoData.localPath;
    } else {
      source.src = `video://${videoData.id}`;
    }
    source.type = videoData.mimeType || 'video/mp4';
    video.appendChild(source);
    
    video.addEventListener('play', () => onPlay?.(videoData));
    video.addEventListener('pause', () => onPause?.(videoData));
    video.addEventListener('ended', () => onEnded?.(videoData));
    video.addEventListener('error', (e) => onError?.(videoData, e));
    video.addEventListener('timeupdate', (e) => onTimeUpdate?.(videoData, video.currentTime, video.duration));
    
    container.appendChild(video);
    
    if (videoData.serverUrl) {
      video.addEventListener('loadstart', async () => {
        if (!video.src.includes('blob:')) {
          try {
            const cached = await getVideoFromCache(videoData.id);
            if (cached && cached.data) {
              const blob = new Blob([cached.data], { type: videoData.mimeType });
              const url = URL.createObjectURL(blob);
              video.src = url;
            }
          } catch (error) {
            console.warn('Cache load failed:', error);
          }
        });
    }
    
    return container;
  }
  
  function createUploadDropzone(options = {}) {
    const {
      accept = VIDEO_TYPES.join(','),
      multiple = false,
      maxFiles = 1,
      onFilesSelected = null,
      onUploadStart = null,
      onUploadProgress = null,
      onUploadComplete = null,
      onUploadError = null,
      className = 'video-dropzone'
    } = options;
    
    const container = document.createElement('div');
    container.className = `${className} glass-violet`;
    container.innerHTML = `
      <div class="dropzone-inner" style="padding:40px;text-align:center;border:2px dashed var(--glass-violet-brd);border-radius:var(--r-lg);transition:all .3s ease;background:rgba(23,37,84,0.3);position:relative;overflow:hidden">
        <div class="dropzone-icon" style="font-size:3rem;margin-bottom:12px;color:var(--violet-400);opacity:.8">🎬</div>
        <h3 style="color:var(--silver-100);margin:0 0 8px">Trascina video qui</h3>
        <p style="color:var(--silver-500);font-size:.9rem;margin:0 0 16px">o clicca per selezionare</p>
        <input type="file" class="sr-only" id="dz-input" accept="${accept}" ${multiple ? 'multiple' : ''}>
        <button class="btn btn-violet" style="margin-top:12px" id="dz-browse">Scegli file</button>
        <div class="dropzone-progress" style="display:none;margin-top:16px">
          <div class="progress-bar" style="height:4px;background:var(--grad-violet);border-radius:2px;width:0%;transition:width .3s ease"></div>
          <p class="progress-text mono" style="margin-top:8px;font-size:.8rem;color:var(--silver-400)">0%</p>
        </div>
        <div class="dropzone-files" style="display:none;margin-top:16px;text-align:left;max-height:200px;overflow:auto"></div>
      </div>
    `;
    
    const input = container.querySelector('#dz-input');
    const browseBtn = container.querySelector('#dz-browse');
    const progressBar = container.querySelector('.progress-bar');
    const progressText = container.querySelector('.progress-text');
    const filesList = container.querySelector('.dropzone-files');
    const dropzoneInner = container.querySelector('.dropzone-inner');
    
    const selectedFiles = new Map();
    
    function updateFilesList() {
      if (selectedFiles.size === 0) {
        filesList.style.display = 'none';
        filesList.innerHTML = '';
        return;
      }
      filesList.style.display = 'block';
      filesList.innerHTML = Array.from(selectedFiles.entries()).map(([id, file]) => `
        <div class="dz-file" style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--glass);border-radius:var(--r-md);margin-bottom:8px" data-id="${id}">
          <span style="font-size:1.5rem">${file.type.startsWith('video/') ? '🎬' : '📄'}</span>
          <div style="flex:1;min-width:0">
            <p style="color:var(--silver-100);margin:0;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${file.name}</p>
            <p class="mono" style="margin:2px 0 0;color:var(--silver-500);font-size:.75rem">${(file.size/1024/1024).toFixed(1)}MB</p>
          </div>
          <button class="bp-btn bp-danger" data-remove="${id}" style="padding:6px 10px">✕</button>
        </div>
      `).join('');
      
      filesList.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedFiles.delete(btn.dataset.remove);
          updateFilesList();
        });
      });
    }
    
    function validateAndAddFiles(files) {
      const validFiles = [];
      for (const file of files) {
        try {
          validateFile(file);
          if (selectedFiles.size >= maxFiles) {
            throw new Error(`Massimo ${maxFiles} file`);
          }
          const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          selectedFiles.set(id, file);
          validFiles.push({ id, file });
        } catch (error) {
          if (onUploadError) onUploadError(null, error);
        }
      }
      
      if (validFiles.length > 0) {
        updateFilesList();
        if (onFilesSelected) onFilesSelected(Array.from(selectedFiles.values()));
      }
      return validFiles;
    }
    
    browseBtn.addEventListener('click', () => input.click());
    
    input.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      validateAndAddFiles(files);
      input.value = '';
    });
    
    dropzoneInner.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneInner.style.borderColor = 'var(--violet-400)';
      dropzoneInner.style.background = 'rgba(192,132,252,0.1)';
    });
    
    dropzoneInner.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzoneInner.style.borderColor = 'var(--glass-violet-brd)';
      dropzoneInner.style.background = 'rgba(23,37,84,0.3)';
    });
    
    dropzoneInner.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneInner.style.borderColor = 'var(--glass-violet-brd)';
      dropzoneInner.style.background = 'rgba(23,37,84,0.3)';
      
      const files = Array.from(e.dataTransfer.files || []);
      validateAndAddFiles(files);
    });
    
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn btn-violet';
    uploadBtn.style.marginTop = '16px';
    uploadBtn.textContent = 'Carica video';
    uploadBtn.style.display = 'none';
    container.appendChild(uploadBtn);
    
    function updateUploadUI(show) {
      uploadBtn.style.display = show ? 'inline-block' : 'none';
    }
    
    const originalOnFilesSelected = onFilesSelected;
    function wrappedOnFilesSelected(files) {
      updateUploadUI(files.length > 0);
      originalOnFilesSelected?.(files);
    }
    
    return {
      element: container,
      addFiles: validateAndAddFiles,
      getFiles: () => Array.from(selectedFiles.values()),
      clearFiles: () => { selectedFiles.clear(); updateFilesList(); updateUploadUI(false); },
      uploadAll: async () => {
        const files = Array.from(selectedFiles.entries());
        if (files.length === 0) return;
        
        if (onUploadStart) onUploadStart(files.length);
        
        const results = [];
        for (const [id, file] of files) {
          try {
            if (onUploadProgress) onUploadProgress(id, 0);
            
            const result = await uploadVideo(file, { 
              onProgress: (progress) => onUploadProgress?.(id, progress) 
            });
            
            if (onUploadProgress) onUploadProgress(id, 100);
            if (onUploadComplete) onUploadComplete(result);
            results.push({ success: true, id, result });
            
            selectedFiles.delete(id);
          } catch (error) {
            if (onUploadError) onUploadError(id, error);
            results.push({ success: false, id, error });
          }
        }
        
        updateFilesList();
        updateUploadUI(selectedFiles.size > 0);
        return results;
      },
      on: (event, handler) => {
        eventHandlers[event] = handler;
      }
    };
  }
  
  function setEventHandlers(handlers) {
    eventHandlers = { ...eventHandlers, ...handlers };
  }
  
  function on(event, handler) {
    eventHandlers[event] = handler;
  }
  
  function off(event) {
    delete eventHandlers[event];
  }
  
  return {
    init,
    uploadVideo,
    getVideoFromDB,
    getAllVideos,
    getVideoFromCache,
    deleteVideo,
    createVideoElement,
    createUploadDropzone,
    setEventHandlers,
    on,
    off,
    isOnline: () => isOnline,
    getPendingCount: () => uploadQueue.length,
    processPendingUploads
  };
})();

if (typeof window !== 'undefined') {
  window.VideoSystem = VideoSystem;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoSystem;
}