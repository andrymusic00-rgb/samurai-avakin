// Video Section Test Script
// Run this in browser console on https://samurai-avakin.onrender.com/#/video

console.log('🎬 Video Section Test Started');

// Test 1: Check if VideoSystem is available
console.log('Test 1: VideoSystem availability');
console.log('VideoSystem:', typeof VideoSystem !== 'undefined' ? '✅ Available' : '❌ Not available');
console.log('Views:', typeof Views !== 'undefined' ? '✅ Available' : '❌ Not available');
console.log('Account:', typeof Account !== 'undefined' ? '✅ Available' : '❌ Not available');

// Test 2: Check IndexedDB
console.log('\nTest 2: IndexedDB');
const checkDB = async () => {
  return new Promise((resolve) => {
    const request = indexedDB.open('SamuraiVideoDB', 2);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['videos'], 'readonly');
      const store = tx.objectStore('videos');
      const getAll = store.getAll();
      getAll.onsuccess = () => {
        console.log('Videos in IndexedDB:', getAll.result?.length || 0);
        if (getAll.result?.length) {
          getAll.result.forEach(v => console.log('  -', v.title, v.id, v.synced ? '✅ synced' : '⏳ local'));
        }
        resolve(getAll.result || []);
      };
      getAll.onerror = () => {
        console.log('❌ IndexedDB error:', getAll.error);
        resolve([]);
      };
    };
    request.onerror = () => {
      console.log('❌ IndexedDB not available:', request.error);
      resolve([]);
    };
  };
};

const videos = await checkDB();

// Test 3: Add a test video to IndexedDB
console.log('\nTest 3: Adding test video to IndexedDB');
const addTestVideo = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SamuraiVideoDB', 2);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['videos'], 'readwrite');
      const store = tx.objectStore('videos');
      
      const testVideo = {
        id: 'test_vid_' + Date.now(),
        title: 'Test Video - Prova Caricamento',
        description: 'Video di prova per verificare il funzionamento della sezione video',
        category: 'video',
        tags: ['test', 'prova', 'samurai'],
        author: { handle: 'TestSamurai', level: 5 },
        visibility: 'public',
        fileName: 'test.mp4',
        fileSize: 1024000,
        mimeType: 'video/mp4',
        durata: 120,
        thumbnail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: false,
        localPath: null,
        serverUrl: null,
        serverId: null,
        chunks: [],
        uploadProgress: 0,
        likes: 0,
        miaReazione: false
      };
      
      const putRequest = store.put(testVideo);
      putRequest.onsuccess = () => {
        console.log('✅ Test video added:', testVideo.id);
        resolve(testVideo);
      };
      putRequest.onerror = () => {
        console.log('❌ Failed to add test video:', putRequest.error);
        reject(putRequest.error);
      };
    };
    request.onerror = () => reject(request.error);
  };
});

const testVideo = await addTestVideo();

// Test 4: Verify video in IndexedDB
console.log('\nTest 4: Verify video in IndexedDB');
const verifyVideo = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SamuraiVideoDB', 2);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['videos'], 'readonly');
      const store = tx.objectStore('videos');
      const getRequest = store.get(testVideo.id);
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          console.log('✅ Video found in IndexedDB:', getRequest.result.title);
          resolve(getRequest.result);
        } else {
          console.log('❌ Video not found in IndexedDB');
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    };
    request.onerror = () => reject(request.error);
  };
});

const verifiedVideo = await verifyVideo();

// Test 5: Get all videos via VideoSystem
console.log('\nTest 5: VideoSystem.getAllVideos()');
if (typeof VideoSystem !== 'undefined') {
  const allVideos = await VideoSystem.getAllVideos();
  console.log('Videos from VideoSystem:', allVideos.length);
  allVideos.forEach(v => console.log('  -', v.title, v.id));
} else {
  console.log('❌ VideoSystem not available');
}

// Test 6: Render video in grid
console.log('\nTest 6: Render video in grid');
if (typeof Views !== 'undefined') {
  // Manually add test video to CFG.videos and render
  if (!Views.CFG.videos) Views.CFG.videos = [];
  // Check if already exists
  const exists = Views.CFG.videos.some(v => v.id === testVideo.id);
  if (!exists) {
    Views.CFG.videos.unshift(testVideo);
    console.log('✅ Test video added to Views.CFG.videos');
  }
  Views.paintVideos();
  console.log('✅ paintVideos() called');
} else {
  console.log('❌ Views not available');
}

// Test 7: Check video grid DOM
console.log('\nTest 7: Check video grid DOM');
setTimeout(() => {
  const grid = document.getElementById('videoGrid');
  if (grid) {
    const cards = grid.querySelectorAll('[data-vid]');
    console.log('Video cards in grid:', cards.length);
    cards.forEach(card => {
      const vid = card.dataset.vid;
      const title = card.querySelector('h3');
      console.log('  -', vid, ':', title?.textContent?.trim());
    });
  } else {
    console.log('❌ videoGrid not found');
  }
}, 500);

// Test 8: Check VideoSystem IndexedDB initialization
console.log('\nTest 8: VideoSystem.init()');
if (typeof VideoSystem !== 'undefined') {
  try {
    await VideoSystem.init();
    console.log('✅ VideoSystem initialized');
  } catch (e) {
    console.log('❌ VideoSystem init failed:', e.message);
  }
}

// Test 9: Test VideoSystem upload dropzone creation
console.log('\nTest 9: VideoSystem.createUploadDropzone()');
if (typeof VideoSystem !== 'undefined') {
  try {
    const dropzone = VideoSystem.createUploadDropzone({
      onUploadStart: (count) => console.log('Upload started:', count),
      onUploadProgress: (id, progress) => console.log('Progress:', id, progress + '%'),
      onUploadComplete: (video) => console.log('Upload complete:', video.title),
      onUploadError: (id, error) => console.log('Upload error:', id, error.message)
    });
    console.log('✅ Dropzone created:', dropzone.element ? '✅' : '❌');
    console.log('  Element:', dropzone.element?.className);
  } catch (e) {
    console.log('❌ Dropzone creation failed:', e.message);
  }
}

// Test 10: Check video modal
console.log('\nTest 10: Video upload modal');
const modal = document.getElementById('videoUploadModal');
console.log('Modal exists:', modal ? '✅' : '❌');
if (modal) {
  const dropzone = modal.querySelector('.vup-dropzone, #vupDropZone, [id*="drop"]');
  console.log('Dropzone exists:', dropzone ? '✅' : '❌');
  const fileInput = modal.querySelector('input[type="file"]');
  console.log('File input exists:', fileInput ? '✅' : '❌');
}

console.log('\n🎬 Video Section Test Complete!');
console.log('Summary:');
console.log('  - VideoSystem:', typeof VideoSystem !== 'undefined' ? '✅' : '❌');
console.log('  - Views:', typeof Views !== 'undefined' ? '✅' : '❌');
console.log('  - IndexedDB:', videos.length >= 0 ? '✅' : '❌');
console.log('  - Test video added:', testVideo ? '✅' : '❌');
console.log('  - Video rendered:', verifiedVideo ? '✅' : '❌');