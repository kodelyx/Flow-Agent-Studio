const API_BASE = 'http://127.0.0.1:8001';

interface GeneratedAsset {
    type: 'image' | 'video';
    url: string;
    prompt: string;
    media_id?: string;
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
const imgSize = document.getElementById('img-size') as HTMLSelectElement | null;
const imgCount = document.getElementById('img-count') as HTMLSelectElement | null;
const vidPrompt = document.getElementById('vid-prompt') as HTMLTextAreaElement | null;
const vidAspect = document.getElementById('vid-aspect') as HTMLSelectElement | null;
const vidCount = document.getElementById('vid-count') as HTMLSelectElement | null;
const vidDuration = document.getElementById('vid-duration') as HTMLSelectElement | null;
const assetCountBadge = document.getElementById('asset-count') as HTMLSpanElement | null;
const btnClearCanvas = document.getElementById('btn-clear-canvas') as HTMLButtonElement | null;
const emptyState = document.getElementById('empty-state') as HTMLDivElement | null;
const galleryGrid = document.getElementById('gallery-grid') as HTMLDivElement | null;
const mediaModal = document.getElementById('media-modal') as HTMLDivElement | null;
const modalMediaContainer = document.getElementById('modal-media-container') as HTMLDivElement | null;
const modalPrompt = document.getElementById('modal-prompt') as HTMLParagraphElement | null;
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

let assets: GeneratedAsset[] = (() => {
    try {
        const saved = localStorage.getItem('canvasAssets');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('Error parsing canvasAssets:', e);
        return [];
    }
})();
let selectedReferences: ReferenceImage[] = [];
let selectedImageReferences: ReferenceImage[] = [];
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
            if (targetPanel) targetPanel.classList.add('active');
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
        <div class="ref-thumb-add-more" style="width: 58px; height: 58px; border-radius: 12px; border: 2px dashed rgba(255, 55, 95, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--accent-red); cursor: pointer; background: rgba(255, 55, 95, 0.05); font-weight: bold;">
            +
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
        <div class="ref-thumb-add-more" style="width: 58px; height: 58px; border-radius: 12px; border: 2px dashed rgba(255, 55, 95, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--accent-red); cursor: pointer; background: rgba(255, 55, 95, 0.05); font-weight: bold;">
            +
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
function setCanvasLoading(isLoading: boolean, title: string = 'Generating...', status: string = '', type?: 'image' | 'video') {
    const targetType = type || (localStorage.getItem('activeTab') || 'image') as 'image' | 'video';
    
    if (targetType === 'image') {
        isGeneratingImg = isLoading;
        if (isLoading) {
            imgLoadingTitle = title;
            imgLoadingStatus = status;
        }
    } else {
        isGeneratingVid = isLoading;
        if (isLoading) {
            vidLoadingTitle = title;
            vidLoadingStatus = status;
        }
    }
    
    updateGallery();
}

function setButtonLoading(btn: HTMLButtonElement | null, isLoading: boolean) {
    if (btn) {
        btn.disabled = isLoading;
    }
}

if (btnClearCanvas) {
    btnClearCanvas.addEventListener('click', () => {
        if (assets.length === 0) {
            showToast('Canvas is already empty', 'info');
            return;
        }
        assets = [];
        localStorage.setItem('canvasAssets', JSON.stringify(assets));
        updateGallery();
        showToast('Canvas cleared successfully!', 'success');
    });
}

// Image Generation
if (btnGenerateImg) {
    btnGenerateImg.addEventListener('click', async () => {
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
        setCanvasLoading(true, 'Creating Images...', loadingMsg, 'image');

        try {
            const bodyPayload: any = {
                prompt: prompt,
                size: imgSize.value,
                n: parseInt(imgCount.value),
                response_format: 'url'
            };
            if (selectedImageReferences.length > 0) {
                bodyPayload.ref_media_ids = selectedImageReferences.map(ref => ref.media_id);
            }

            const response = await fetch(`${API_BASE}/v1/images/generations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
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
                imgPrompt.value = '';
                localStorage.removeItem('imgPrompt');

                // Clear references list
                selectedImageReferences = [];
                updateImageReferencesUI();
                showToast("Images generated successfully!", "success");
            } else {
                showToast(`Error: ${result.detail || 'Failed to generate images'}`, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Could not connect to the Flow Agent server. Make sure it is running.', 'error');
        } finally {
            setButtonLoading(btnGenerateImg, false);
            setCanvasLoading(false, '', '', 'image');
        }
    });
}

// Video Generation
if (btnGenerateVid) {
    btnGenerateVid.addEventListener('click', async () => {
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
function addAsset(asset: GeneratedAsset) {
    assets.unshift(asset);
    localStorage.setItem('canvasAssets', JSON.stringify(assets));
    updateGallery();
}

function updateGallery() {
    if (!assetCountBadge || !emptyState || !galleryGrid || !galleryLoader || !loaderTitle) return;
    
    const activeTab = localStorage.getItem('activeTab') || 'image';
    
    // Toggle Dynamic Action groups
    const imageActions = document.getElementById('gallery-image-actions');
    const videoActions = document.getElementById('gallery-video-actions');
    if (imageActions && videoActions) {
        if (activeTab === 'image') {
            imageActions.classList.remove('hide');
            videoActions.classList.add('hide');
        } else {
            imageActions.classList.add('hide');
            videoActions.classList.remove('hide');
        }
    }
    
    // Check if the currently active tab is generating/loading
    const isGenerating = activeTab === 'image' ? isGeneratingImg : isGeneratingVid;
    
    if (isGenerating) {
        galleryLoader.classList.remove('hide');
        emptyState.classList.add('hide');
        galleryGrid.classList.add('hide');
        
        loaderTitle.textContent = activeTab === 'image' ? imgLoadingTitle : vidLoadingTitle;
        if (loaderStatus) {
            loaderStatus.textContent = activeTab === 'image' ? imgLoadingStatus : vidLoadingStatus;
        }
        return;
    }
    
    galleryLoader.classList.add('hide');
    
    const filteredAssets = assets.filter(asset => asset.type === activeTab);
    
    assetCountBadge.textContent = `${filteredAssets.length}`;
    
    if (filteredAssets.length === 0) {
        emptyState.classList.remove('hide');
        galleryGrid.classList.add('hide');
        const emptyTitle = emptyState.querySelector('h3');
        const emptyText = emptyState.querySelector('p');
        if (emptyTitle && emptyText) {
            if (activeTab === 'image') {
                emptyTitle.textContent = "No Image Assets";
                emptyText.textContent = "Generate images using the prompt panel to see them here.";
            } else {
                emptyTitle.textContent = "No Video Assets";
                emptyText.textContent = "Generate videos using the prompt panel to see them here.";
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
                  <button class="add-to-vid-btn add-to-img-ref-btn" data-index="${globalIndex}" title="Add reference to Image Generator">Add Image Ref</button>
                  <button class="add-to-vid-btn add-to-vid-ref-btn" data-index="${globalIndex}" title="Add reference to Video Generator">Add Video Ref</button>
                  `
                : '';
            return `
                <div class="gallery-item" data-index="${globalIndex}" draggable="true">
                    <img src="${asset.url}" alt="${escapeHtml(asset.prompt)}" loading="lazy">
                    <div class="item-overlay">
                        <p class="overlay-prompt">${escapeHtml(asset.prompt)}</p>
                        ${addBtnHtml}
                    </div>
                </div>
            `;
        } else {
            const addBtnHtml = asset.media_id
                ? `<button class="add-to-vid-btn add-to-vid-ref-btn" data-index="${globalIndex}" title="Add reference to Video Generator">Add Video Ref</button>`
                : '';
            const autoplayAttr = autoplayVideos ? 'autoplay' : '';
            return `
                <div class="gallery-item" data-index="${globalIndex}" draggable="true">
                    <video src="${asset.url}" muted loop ${autoplayAttr}></video>
                    ${autoplayVideos ? '' : '<div class="play-badge">▶</div>'}
                    <div class="item-overlay">
                        <p class="overlay-prompt">${escapeHtml(asset.prompt)}</p>
                        ${addBtnHtml}
                    </div>
                </div>
            `;
        }
    }).join('');

    // Attach click listeners to gallery items (excluding buttons inside)
    document.querySelectorAll<HTMLDivElement>('.gallery-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target instanceof HTMLElement && e.target.closest('.add-to-vid-btn')) {
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
}

// Lightbox Modal
function openLightbox(asset: GeneratedAsset) {
    if (!modalMediaContainer || !modalPrompt || !modalDownload || !mediaModal || !modalAddToVideo) return;
    
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

    modalPrompt.textContent = asset.prompt;
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

async function updateCredits() {
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

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
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
