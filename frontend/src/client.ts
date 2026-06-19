import { initBulkPromptUploader, addBulkImageReference, loadedBulkItems, loadedFilename, activeImgQueue, activeVidQueue, bulkRowStatus } from './prompt.js';
import { animateTabSwitch, animateGalleryItems, animateButtonPress } from './animation.js';
import * as XLSX from 'xlsx';

export const API_BASE = 'http://127.0.0.1:8001';

export interface GeneratedAsset {
    type: 'image' | 'video';
    url: string;
    prompt: string;
    media_id?: string;
    isBulk?: boolean;
}

interface ReferenceImage {
    url: string;
    media_id: string;
}

interface ImageResponseItem {
    url: string;
    media_id?: string;
}

interface ImageResponse {
    data?: ImageResponseItem[];
    detail?: string;
}

// DOM Elements with proper HTML element casting
const tabBtns = document.querySelectorAll<HTMLButtonElement>('.segment-btn');
const tabContents = document.querySelectorAll<HTMLDivElement>('.panel-content');
const btnGenerateImg = document.getElementById('btn-generate-img') as HTMLButtonElement | null;
const btnGenerateVid = document.getElementById('btn-generate-vid') as HTMLButtonElement | null;
const imgPrompt = document.getElementById('img-prompt') as HTMLTextAreaElement | null;
export const imgSize = document.getElementById('img-size') as HTMLSelectElement | null;
export const imgCount = document.getElementById('img-count') as HTMLSelectElement | null;
const vidPrompt = document.getElementById('vid-prompt') as HTMLTextAreaElement | null;
export const vidAspect = document.getElementById('vid-aspect') as HTMLSelectElement | null;
export const vidCount = document.getElementById('vid-count') as HTMLSelectElement | null;
export const vidDuration = document.getElementById('vid-duration') as HTMLSelectElement | null;
const assetCountBadge = document.getElementById('asset-count') as HTMLSpanElement | null;
const btnClearCanvas = document.getElementById('btn-clear-canvas') as HTMLButtonElement | null;
const emptyState = document.getElementById('empty-state') as HTMLDivElement | null;
const galleryGrid = document.getElementById('gallery-grid') as HTMLDivElement | null;
const mediaModal = document.getElementById('media-modal') as HTMLDivElement | null;
const modalMediaContainer = document.getElementById('modal-media-container') as HTMLDivElement | null;
const btnModalCopyPrompt = document.getElementById('modal-copy-prompt') as HTMLButtonElement | null;
const modalDownload = document.getElementById('modal-download') as HTMLAnchorElement | null;
const modalAddToCanvas = document.getElementById('modal-add-to-canvas') as HTMLButtonElement | null;
const modalAddToVideo = document.getElementById('modal-add-to-video') as HTMLButtonElement | null;
const closeModal = document.querySelector<HTMLSpanElement>('.close-modal');

// Drag & Drop DOM elements (Video)
const vidDropzone = document.getElementById('vid-dropzone') as HTMLDivElement | null;
const vidFileInput = document.getElementById('vid-file-input') as HTMLInputElement | null;
const dropzoneImgPreview = document.getElementById('dropzone-img-preview') as HTMLImageElement | null;
const btnRemoveStartImg = document.getElementById('btn-remove-start-img') as HTMLButtonElement | null;

// Drag & Drop DOM elements (Image)
const imgDropzone = document.getElementById('img-dropzone') as HTMLDivElement | null;
const imgFileInput = document.getElementById('img-file-input') as HTMLInputElement | null;

// Canvas Loader DOM elements
const galleryLoader = document.getElementById('gallery-loader') as HTMLDivElement | null;
const loaderTitle = document.getElementById('loader-title') as HTMLHeadingElement | null;
const loaderStatus = document.getElementById('loader-status') as HTMLParagraphElement | null;

// Reference Images panel DOM elements (Video Tab)
const refImagesContainer = document.getElementById('ref-images-container') as HTMLDivElement | null;
const vidRefLabel = document.getElementById('vid-ref-label') as HTMLLabelElement | null;
const vidDropzonePlaceholder = document.getElementById('vid-dropzone-placeholder') as HTMLDivElement | null;

// Reference Images panel DOM elements (Image Tab)
const imgRefImagesContainer = document.getElementById('img-ref-images-container') as HTMLDivElement | null;
const imgRefLabel = document.getElementById('img-ref-label') as HTMLLabelElement | null;
const imgDropzonePlaceholder = document.getElementById('img-dropzone-placeholder') as HTMLDivElement | null;

export let assets: GeneratedAsset[] = (() => {
    try {
        const saved = localStorage.getItem('canvasAssets');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('Error parsing canvasAssets:', e);
        return [];
    }
})();
export let selectedReferences: ReferenceImage[] = [];
export let selectedImageReferences: ReferenceImage[] = [];

export function clearSelectedImageReferences() {
    selectedImageReferences = [];
    updateImageReferencesUI();
}

export function clearSelectedReferences() {
    selectedReferences = [];
    updateReferencesUI();
}

export function clearCanvasAssets(type: 'image' | 'video') {
    assets = assets.filter(asset => !(asset.type === type && !asset.isBulk));
    localStorage.setItem('canvasAssets', JSON.stringify(assets));
    updateGallery();
}

export function clearBulkAssets() {
    assets = assets.filter(asset => !asset.isBulk);
    localStorage.setItem('canvasAssets', JSON.stringify(assets));
    updateGallery();
}
let activeLightboxAsset: GeneratedAsset | null = null;
let activeImageUploadsCount = 0;
let activeVideoUploadsCount = 0;
const autoplayVideos = false;

let isGeneratingImg = false;
let isGeneratingVid = false;
let imgLoadingTitle = 'Creating Images...';
let imgLoadingStatus = '';
let vidLoadingTitle = 'Generating Video...';
let vidLoadingStatus = '';

// Tab Switcher with Persistence
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabName = btn.dataset.tab;
        if (tabName) {
            const targetPanel = document.getElementById(`panel-${tabName}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
                animateTabSwitch(targetPanel);
            }
            localStorage.setItem('activeTab', tabName);
            updateGallery(); // Refresh the gallery filter when tab switches!
        }
    });
});

// Restore active tab from localStorage on load
const savedTab = localStorage.getItem('activeTab');
if (savedTab) {
    tabBtns.forEach(btn => {
        if (btn.dataset.tab === savedTab) {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetPanel = document.getElementById(`panel-${savedTab}`);
            if (targetPanel) targetPanel.classList.add('active');
        }
    });
}

// Restore settings values on load and attach listeners
if (imgPrompt) {
    imgPrompt.value = localStorage.getItem('imgPrompt') || '';
    imgPrompt.addEventListener('input', () => {
        localStorage.setItem('imgPrompt', imgPrompt.value);
    });
}
if (imgSize) {
    imgSize.value = localStorage.getItem('imgSize') || '1024x1024';
    imgSize.addEventListener('change', () => {
        localStorage.setItem('imgSize', imgSize.value);
    });
}
if (imgCount) {
    imgCount.value = localStorage.getItem('imgCount') || '4';
    imgCount.addEventListener('change', () => {
        localStorage.setItem('imgCount', imgCount.value);
    });
}
if (vidPrompt) {
    vidPrompt.value = localStorage.getItem('vidPrompt') || '';
    vidPrompt.addEventListener('input', () => {
        localStorage.setItem('vidPrompt', vidPrompt.value);
    });
}
if (vidAspect) {
    vidAspect.value = localStorage.getItem('vidAspect') || 'landscape';
    vidAspect.addEventListener('change', () => {
        localStorage.setItem('vidAspect', vidAspect.value);
    });
}
if (vidCount) {
    vidCount.value = localStorage.getItem('vidCount') || '1';
    vidCount.addEventListener('change', () => {
        localStorage.setItem('vidCount', vidCount.value);
    });
}
if (vidDuration) {
    vidDuration.value = localStorage.getItem('vidDuration') || '8';
    vidDuration.addEventListener('change', () => {
        localStorage.setItem('vidDuration', vidDuration.value);
    });
}

// Drag & Drop Setup (Video)
if (vidDropzone && vidFileInput) {
    vidDropzone.addEventListener('click', (e) => {
        if (e.target instanceof HTMLElement && (e.target.closest('.ref-thumb') && !e.target.closest('.ref-thumb-add-more'))) {
            return;
        }
        vidFileInput.click();
    });

    vidFileInput.addEventListener('change', () => {
        if (vidFileInput.files) {
            Array.from(vidFileInput.files).forEach(file => {
                handleSelectedFile(file, 'video');
            });
        }
    });

    vidDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        vidDropzone.classList.add('dragover');
    });

    vidDropzone.addEventListener('dragleave', () => {
        vidDropzone.classList.remove('dragover');
    });

    vidDropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        vidDropzone.classList.remove('dragover');
        if (e.dataTransfer) {
            const jsonData = e.dataTransfer.getData('application/json');
            if (jsonData) {
                try {
                    const data = JSON.parse(jsonData);
                    if (data.media_id) {
                        addReference(data.url, data.media_id);
                        return;
                    }
                } catch (err) {
                    console.error("Error parsing drag data:", err);
                }
            }
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                Array.from(e.dataTransfer.files).forEach(file => {
                    handleSelectedFile(file, 'video');
                });
            } else {
                const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                if (url) {
                    await handleDroppedUrl(url, 'video');
                }
            }
        }
    });
}

// Global Paste Handler to support pasting images/videos directly as references
document.addEventListener('paste', async (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const activeTab = localStorage.getItem('activeTab') || 'image';
    let handled = false;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (!file) continue;

            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');

            if (activeTab === 'image' && isImage) {
                handleSelectedFile(file, 'image');
                handled = true;
            } else if (activeTab === 'video' && (isImage || isVideo)) {
                handleSelectedFile(file, 'video');
                handled = true;
            }
        }
    }

    if (handled) {
        event.preventDefault();
    }
});

// Drag & Drop Setup (Image)
if (imgDropzone && imgFileInput) {
    imgDropzone.addEventListener('click', (e) => {
        if (e.target instanceof HTMLElement && (e.target.closest('.ref-thumb') && !e.target.closest('.ref-thumb-add-more'))) {
            return;
        }
        imgFileInput.click();
    });

    imgFileInput.addEventListener('change', () => {
        if (imgFileInput.files) {
            Array.from(imgFileInput.files).forEach(file => {
                handleSelectedFile(file, 'image');
            });
        }
    });

    imgDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imgDropzone.classList.add('dragover');
    });

    imgDropzone.addEventListener('dragleave', () => {
        imgDropzone.classList.remove('dragover');
    });

    imgDropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        imgDropzone.classList.remove('dragover');
        if (e.dataTransfer) {
            const jsonData = e.dataTransfer.getData('application/json');
            if (jsonData) {
                try {
                    const data = JSON.parse(jsonData);
                    if (data.media_id) {
                        if (data.type === 'image') {
                            addImageReference(data.url, data.media_id);
                        } else {
                            showToast("You can only add image references to the Image Generator.", "error");
                        }
                        return;
                    }
                } catch (err) {
                    console.error("Error parsing drag data:", err);
                }
            }
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                Array.from(e.dataTransfer.files).forEach(file => {
                    handleSelectedFile(file, 'image');
                });
            } else {
                const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                if (url) {
                    await handleDroppedUrl(url, 'image');
                }
            }
        }
    });
}

async function handleDroppedUrl(url: string, type: 'image' | 'video') {
    try {
        const absoluteUrl = url.startsWith('http') ? url : new URL(url, window.location.origin).href;
        const response = await fetch(absoluteUrl);
        if (!response.ok) throw new Error('Failed to fetch file');
        const blob = await response.blob();
        
        if (type === 'image') {
            if (!blob.type.startsWith('image/')) {
                showToast('Please drop a valid image file.', 'error');
                return;
            }
            const file = new File([blob], "dragged_image.png", { type: blob.type });
            handleSelectedFile(file, type);
        } else {
            if (!blob.type.startsWith('image/') && !blob.type.startsWith('video/')) {
                showToast('Please drop a valid image or video file.', 'error');
                return;
            }
            const isVideo = blob.type.startsWith('video/');
            const filename = isVideo ? "dragged_video.mp4" : "dragged_image.png";
            const file = new File([blob], filename, { type: blob.type });
            handleSelectedFile(file, type);
        }
    } catch (err) {
        console.error('Error handling dropped URL:', err);
        showToast('Failed to load the dragged file.', 'error');
    }
}

function handleSelectedFile(file: File, type: 'image' | 'video') {
    if (type === 'image') {
        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file.', 'error');
            return;
        }
    } else {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            showToast('Please select a valid image or video file.', 'error');
            return;
        }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        if (e.target && typeof e.target.result === 'string') {
            if (type === 'video') {
                uploadAndAddReference(e.target.result);
                if (vidFileInput) vidFileInput.value = '';
            } else {
                uploadAndAddImageReference(e.target.result);
                if (imgFileInput) imgFileInput.value = '';
            }
        }
    };
    reader.readAsDataURL(file);
}

async function uploadAndAddImageReference(base64Data: string) {
    if (selectedImageReferences.length >= 10) {
        showToast("You can select up to 10 reference items.", "error");
        return;
    }
    
    activeImageUploadsCount++;
    setCanvasLoading(true, 'Uploading Reference...', `Uploading reference image to Google Flow (${activeImageUploadsCount} active)...`, 'image');
    
    try {
        const response = await fetch(`${API_BASE}/v1/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_base64: base64Data
            })
        });
        
        const result = await response.json();
        if (response.ok && result.media_id && result.url) {
            selectedImageReferences.push({ url: result.url, media_id: result.media_id });
            updateImageReferencesUI();
            showToast("Reference uploaded and added!", "success");
        } else {
            showToast(`Upload failed: ${result.detail || 'Unknown error'}`, 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to upload reference image to server.', 'error');
    } finally {
        activeImageUploadsCount--;
        if (activeImageUploadsCount <= 0) {
            activeImageUploadsCount = 0;
            setCanvasLoading(false, '', '', 'image');
        } else {
            setCanvasLoading(true, 'Uploading Reference...', `Uploading reference image to Google Flow (${activeImageUploadsCount} active)...`, 'image');
        }
    }
}

function addImageReference(url: string, mediaId: string) {
    if (!mediaId) {
        showToast("This item cannot be selected as a reference (missing Flow media ID).", "error");
        return;
    }

    if (selectedImageReferences.some(ref => ref.media_id === mediaId)) {
        showToast("This item is already added as a reference.", "info");
        return;
    }

    if (selectedImageReferences.length >= 10) {
        showToast("You can select up to 10 reference items.", "error");
        return;
    }

    selectedImageReferences.push({ url, media_id: mediaId });
    updateImageReferencesUI();
    showToast("Added as image reference!", "success");

    // Switch to image tab so they can configure parameters
    const imageTabBtn = Array.from(tabBtns).find(btn => btn.dataset.tab === 'image');
    if (imageTabBtn) {
        imageTabBtn.click();
    }
}

function removeImageReference(mediaId: string) {
    selectedImageReferences = selectedImageReferences.filter(ref => ref.media_id !== mediaId);
    updateImageReferencesUI();
}

function updateImageReferencesUI() {
    if (!imgRefImagesContainer || !imgRefLabel || !imgDropzonePlaceholder) return;

    if (selectedImageReferences.length === 0) {
        imgRefLabel.innerHTML = 'Upload Reference Image';
        imgDropzonePlaceholder.classList.remove('hide');
        imgRefImagesContainer.classList.add('hide');
        imgRefImagesContainer.innerHTML = '';
        return;
    }

    imgRefLabel.innerHTML = `Selected Reference Image (<span id="img-ref-images-count">${selectedImageReferences.length}</span>/10)`;
    imgDropzonePlaceholder.classList.add('hide');
    imgRefImagesContainer.classList.remove('hide');

    imgRefImagesContainer.innerHTML = selectedImageReferences.map(ref => {
        return `
            <div class="ref-thumb">
                <img src="${ref.url}" alt="Image Reference Thumbnail">
                <button class="ref-thumb-remove" data-id="${ref.media_id}" title="Remove reference">&times;</button>
            </div>
        `;
    }).join('') + `
        <div class="ref-thumb-add-more">
            <span class="add-more-plus">+</span>
        </div>
    `;

    imgRefImagesContainer.querySelectorAll<HTMLButtonElement>('.ref-thumb-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) removeImageReference(id);
        });
    });
}

async function uploadAndAddReference(base64Data: string) {
    if (selectedReferences.length >= 10) {
        showToast("You can select up to 10 reference items.", "error");
        return;
    }
    
    activeVideoUploadsCount++;
    setCanvasLoading(true, 'Uploading Reference...', `Uploading reference to Google Flow (${activeVideoUploadsCount} active)...`, 'video');
    
    try {
        const response = await fetch(`${API_BASE}/v1/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_base64: base64Data
            })
        });
        
        const result = await response.json();
        if (response.ok && result.media_id && result.url) {
            selectedReferences.push({ url: result.url, media_id: result.media_id });
            updateReferencesUI();
            showToast("Reference uploaded and added!", "success");
            
            // Switch to video tab so they can configure parameters
            const videoTabBtn = Array.from(tabBtns).find(btn => btn.dataset.tab === 'video');
            if (videoTabBtn) {
                videoTabBtn.click();
            }
        } else {
            showToast(`Upload failed: ${result.detail || 'Unknown error'}`, 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to upload reference file to server.', 'error');
    } finally {
        activeVideoUploadsCount--;
        if (activeVideoUploadsCount <= 0) {
            activeVideoUploadsCount = 0;
            setCanvasLoading(false, '', '', 'video');
        } else {
            setCanvasLoading(true, 'Uploading Reference...', `Uploading reference to Google Flow (${activeVideoUploadsCount} active)...`, 'video');
        }
    }
}

function addReference(url: string, mediaId: string) {
    if (!mediaId) {
        showToast("This item cannot be selected as a reference (missing Flow media ID).", "error");
        return;
    }

    if (selectedReferences.some(ref => ref.media_id === mediaId)) {
        showToast("This item is already added as a reference.", "info");
        return;
    }

    if (selectedReferences.length >= 10) {
        showToast("You can select up to 10 reference items.", "error");
        return;
    }

    selectedReferences.push({ url, media_id: mediaId });
    updateReferencesUI();
    showToast("Added as video reference!", "success");

    // Switch to video tab so they can configure their video parameters
    const videoTabBtn = Array.from(tabBtns).find(btn => btn.dataset.tab === 'video');
    if (videoTabBtn) {
        videoTabBtn.click();
    }
}

function removeReference(mediaId: string) {
    selectedReferences = selectedReferences.filter(ref => ref.media_id !== mediaId);
    updateReferencesUI();
}

function updateReferencesUI() {
    if (!refImagesContainer || !vidRefLabel || !vidDropzonePlaceholder) return;

    if (selectedReferences.length === 0) {
        vidRefLabel.innerHTML = 'Upload Reference Image & Video';
        vidDropzonePlaceholder.classList.remove('hide');
        refImagesContainer.classList.add('hide');
        refImagesContainer.innerHTML = '';
        return;
    }

    vidRefLabel.innerHTML = `Selected Reference Image & Video (<span id="ref-images-count">${selectedReferences.length}</span>/10)`;
    vidDropzonePlaceholder.classList.add('hide');
    refImagesContainer.classList.remove('hide');

    refImagesContainer.innerHTML = selectedReferences.map(ref => {
        const isVid = ref.url.toLowerCase().endsWith('.mp4') || ref.url.toLowerCase().includes('_vid_') || ref.url.toLowerCase().includes('video');
        const mediaHtml = isVid 
            ? `<video src="${ref.url}" muted autoplay loop playsinline style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;"></video>`
            : `<img src="${ref.url}" alt="Video Reference Image">`;
        return `
            <div class="ref-thumb">
                ${mediaHtml}
                <button class="ref-thumb-remove" data-id="${ref.media_id}" title="Remove reference">&times;</button>
            </div>
        `;
    }).join('') + `
        <div class="ref-thumb-add-more">
            <span class="add-more-plus">+</span>
        </div>
    `;

    refImagesContainer.querySelectorAll<HTMLButtonElement>('.ref-thumb-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) removeReference(id);
        });
    });
}

// Canvas Loading controller
export function setCanvasLoading(isLoading: boolean, title: string = 'Generating...', status: string = '', type?: 'image' | 'video') {
    const targetType = type || (localStorage.getItem('activeTab') || 'image') as 'image' | 'video';
    
    // Check if bulk queue is running
    const isBulk = (activeImgQueue && activeImgQueue.isRunning) || (activeVidQueue && activeVidQueue.isRunning);
    
    if (targetType === 'image') {
        isGeneratingImg = isBulk ? false : isLoading;
        if (isLoading) {
            imgLoadingTitle = title;
            imgLoadingStatus = status;
        }
    } else {
        isGeneratingVid = isBulk ? false : isLoading;
        if (isLoading) {
            vidLoadingTitle = title;
            vidLoadingStatus = status;
        }
    }
    
    updateGallery();
}

export function setButtonLoading(btn: HTMLButtonElement | null, isLoading: boolean) {
    if (btn) {
        btn.disabled = isLoading;
    }
}

if (btnClearCanvas) {
    btnClearCanvas.addEventListener('click', () => {
        const activeTab = localStorage.getItem('activeTab') || 'image';
        const initialLen = assets.length;
        if (activeTab === 'bulk') {
            assets = assets.filter(asset => !asset.isBulk);
        } else if (activeTab === 'image') {
            assets = assets.filter(asset => !(asset.type === 'image' && !asset.isBulk));
        } else {
            assets = assets.filter(asset => !(asset.type === 'video' && !asset.isBulk));
        }
        
        if (assets.length === initialLen) {
            showToast('Canvas is already empty', 'info');
            return;
        }
        
        localStorage.setItem('canvasAssets', JSON.stringify(assets));
        updateGallery();
        showToast('Canvas cleared successfully!', 'success');
    });
}

// Image Generation
if (btnGenerateImg) {
    btnGenerateImg.addEventListener('click', async () => {
        animateButtonPress(btnGenerateImg);
        if (!imgPrompt || !imgSize || !imgCount) return;
        const prompt = imgPrompt.value.trim();
        if (!prompt) {
            showToast('Please enter a prompt', 'error');
            return;
        }

        setButtonLoading(btnGenerateImg, true);
        const loadingMsg = selectedImageReferences.length > 0
            ? `Generating images consistent with ${selectedImageReferences.length} reference image(s)...`
            : 'Sending request to Flow Agent Bridge...';
        
        // Clear previous image assets from canvas
        assets = assets.filter(asset => asset.type !== 'image');
        localStorage.setItem('canvasAssets', JSON.stringify(assets));
        updateGallery();

        setCanvasLoading(true, 'Creating Images...', loadingMsg, 'image');

        try {
            const bodyPayload: any = {
                prompt: prompt,
                size: imgSize.value,
                response_format: 'url'
            };
            if (selectedImageReferences.length > 0) {
                bodyPayload.ref_media_ids = selectedImageReferences.map(ref => ref.media_id);
            }

            const totalCount = parseInt(imgCount.value);
            const chunks: number[] = [];
            let remaining = totalCount;
            while (remaining > 0) {
                const chunk = Math.min(4, remaining);
                chunks.push(chunk);
                remaining -= chunk;
            }

            let hasSucceededAny = false;

            const runChunk = async (count: number) => {
                try {
                    const chunkPayload = {
                        ...bodyPayload,
                        n: count
                    };

                    const response = await fetch(`${API_BASE}/v1/images/generations`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chunkPayload)
                    });

                    const result: ImageResponse = await response.json();
                    if (response.ok && result.data) {
                        result.data.forEach(item => {
                            addAsset({
                                type: 'image',
                                url: item.url,
                                prompt: prompt,
                                media_id: item.media_id
                            });
                        });
                        hasSucceededAny = true;
                    } else {
                        showToast(`Error: ${result.detail || 'Failed to generate images'}`, 'error');
                    }
                } catch (e) {
                    console.error('Error generating chunk:', e);
                    showToast('Failed to connect to generate chunk.', 'error');
                }
            };

            // Process chunks sequentially: wait for previous to complete (Status ✓ done) before sending next
            (async () => {
                try {
                    for (const chunkSize of chunks) {
                        await runChunk(chunkSize);
                    }
                } finally {
                    setButtonLoading(btnGenerateImg, false);
                    setCanvasLoading(false, '', '', 'image');
                    if (hasSucceededAny) {
                        imgPrompt.value = '';
                        localStorage.removeItem('imgPrompt');
                        selectedImageReferences = [];
                        updateImageReferencesUI();
                        showToast("Images generated successfully!", "success");
                    }
                }
            })();

        } catch (e) {
            console.error(e);
            showToast('Could not connect to the Flow Agent server. Make sure it is running.', 'error');
            setButtonLoading(btnGenerateImg, false);
            setCanvasLoading(false, '', '', 'image');
        }
    });
}

// Video Generation
if (btnGenerateVid) {
    btnGenerateVid.addEventListener('click', async () => {
        animateButtonPress(btnGenerateVid);
        if (!vidPrompt || !vidAspect || !vidCount) return;
        const prompt = vidPrompt.value.trim();
        if (!prompt) {
            showToast('Please enter a prompt', 'error');
            return;
        }

        setButtonLoading(btnGenerateVid, true);
        
        let loadingMsg = 'Initiating video generation on Flow...';
        const hasVideoRef = selectedReferences.some(ref => {
            const url = ref.url.toLowerCase();
            return url.endsWith('.mp4') || url.includes('_vid_') || url.includes('video');
        });
        if (selectedReferences.length > 0) {
            if (hasVideoRef) {
                loadingMsg = `Generating Video-to-Video using consistent style and reference(s)...`;
            } else {
                loadingMsg = `Generating video consistent with ${selectedReferences.length} reference image(s)...`;
            }
        }

        // Clear previous video assets from canvas
        assets = assets.filter(asset => asset.type !== 'video');
        localStorage.setItem('canvasAssets', JSON.stringify(assets));
        updateGallery();

        setCanvasLoading(true, 'Generating Video...', loadingMsg, 'video');

        try {
            const bodyPayload: any = {
                prompt: prompt,
                aspect: vidAspect.value,
                n: parseInt(vidCount.value),
                duration: vidDuration ? parseInt(vidDuration.value) : 8
            };

            if (selectedReferences.length > 0) {
                const firstVideoRef = selectedReferences.find(ref => {
                    const url = ref.url.toLowerCase();
                    return url.endsWith('.mp4') || url.includes('_vid_') || url.includes('video');
                });

                if (firstVideoRef) {
                    bodyPayload.start_media_id = firstVideoRef.media_id;
                    bodyPayload.is_video = true;
                }
                
                bodyPayload.ref_media_ids = selectedReferences.map(ref => ref.media_id);
            }

            const response = await fetch(`${API_BASE}/v1/videos/generations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            const result = await response.json();
            if (response.ok && result.data) {
                result.data.forEach((item: any) => {
                    addAsset({
                        type: 'video',
                        url: item.url,
                        prompt: prompt,
                        media_id: item.media_id
                    });
                });
                vidPrompt.value = '';
                localStorage.removeItem('vidPrompt');
                
                // Clear references list
                selectedReferences = [];
                updateReferencesUI();
                showToast("Video generated successfully!", "success");
            } else {
                showToast(`Error: ${result.detail || 'Failed to generate video'}`, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Could not connect to the Flow Agent server. Make sure it is running.', 'error');
        } finally {
            setButtonLoading(btnGenerateVid, false);
            setCanvasLoading(false, '', '', 'video');
            updateCredits();
        }
    });
}

// Helpers
export function addAsset(asset: GeneratedAsset) {
    assets.unshift(asset);
    localStorage.setItem('canvasAssets', JSON.stringify(assets));
    updateGallery();
}

export function updateGallery() {
    if (!assetCountBadge || !emptyState || !galleryGrid || !galleryLoader || !loaderTitle) return;
    
    const activeTab = localStorage.getItem('activeTab') || 'image';
    
    const bulkTemplateDownload = document.getElementById('bulk-template-download');
    const bulkResultsExport = document.getElementById('bulk-results-export');
    
    // Get bulk assets count
    const bulkAssetsCount = assets.filter(asset => asset.isBulk === true).length;
    
    if (bulkTemplateDownload) {
        if (activeTab === 'bulk') {
            bulkTemplateDownload.classList.remove('hide');
        } else {
            bulkTemplateDownload.classList.add('hide');
        }
    }
    
    if (bulkResultsExport) {
        if (activeTab === 'bulk' && bulkAssetsCount > 0) {
            bulkResultsExport.classList.remove('hide');
        } else {
            bulkResultsExport.classList.add('hide');
        }
    }

    let targetType = activeTab;
    if (activeTab === 'bulk') {
        const imageCount = loadedBulkItems.filter(item => item.type === 'image').length;
        const videoCount = loadedBulkItems.filter(item => item.type === 'video').length;
        if (videoCount > 0 && imageCount === 0) {
            targetType = 'video';
        } else {
            targetType = 'image';
        }
    }
    
    // Toggle Dynamic Action groups
    const imageActions = document.getElementById('gallery-image-actions');
    const videoActions = document.getElementById('gallery-video-actions');
    if (imageActions && videoActions) {
        if (targetType === 'image') {
            imageActions.classList.remove('hide');
            videoActions.classList.add('hide');
        } else {
            imageActions.classList.add('hide');
            videoActions.classList.remove('hide');
        }
    }
    const isGenerating = activeTab === 'image'
        ? isGeneratingImg
        : (activeTab === 'video' ? isGeneratingVid : (isGeneratingImg || isGeneratingVid));
    
    if (isGenerating && activeTab !== 'bulk') {
        galleryLoader.classList.remove('hide');
        emptyState.classList.add('hide');
        galleryGrid.classList.add('hide');
        
        if (activeTab === 'image') {
            loaderTitle.textContent = imgLoadingTitle;
            if (loaderStatus) loaderStatus.textContent = imgLoadingStatus;
        } else if (activeTab === 'video') {
            loaderTitle.textContent = vidLoadingTitle;
            if (loaderStatus) loaderStatus.textContent = vidLoadingStatus;
        } else {
            loaderTitle.textContent = isGeneratingImg ? imgLoadingTitle : vidLoadingTitle;
            if (loaderStatus) {
                loaderStatus.textContent = isGeneratingImg ? imgLoadingStatus : vidLoadingStatus;
            }
        }
        return;
    }
    
    galleryLoader.classList.add('hide');
    
    const filteredAssets = assets.filter(asset => {
        if (activeTab === 'bulk') {
            return asset.isBulk === true;
        } else if (activeTab === 'image') {
            return asset.type === 'image' && !asset.isBulk;
        } else {
            return asset.type === 'video' && !asset.isBulk;
        }
    });
    
    assetCountBadge.textContent = `${filteredAssets.length}`;
    
    // CUSTOM BULK GENERATOR RENDERING WITH DYNAMIC PLACEHOLDERS
    if (activeTab === 'bulk' && loadedBulkItems && loadedBulkItems.length > 0) {
        emptyState.classList.add('hide');
        galleryGrid.classList.remove('hide');

        const itemsHtml = loadedBulkItems.flatMap((item, idx) => {
            const matchingAssets = filteredAssets.filter(asset => asset.prompt === item.prompt);
            
            if (matchingAssets.length > 0) {
                return matchingAssets.map(asset => {
                    const globalIndex = assets.indexOf(asset);
                    if (asset.type === 'image') {
                        const addBtnHtml = asset.media_id
                            ? `
                              <button class="add-to-vid-btn add-to-img-ref-btn" data-index="${globalIndex}" title="Add reference to Image Generator">Create Image</button>
                              <button class="add-to-vid-btn add-to-vid-ref-btn" data-index="${globalIndex}" title="Add reference to Video Generator">Create Video</button>
                              `
                            : '';
                        return `
                            <div class="gallery-item" data-index="${globalIndex}" draggable="true">
                                <div class="gallery-media-wrapper">
                                    <img src="${asset.url}" alt="${escapeHtml(asset.prompt)}" loading="lazy">
                                    <a class="media-download-btn" href="${asset.url}" download title="Download Media">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    </a>
                                </div>
                                <div class="gallery-item-footer">
                                    <div class="overlay-buttons" style="margin-bottom: 4px;">
                                        ${addBtnHtml}
                                        <button class="add-to-vid-btn copy-prompt-btn" data-prompt="${escapeHtml(asset.prompt)}" title="Copy Prompt">Copy</button>
                                    </div>
                                    <div class="overlay-prompt" style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(asset.prompt)}">
                                        #${idx + 1}: ${escapeHtml(asset.prompt)}
                                    </div>
                                    <div style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 2px;">
                                        IMAGE
                                    </div>
                                </div>
                            </div>
                        `;
                    } else {
                        const addBtnHtml = asset.media_id
                            ? `
                              <button class="add-to-vid-btn add-to-vid-ref-btn" data-index="${globalIndex}" title="Add reference to Video Generator">Create Video</button>
                              `
                            : '';
                        const autoplayAttr = autoplayVideos ? 'autoplay' : '';
                        return `
                            <div class="gallery-item" data-index="${globalIndex}" draggable="true">
                                <div class="gallery-media-wrapper">
                                    <video src="${asset.url}" muted loop ${autoplayAttr}></video>
                                    ${autoplayVideos ? '' : '<div class="play-badge">▶</div>'}
                                    <a class="media-download-btn" href="${asset.url}" download title="Download Media">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    </a>
                                </div>
                                <div class="gallery-item-footer">
                                    <div class="overlay-buttons" style="margin-bottom: 4px;">
                                        ${addBtnHtml}
                                        <button class="add-to-vid-btn copy-prompt-btn" data-prompt="${escapeHtml(asset.prompt)}" title="Copy Prompt">Copy</button>
                                    </div>
                                    <div class="overlay-prompt" style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary); margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(asset.prompt)}">
                                        #${idx + 1}: ${escapeHtml(asset.prompt)}
                                    </div>
                                    <div style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 2px;">
                                        VIDEO
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                });
            } else {
                let statusLabel = 'Waiting';
                let spinnerClass = 'pending-spinner-circle';
                
                const customStatus = bulkRowStatus[idx];
                if (customStatus) {
                    statusLabel = customStatus;
                    if (customStatus === 'Generating...') {
                        spinnerClass = 'generating-spinner-circle';
                    } else {
                        spinnerClass = 'pending-spinner-circle';
                    }
                } else {
                    let isQueueRunning = false;
                    const imgQueue = activeImgQueue;
                    if (item.type === 'image') {
                        const imageItems = loadedBulkItems.filter(it => it.type === 'image');
                        const imgIdx = imageItems.indexOf(item);
                        if (imgQueue && imgQueue.isRunning) {
                            isQueueRunning = true;
                            if (imgIdx === imgQueue.currentIndex) {
                                statusLabel = 'Generating...';
                                spinnerClass = 'generating-spinner-circle';
                            } else if (imgIdx > imgQueue.currentIndex) {
                                statusLabel = 'Waiting';
                                spinnerClass = 'pending-spinner-circle';
                            } else {
                                statusLabel = 'Skipped';
                                spinnerClass = 'pending-spinner-circle';
                            }
                        }
                    } else {
                        const videoItems = loadedBulkItems.filter(it => it.type === 'video');
                        const vidIdx = videoItems.indexOf(item);
                        const vidQueue = activeVidQueue;
                        if (vidQueue && vidQueue.isRunning) {
                            isQueueRunning = true;
                            if (vidIdx === vidQueue.currentIndex) {
                                statusLabel = 'Generating...';
                                spinnerClass = 'generating-spinner-circle';
                            } else if (vidIdx > vidQueue.currentIndex) {
                                statusLabel = 'Waiting';
                                spinnerClass = 'pending-spinner-circle';
                            } else {
                                statusLabel = 'Skipped';
                                spinnerClass = 'pending-spinner-circle';
                            }
                        }
                    }
                    
                    if (!isQueueRunning) {
                        statusLabel = 'Waiting';
                        spinnerClass = 'pending-spinner-circle';
                    }
                }
                
                const bulkImgSize = document.getElementById('bulk-img-size') as HTMLSelectElement | null;
                const bulkVidAspect = document.getElementById('bulk-vid-aspect') as HTMLSelectElement | null;
                const currentSize = item.size || (bulkImgSize?.value ?? '1024x1024');
                const currentAspect = item.aspect || (bulkVidAspect?.value ?? 'landscape');

                const details = item.type === 'image' 
                    ? ` • ${currentSize}`
                    : ` • ${currentAspect}` + (item.duration ? ` • ${item.duration}s` : '');

                return `
                    <div class="gallery-item bulk-placeholder" style="cursor: default; opacity: 0.85;">
                        <div class="gallery-media-wrapper" style="background: rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                                <div class="${spinnerClass}"></div>
                                <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">
                                    ${statusLabel}
                                </span>
                            </div>
                        </div>
                        <div class="gallery-item-footer" style="padding: 0.8rem; display: flex; flex-direction: column; gap: 4px;">
                            <div class="overlay-prompt" style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(item.prompt)}">
                                #${idx + 1}: ${escapeHtml(item.prompt)}
                            </div>
                            <div style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 2px;">
                                ${item.type.toUpperCase()}${details}
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        galleryGrid.innerHTML = itemsHtml;
    } else {
        if (filteredAssets.length === 0) {
            emptyState.classList.remove('hide');
            galleryGrid.classList.add('hide');
            emptyState.innerHTML = `
                <div class="empty-icon">📁</div>
                <h3>No Assets</h3>
                <p style="color: var(--text-secondary); font-size: 0.90rem; margin-top: 4px;">Upload a template file on the sidebar to get started.</p>
            `;
            const emptyTitle = emptyState.querySelector('h3');
            if (emptyTitle) {
                if (activeTab === 'image') {
                    emptyTitle.textContent = "No Image Assets";
                } else if (activeTab === 'video') {
                    emptyTitle.textContent = "No Video Assets";
                } else {
                    emptyTitle.textContent = "No Bulk Assets";
                }
            }
            return;
        }

        emptyState.classList.add('hide');
        galleryGrid.classList.remove('hide');

        galleryGrid.innerHTML = filteredAssets.map((asset) => {
            const globalIndex = assets.indexOf(asset);
            if (asset.type === 'image') {
                const addBtnHtml = asset.media_id
                    ? `
                      <button class="add-to-vid-btn add-to-img-ref-btn" data-index="${globalIndex}" title="Add reference to Image Generator">Create Image</button>
                      <button class="add-to-vid-btn add-to-vid-ref-btn" data-index="${globalIndex}" title="Add reference to Video Generator">Create Video</button>
                      `
                    : '';
                return `
                    <div class="gallery-item" data-index="${globalIndex}" draggable="true">
                        <div class="gallery-media-wrapper">
                            <img src="${asset.url}" alt="${escapeHtml(asset.prompt)}" loading="lazy">
                            <a class="media-download-btn" href="${asset.url}" download title="Download Media">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </a>
                        </div>
                        <div class="gallery-item-footer">
                            <div class="overlay-buttons">
                                ${addBtnHtml}
                                <button class="add-to-vid-btn copy-prompt-btn" data-prompt="${escapeHtml(asset.prompt)}" title="Copy Prompt">Copy</button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                const addBtnHtml = asset.media_id
                    ? `
                      <button class="add-to-vid-btn add-to-vid-ref-btn" data-index="${globalIndex}" title="Add reference to Video Generator">Create Video</button>
                      `
                    : '';
                const autoplayAttr = autoplayVideos ? 'autoplay' : '';
                return `
                    <div class="gallery-item" data-index="${globalIndex}" draggable="true">
                        <div class="gallery-media-wrapper">
                            <video src="${asset.url}" muted loop ${autoplayAttr}></video>
                            ${autoplayVideos ? '' : '<div class="play-badge">▶</div>'}
                            <a class="media-download-btn" href="${asset.url}" download title="Download Media">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </a>
                        </div>
                        <div class="gallery-item-footer">
                            <div class="overlay-buttons">
                                ${addBtnHtml}
                                <button class="add-to-vid-btn copy-prompt-btn" data-prompt="${escapeHtml(asset.prompt)}" title="Copy Prompt">Copy</button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    // Trigger stagger animations on rendered gallery items
    const galleryItems = galleryGrid.querySelectorAll<HTMLDivElement>('.gallery-item');
    animateGalleryItems(galleryItems);
    animateGalleryItems(galleryItems);

    // Attach click listeners to gallery items (excluding buttons inside)
    document.querySelectorAll<HTMLDivElement>('.gallery-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target instanceof HTMLElement && (e.target.closest('.add-to-vid-btn') || e.target.closest('.media-download-btn'))) {
                return;
            }
            const indexStr = item.dataset.index;
            if (indexStr) {
                const index = parseInt(indexStr);
                openLightbox(assets[index]);
            }
        });

        // Drag listener for canvas items
        item.addEventListener('dragstart', (e) => {
            const indexStr = item.dataset.index;
            if (indexStr && e.dataTransfer) {
                const index = parseInt(indexStr);
                const asset = assets[index];
                if (asset) {
                    e.dataTransfer.setData('text/uri-list', asset.url);
                    e.dataTransfer.setData('text/plain', asset.url);
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        url: asset.url,
                        media_id: asset.media_id || '',
                        type: asset.type
                     }));
                    e.dataTransfer.effectAllowed = 'copy';
                }
            }
        });
        
        // Auto-play videos on hover in gallery grid
        const video = item.querySelector('video');
        if (video) {
            item.addEventListener('mouseenter', () => video.play().catch(() => {}));
            item.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
        }
    });

    // Attach click listeners for reference addition buttons inside overlays
    galleryGrid.querySelectorAll<HTMLButtonElement>('.add-to-img-ref-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const indexStr = btn.dataset.index;
            if (indexStr) {
                const index = parseInt(indexStr);
                const asset = assets[index];
                if (asset && asset.media_id) {
                    addImageReference(asset.url, asset.media_id);
                }
            }
        });
    });

    galleryGrid.querySelectorAll<HTMLButtonElement>('.add-to-vid-ref-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const indexStr = btn.dataset.index;
            if (indexStr) {
                const index = parseInt(indexStr);
                const asset = assets[index];
                if (asset && asset.media_id) {
                    addReference(asset.url, asset.media_id);
                }
            }
        });
    });

    // Attach click listener for copy prompt buttons
    galleryGrid.querySelectorAll<HTMLButtonElement>('.copy-prompt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const prompt = btn.getAttribute('data-prompt') || '';
            if (prompt) {
                navigator.clipboard.writeText(prompt);
                showToast("Prompt copied to clipboard!", "success");
            }
        });
    });
}

// Lightbox Modal
function openLightbox(asset: GeneratedAsset) {
    if (!modalMediaContainer || !btnModalCopyPrompt || !modalDownload || !mediaModal || !modalAddToVideo) return;
    
    activeLightboxAsset = asset;
    modalMediaContainer.innerHTML = '';
    
    if (asset.type === 'image') {
        const img = document.createElement('img');
        img.src = asset.url;
        modalMediaContainer.appendChild(img);
    } else {
        const video = document.createElement('video');
        video.src = asset.url;
        video.controls = true;
        video.autoplay = true;
        modalMediaContainer.appendChild(video);
    }

    if (asset.media_id) {
        modalAddToVideo.classList.remove('hide');
    } else {
        modalAddToVideo.classList.add('hide');
    }

    if (modalAddToCanvas) {
        const isAlreadyAdded = assets.some(a => a.url === asset.url);
        if (isAlreadyAdded) {
            modalAddToCanvas.textContent = 'Remove Canvas';
            modalAddToCanvas.classList.add('added-canvas');
        } else {
            modalAddToCanvas.textContent = 'Add to Canvas';
            modalAddToCanvas.classList.remove('added-canvas');
        }
    }

    modalDownload.href = asset.url;
    mediaModal.classList.add('open');
}

if (modalAddToVideo) {
    modalAddToVideo.addEventListener('click', () => {
        if (activeLightboxAsset && activeLightboxAsset.media_id) {
            const activeTab = localStorage.getItem('activeTab') || 'image';
            if (activeTab === 'image') {
                if (activeLightboxAsset.type === 'image') {
                    addImageReference(activeLightboxAsset.url, activeLightboxAsset.media_id);
                } else {
                    showToast("You can only add image references to the Image Generator.", "error");
                }
            } else if (activeTab === 'bulk') {
                if (activeLightboxAsset.type === 'image') {
                    addBulkImageReference(activeLightboxAsset.url, activeLightboxAsset.media_id);
                } else {
                    showToast("Only image references are supported for bulk generation style.", "error");
                }
            } else {
                addReference(activeLightboxAsset.url, activeLightboxAsset.media_id);
            }
            if (mediaModal) {
                mediaModal.classList.remove('open');
                if (modalMediaContainer) modalMediaContainer.innerHTML = '';
            }
        }
    });
}

if (btnModalCopyPrompt) {
    btnModalCopyPrompt.addEventListener('click', () => {
        if (activeLightboxAsset && activeLightboxAsset.prompt) {
            navigator.clipboard.writeText(activeLightboxAsset.prompt);
            showToast("Prompt copied to clipboard!", "success");
        }
    });
}

if (modalAddToCanvas) {
    modalAddToCanvas.addEventListener('click', () => {
        if (activeLightboxAsset) {
            const index = assets.findIndex(asset => asset.url === activeLightboxAsset!.url);
            if (index !== -1) {
                // Remove from canvas
                assets.splice(index, 1);
                localStorage.setItem('canvasAssets', JSON.stringify(assets));
                updateGallery();
                showToast("Removed from canvas", "success");
            } else {
                // Add to canvas
                addAsset(activeLightboxAsset);
                showToast("Added to canvas!", "success");
            }
            if (mediaModal) {
                mediaModal.classList.remove('open');
                if (modalMediaContainer) modalMediaContainer.innerHTML = '';
            }
        }
    });
}

if (closeModal) {
    closeModal.addEventListener('click', () => {
        if (mediaModal && modalMediaContainer) {
            mediaModal.classList.remove('open');
            modalMediaContainer.innerHTML = ''; // Stop video playback
            activeLightboxAsset = null;
        }
    });
}

if (mediaModal) {
    mediaModal.addEventListener('click', (e) => {
        if (e.target === mediaModal && modalMediaContainer) {
            mediaModal.classList.remove('open');
            modalMediaContainer.innerHTML = ''; // Stop video playback
            activeLightboxAsset = null;
        }
    });
}

export async function updateCredits() {
    const creditsBadge = document.getElementById('credits-badge');
    const creditsCount = document.getElementById('credits-count');
    if (!creditsBadge || !creditsCount) return;

    try {
        const response = await fetch(`${API_BASE}/v1/credits`);
        if (response.ok) {
            const json = await response.json();
            const data = (json && json.data !== undefined) ? json.data : json;
            const count = data.remainingCredits !== undefined ? data.remainingCredits : (data.credits !== undefined ? data.credits : '?');
            creditsCount.textContent = count.toString();
            creditsBadge.classList.remove('hide');
        } else {
            creditsBadge.classList.add('hide');
        }
    } catch (e) {
        console.error('Error fetching credits:', e);
        creditsBadge.classList.add('hide');
    }
}

async function checkHealth() {
    const statusDot = document.querySelector('.status-dot');
    if (!statusDot) return;
    
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        
        if (response.ok && data.status === 'healthy') {
            statusDot.classList.remove('offline');
            statusDot.classList.add('online');
        } else {
            statusDot.classList.remove('online');
            statusDot.classList.add('offline');
        }
    } catch (e) {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
    }
}

// Initial health check, initial credits check, and repeat health check every 5 seconds
checkHealth();
updateCredits();
setInterval(checkHealth, 5000);

function escapeHtml(str: string): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    let displayMessage = message;
    if (message.includes('PUBLIC_ERROR_USER_QUOTA_REACHED') || message.includes('Resource has been exhausted') || message.toLowerCase().includes('quota')) {
        const creditsCountEl = document.getElementById('credits-count');
        const count = creditsCountEl ? creditsCountEl.textContent : '?';
        displayMessage = `Insufficient credits. Current Credit is ${count}.`;
    }
    
    const toast = document.createElement('div');
    toast.className = `ios-toast ${type}`;
    
    const dot = document.createElement('div');
    dot.className = 'toast-dot';
    
    const msg = document.createElement('div');
    msg.className = 'toast-message';
    msg.textContent = displayMessage;
    
    toast.appendChild(dot);
    toast.appendChild(msg);
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 50);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 3000);
}

// History View Page controllers
const btnShowHistory = document.getElementById('btn-show-history');
const btnHistoryBack = document.getElementById('btn-history-back');
const btnHistoryClear = document.getElementById('btn-history-clear');
const workspaceView = document.getElementById('workspace-view');
const historyView = document.getElementById('history-view');
const historyViewItems = document.getElementById('history-view-items');

if (btnShowHistory && btnHistoryBack && workspaceView && historyView) {
    btnShowHistory.addEventListener('click', async () => {
        workspaceView.classList.add('hide');
        historyView.classList.remove('hide');
        localStorage.setItem('activeView', 'history');
        await loadHistory();
    });

    btnHistoryBack.addEventListener('click', () => {
        historyView.classList.add('hide');
        workspaceView.classList.remove('hide');
        localStorage.setItem('activeView', 'workspace');
    });
}

// Restore active view state and update gallery representation on load
if (workspaceView && historyView) {
    const savedView = localStorage.getItem('activeView');
    if (savedView === 'history') {
        workspaceView.classList.add('hide');
        historyView.classList.remove('hide');
        loadHistory();
    } else {
        workspaceView.classList.remove('hide');
        historyView.classList.add('hide');
    }
}
updateGallery();

if (btnHistoryClear) {
    btnHistoryClear.addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_BASE}/v1/history`, { method: 'DELETE' });
            if (response.ok) {
                // Clear the canvas assets from local memory and localStorage
                assets = [];
                localStorage.setItem('canvasAssets', JSON.stringify(assets));
                updateGallery();
                
                await loadHistory();
                showToast("All generation history and files cleared!", "success");
            } else {
                showToast("Failed to clear history on the server.", "error");
            }
        } catch (e) {
            console.error("Error clearing history:", e);
            showToast("Error communicating with server to clear history.", "error");
        }
    });
}

async function loadHistory() {
    if (!historyViewItems) return;
    historyViewItems.innerHTML = '<div class="history-empty">Loading history items...</div>';

    try {
        const response = await fetch(`${API_BASE}/v1/history`);
        if (!response.ok) throw new Error('Failed to fetch history');
        
        const data = await response.json();
        const historyItems = data.history || [];

        if (historyItems.length === 0) {
            historyViewItems.innerHTML = '<div class="history-empty">No generations in history. Start creating!</div>';
            return;
        }

        historyViewItems.innerHTML = historyItems.map((item: any) => {
            const isVid = item.type === 'video';
            
            // Extract filename from download URL
            const urlParts = item.url.split('/');
            const filename = urlParts[urlParts.length - 1];

            // Check if already in canvas
            const isAdded = assets.some(asset => asset.url === item.url);
            const importBtnText = isAdded ? 'Added Canvas' : 'Add Canvas';
            const importBtnClass = isAdded ? 'added-canvas' : '';

            // Primary action: Add Reference (if media_id is present) or Add Canvas
            let actionBtnHtml = '';
            if (item.media_id) {
                actionBtnHtml = `<button class="history-btn-small success btn-hist-add-ref" data-media-id="${item.media_id}" data-url="${item.url}" data-type="${item.type}">Add Reference</button>`;
            } else {
                actionBtnHtml = `<button class="history-btn-small primary btn-hist-import ${importBtnClass}" data-url="${item.url}" data-type="${item.type}" data-prompt="${escapeHtml(item.prompt)}">${importBtnText}</button>`;
            }

            const mediaHtml = isVid 
                ? `<video src="${item.url}" muted></video><div class="history-play-icon">▶</div>`
                : `<img src="${item.url}" alt="${escapeHtml(item.prompt)}">`;

            return `
                <div class="history-card" data-filename="${filename}">
                    <div class="history-media-wrapper" data-url="${item.url}" data-type="${item.type}" data-prompt="${escapeHtml(item.prompt)}" data-media-id="${item.media_id || ''}" draggable="true">
                        ${mediaHtml}
                    </div>
                    <p class="history-prompt" title="${escapeHtml(item.prompt)}">${escapeHtml(item.prompt)}</p>
                    <div class="history-actions">
                        ${actionBtnHtml}
                        <a href="${item.url}" download="${filename}" target="_blank" class="history-btn-small success" style="text-decoration: none; line-height: 1.8; display: inline-block;">Download</a>
                        <button class="history-btn-small primary btn-hist-import ${importBtnClass}" data-url="${item.url}" data-type="${item.type}" data-prompt="${escapeHtml(item.prompt)}" data-media-id="${item.media_id || ''}" style="${item.media_id ? 'grid-column: span 1' : 'display:none;'}">${importBtnText}</button>
                        <button class="history-btn-small danger btn-hist-delete" data-filename="${filename}" style="${item.media_id ? 'grid-column: span 1' : 'grid-column: span 2'}">${'Delete'}</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click and drag listeners to historical media cards for Lightbox preview / reference dragging
        historyViewItems.querySelectorAll<HTMLDivElement>('.history-media-wrapper').forEach(wrapper => {
            wrapper.addEventListener('click', () => {
                const url = wrapper.getAttribute('data-url') || '';
                const type = wrapper.getAttribute('data-type') as 'image' | 'video';
                const prompt = wrapper.getAttribute('data-prompt') || '';
                const media_id = wrapper.getAttribute('data-media-id') || undefined;
                openLightbox({ type, url, prompt, media_id });
            });

            wrapper.addEventListener('dragstart', (e) => {
                const url = wrapper.getAttribute('data-url') || '';
                const mediaId = wrapper.getAttribute('data-media-id') || '';
                const type = wrapper.getAttribute('data-type') || 'image';
                if (url && e.dataTransfer) {
                    e.dataTransfer.setData('text/uri-list', url);
                    e.dataTransfer.setData('text/plain', url);
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        url: url,
                        media_id: mediaId,
                        type: type
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                }
            });
        });

        // Attach Add Reference click listeners
        historyViewItems.querySelectorAll<HTMLButtonElement>('.btn-hist-add-ref').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mediaId = btn.getAttribute('data-media-id') || '';
                const url = btn.getAttribute('data-url') || '';
                const type = btn.getAttribute('data-type') || 'image';
                if (mediaId && url) {
                    const activeTab = localStorage.getItem('activeTab') || 'image';
                    if (activeTab === 'image') {
                        if (type === 'image') {
                            addImageReference(url, mediaId);
                        } else {
                            showToast("You can only add image references to the Image Generator.", "error");
                            return;
                        }
                    } else if (activeTab === 'bulk') {
                        if (type === 'image') {
                            addBulkImageReference(url, mediaId);
                        } else {
                            showToast("Only image references are supported for bulk generation style.", "error");
                            return;
                        }
                    } else {
                        addReference(url, mediaId);
                    }
                    // Switch back to workspace view
                    historyView?.classList.add('hide');
                    workspaceView?.classList.remove('hide');
                    localStorage.setItem('activeView', 'workspace');
                }
            });
        });

        // Attach Add to Canvas click listeners
        historyViewItems.querySelectorAll<HTMLButtonElement>('.btn-hist-import').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.getAttribute('data-url') || '';
                const type = btn.getAttribute('data-type') as 'image' | 'video';
                const prompt = btn.getAttribute('data-prompt') || '';
                const media_id = btn.getAttribute('data-media-id') || undefined;
                
                if (url) {
                    const index = assets.findIndex(asset => asset.url === url);
                    if (index !== -1) {
                        // Remove from canvas
                        assets.splice(index, 1);
                        localStorage.setItem('canvasAssets', JSON.stringify(assets));
                        updateGallery();
                        
                        // Sync multiple buttons for the same item in the card if they exist
                        const siblingBtns = btn.closest('.history-card')?.querySelectorAll<HTMLButtonElement>('.btn-hist-import');
                        siblingBtns?.forEach(sBtn => {
                            sBtn.textContent = 'Add Canvas';
                            sBtn.classList.remove('added-canvas');
                        });
                        
                        showToast('Removed from canvas', 'success');
                    } else {
                        // Add to canvas
                        addAsset({ type, url, prompt, media_id });
                        
                        // Sync multiple buttons for the same item in the card if they exist
                        const siblingBtns = btn.closest('.history-card')?.querySelectorAll<HTMLButtonElement>('.btn-hist-import');
                        siblingBtns?.forEach(sBtn => {
                            sBtn.textContent = 'Added Canvas';
                            sBtn.classList.add('added-canvas');
                        });
                        
                        showToast('Added to canvas!', 'success');
                    }
                }
            });
        });

        // Attach Delete Item click listeners
        historyViewItems.querySelectorAll<HTMLButtonElement>('.btn-hist-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const filename = btn.getAttribute('data-filename') || '';
                if (!filename) return;

                try {
                    const response = await fetch(`${API_BASE}/v1/history/${filename}`, { method: 'DELETE' });
                    if (response.ok) {
                        // Remove element from DOM locally
                        const card = btn.closest('.history-card');
                        if (card) {
                            card.remove();
                        }
                        
                        // Also remove from canvas assets if present
                        const initialLen = assets.length;
                        assets = assets.filter(asset => {
                            const parts = asset.url.split('/');
                            const assetFilename = parts[parts.length - 1];
                            return assetFilename !== filename;
                        });
                        if (assets.length !== initialLen) {
                            localStorage.setItem('canvasAssets', JSON.stringify(assets));
                            updateGallery();
                        }

                        showToast("Asset deleted successfully!", "success");
                        // Check if grid is now empty
                        const remainingCards = historyViewItems.querySelectorAll('.history-card');
                        if (remainingCards.length === 0) {
                            historyViewItems.innerHTML = '<div class="history-empty">No generations in history. Start creating!</div>';
                        }
                    } else {
                        showToast("Failed to delete item from server.", "error");
                    }
                } catch (err) {
                    console.error("Error deleting history item:", err);
                    showToast("Error communicating with server to delete item.", "error");
                }
            });
        });

    } catch (err) {
        historyViewItems.innerHTML = '<div class="history-empty">No generations in history. Start creating!</div>';
    }
}

// Initialize Bulk Prompt Uploader
initBulkPromptUploader();

// Wire Bulk Results Excel Export Button
const btnBulkResultsExport = document.getElementById('bulk-results-export');
if (btnBulkResultsExport) {
    btnBulkResultsExport.addEventListener('click', () => {
        const bulkAssets = assets.filter(asset => asset.isBulk === true);
        if (bulkAssets.length === 0) {
            showToast('No bulk assets found to export.', 'error');
            return;
        }

        const dataToExport = bulkAssets.map((asset, index) => {
            const urlParts = asset.url.split('/');
            const filename = urlParts[urlParts.length - 1];
            return {
                "S.No": index + 1,
                "Prompt": asset.prompt,
                "Media Type": asset.type,
                "Media ID": asset.media_id || 'N/A',
                "File Name": filename,
                "URL": asset.url
            };
        });

        try {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            XLSX.utils.book_append_sheet(wb, ws, "Bulk Generation Results");
            
            // Format filename based on loaded template name or default
            const exportName = loadedFilename 
                ? `results_${loadedFilename.replace(/\.[^/.]+$/, "")}.xlsx` 
                : 'bulk_generation_results.xlsx';
                
            XLSX.writeFile(wb, exportName);
            showToast(`Exported results as ${exportName}!`, 'success');
        } catch (e) {
            console.error('Error generating export Excel:', e);
            showToast('Failed to export Excel file.', 'error');
        }
    });
}
