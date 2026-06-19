import * as XLSX from 'xlsx';
import {
    API_BASE,
    addAsset,
    setCanvasLoading,
    setButtonLoading,
    showToast,
    clearBulkAssets,
    updateCredits,
    updateGallery
} from './client.js';
import { animateButtonPress } from './animation.js';

export interface ParsedBulkItem {
    prompt: string;
    type: 'image' | 'video';
    size?: string;
    aspect?: string;
    variations?: number;
    duration?: number;
    styleRefs?: string[];
    originalIndex?: number;
}

export interface BulkQueue {
    id: number;
    type: 'image' | 'video';
    prompts: string[];
    currentIndex: number;
    isRunning: boolean;
}

export let activeImgQueue: BulkQueue | null = null;
export let activeVidQueue: BulkQueue | null = null;
export let loadedBulkItems: ParsedBulkItem[] = [];
export let loadedFilename = '';
export let bulkRowMediaIds: { [rowIdx: number]: string[] } = {};
export let bulkRowStatus: { [rowIdx: number]: string } = {};

export function addBulkImageReference(url: string, mediaId: string) {
    showToast("To use references in bulk runs, add columns like 'Reference 1', 'Reference 2', 'Reference 3', etc. with image URLs in your Excel file.", "info");
}

export function initBulkPromptUploader() {
    // 1. Template dropzone & file input setup
    const templateDropzone = document.getElementById('bulk-template-dropzone');
    const templateInput = document.getElementById('bulk-template-input') as HTMLInputElement | null;

    if (templateDropzone && templateInput) {
        templateDropzone.addEventListener('click', (e) => {
            if (e.target instanceof HTMLElement && e.target.closest('#btn-clear-bulk')) {
                return;
            }
            templateInput.click();
        });

        templateInput.addEventListener('change', () => {
            if (templateInput.files && templateInput.files.length > 0) {
                handleTemplateFile(templateInput.files[0]);
                templateInput.value = '';
            }
        });

        templateDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            templateDropzone.classList.add('dragover');
        });

        templateDropzone.addEventListener('dragleave', () => {
            templateDropzone.classList.remove('dragover');
        });

        templateDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            templateDropzone.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                const nameLower = file.name.toLowerCase();
                if (nameLower.endsWith('.txt') || nameLower.endsWith('.csv') || nameLower.endsWith('.xlsx')) {
                    handleTemplateFile(file);
                } else {
                    showToast('Please drop a valid .txt, .csv, or .xlsx file.', 'error');
                }
            }
        });
    }

    // 2. Clear bulk button handler
    const btnClearBulk = document.getElementById('btn-clear-bulk');
    if (btnClearBulk) {
        btnClearBulk.addEventListener('click', (e) => {
            e.stopPropagation();
            loadedBulkItems = [];
            loadedFilename = '';
            updateBulkUI();
            updateGallery();
            showToast('Bulk template cleared', 'info');
        });
    }

    // 3. Persist and restore Default Settings
    const bulkImgSize = document.getElementById('bulk-img-size') as HTMLSelectElement | null;
    const bulkImgCount = document.getElementById('bulk-img-count') as HTMLSelectElement | null;
    const bulkVidAspect = document.getElementById('bulk-vid-aspect') as HTMLSelectElement | null;
    const bulkVidDuration = document.getElementById('bulk-vid-duration') as HTMLSelectElement | null;
    const bulkVidCount = document.getElementById('bulk-vid-count') as HTMLSelectElement | null;

    if (bulkImgSize) {
        bulkImgSize.value = localStorage.getItem('bulkImgSize') || '1024x1024';
        bulkImgSize.addEventListener('change', () => {
            localStorage.setItem('bulkImgSize', bulkImgSize.value);
        });
    }
    if (bulkImgCount) {
        bulkImgCount.value = localStorage.getItem('bulkImgCount') || '4';
        bulkImgCount.addEventListener('change', () => {
            localStorage.setItem('bulkImgCount', bulkImgCount.value);
        });
    }
    if (bulkVidAspect) {
        bulkVidAspect.value = localStorage.getItem('bulkVidAspect') || 'landscape';
        bulkVidAspect.addEventListener('change', () => {
            localStorage.setItem('bulkVidAspect', bulkVidAspect.value);
        });
    }
    if (bulkVidDuration) {
        bulkVidDuration.value = localStorage.getItem('bulkVidDuration') || '8';
        bulkVidDuration.addEventListener('change', () => {
            localStorage.setItem('bulkVidDuration', bulkVidDuration.value);
        });
    }
    if (bulkVidCount) {
        bulkVidCount.value = localStorage.getItem('bulkVidCount') || '1';
        bulkVidCount.addEventListener('change', () => {
            localStorage.setItem('bulkVidCount', bulkVidCount.value);
        });
    }

    // 4. Start Queue button setup
    const btnStartBulk = document.getElementById('btn-start-bulk');
    if (btnStartBulk) {
        btnStartBulk.addEventListener('click', () => {
            if (loadedBulkItems.length === 0) {
                showToast('Please upload a template file first.', 'error');
                return;
            }
            startBulkQueue(loadedBulkItems);
        });
    }

    // 5. Cancel Queue setup
    const btnCancelQueue = document.getElementById('btn-cancel-queue');
    const btnCancelBulk = document.getElementById('btn-cancel-bulk');

    const handleCancel = () => {
        let isCanceled = false;
        if (activeImgQueue) {
            activeImgQueue.isRunning = false;
            isCanceled = true;
        }
        if (activeVidQueue) {
            activeVidQueue.isRunning = false;
            isCanceled = true;
        }
        if (isCanceled) {
            showToast('Canceling bulk prompt queue...', 'info');
            
            // Instantly revert UI states
            const btnStartBulkEl = document.getElementById('btn-start-bulk') as HTMLButtonElement | null;
            setButtonLoading(btnStartBulkEl, false);
            
            setCanvasLoading(false, '', '', 'image');
            setCanvasLoading(false, '', '', 'video');
            if (btnCancelQueue) btnCancelQueue.classList.add('hide');
            if (btnCancelBulk) btnCancelBulk.classList.add('hide');

            const imgRow = document.getElementById('bulk-progress-img-row');
            if (imgRow) imgRow.classList.add('hide');
            const vidRow = document.getElementById('bulk-progress-vid-row');
            if (vidRow) vidRow.classList.add('hide');
            const container = document.getElementById('bulk-progress-container');
            if (container) container.classList.add('hide');
        }
    };

    if (btnCancelQueue) {
        btnCancelQueue.addEventListener('click', handleCancel);
    }
    if (btnCancelBulk) {
        btnCancelBulk.addEventListener('click', handleCancel);
    }
}

function handleTemplateFile(file: File) {
    const nameLower = file.name.toLowerCase();
    const reader = new FileReader();

    if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.csv')) {
        reader.onload = (e) => {
            if (e.target && e.target.result) {
                try {
                    const data = new Uint8Array(e.target.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rawRows = XLSX.utils.sheet_to_json(worksheet) as any[];
                    
                    const items: ParsedBulkItem[] = [];
                    let idx = 0;
                    for (const row of rawRows) {
                        const mapped = mapRowToBulkItem(row);
                        if (mapped) {
                            mapped.originalIndex = idx++;
                            items.push(mapped);
                        }
                    }

                    if (items.length === 0) {
                        showToast('No valid prompts found in the file.', 'error');
                        return;
                    }
                    loadedBulkItems = items;
                    loadedFilename = file.name;
                    updateBulkUI();
                    updateGallery();
                    showToast(`Loaded ${items.length} prompts`, 'success');
                    setTimeout(() => {
                        showToast('Click Start to generate', 'info');
                    }, 800);
                } catch (err) {
                    console.error('Error reading Excel/CSV file:', err);
                    showToast('Failed to parse spreadsheet file.', 'error');
                }
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        reader.onload = (e) => {
            if (e.target && typeof e.target.result === 'string') {
                const content = e.target.result;
                const items = parseTextFile(content);
                if (items.length === 0) {
                    showToast('No valid prompts found in the file.', 'error');
                    return;
                }
                loadedBulkItems = items;
                loadedFilename = file.name;
                updateBulkUI();
                updateGallery();
                showToast(`Loaded ${items.length} prompts`, 'success');
                setTimeout(() => {
                    showToast('Click Start to generate', 'info');
                }, 800);
            }
        };
        reader.readAsText(file);
    }
}

function parseTextFile(content: string): ParsedBulkItem[] {
    const lines = content.split(/\r?\n/);
    const items: ParsedBulkItem[] = [];
    let idx = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.toLowerCase() !== 'prompt' && trimmed.toLowerCase() !== 'text' && trimmed.toLowerCase() !== 'description') {
            items.push({
                prompt: trimmed,
                type: 'image',
                originalIndex: idx++
            });
        }
    }
    return items;
}

function parseAspectRatioToSize(val: string): string {
    const clean = val.replace(/\s+/g, '').toLowerCase();
    const ratioMap: { [key: string]: string } = {
        '1:1': '1024x1024',
        'square': '1024x1024',
        '1024x1024': '1024x1024',
        
        '9:16': '1024x1792',
        'portrait': '1024x1792',
        '1024x1792': '1024x1792',
        
        '16:9': '1792x1024',
        'landscape': '1792x1024',
        '1792x1024': '1792x1024',
        
        '4:3': '1024x768',
        '1024x768': '1024x768',
        
        '3:4': '768x1024',
        '768x1024': '768x1024'
    };
    if (ratioMap[clean]) {
        return ratioMap[clean];
    }

    // Heuristics for keywords
    if (clean.includes('wide') || clean.includes('horiz') || clean.includes('land')) {
        return '1792x1024';
    }
    if (clean.includes('tall') || clean.includes('vert') || clean.includes('port')) {
        return '1024x1792';
    }
    if (clean.includes('square')) {
        return '1024x1024';
    }

    // Extract ratio numerically to find closest allowed
    const match = clean.match(/^(\d+(?:\.\d+)?)[:x/*](\d+(?:\.\d+)?)$/);
    let targetRatio = 1.0;
    let hasParsedRatio = false;

    if (match) {
        const w = parseFloat(match[1]);
        const h = parseFloat(match[2]);
        if (w > 0 && h > 0) {
            targetRatio = w / h;
            hasParsedRatio = true;
        }
    } else {
        const num = parseFloat(clean);
        if (!isNaN(num) && num > 0) {
            targetRatio = num;
            hasParsedRatio = true;
        }
    }

    const allowed = [
        { name: '1024x1024', ratio: 1.0 },
        { name: '1024x1792', ratio: 1024 / 1792 },
        { name: '1792x1024', ratio: 1792 / 1024 },
        { name: '1024x768', ratio: 1024 / 768 },
        { name: '768x1024', ratio: 768 / 1024 }
    ];

    if (hasParsedRatio) {
        let best = allowed[0];
        let minDiff = Math.abs(best.ratio - targetRatio);
        for (let i = 1; i < allowed.length; i++) {
            const diff = Math.abs(allowed[i].ratio - targetRatio);
            if (diff < minDiff) {
                minDiff = diff;
                best = allowed[i];
            }
        }
        return best.name;
    }

    return '1024x1024'; // Fallback
}

function mapRowToBulkItem(row: any): ParsedBulkItem | null {
    if (!row) return null;
    
    // Find prompt
    let promptVal = '';
    for (const key of ['prompt', 'text', 'description', 'message', 'instructions']) {
        const foundKey = Object.keys(row).find(k => k.toLowerCase() === key);
        if (foundKey && row[foundKey] !== undefined) {
            promptVal = String(row[foundKey]).trim();
            break;
        }
    }
    
    if (!promptVal) {
        const keys = Object.keys(row);
        if (keys.length > 0) {
            promptVal = String(row[keys[0]]).trim();
        }
    }

    if (!promptVal || promptVal.toLowerCase() === 'prompt' || promptVal.toLowerCase() === 'text' || promptVal.toLowerCase() === 'description') {
        return null;
    }

    // Find modality
    let typeVal: 'image' | 'video' = 'image';
    for (const key of ['modality', 'type', 'mode', 'media_type', 'generate']) {
        const foundKey = Object.keys(row).find(k => k.toLowerCase() === key);
        if (foundKey && row[foundKey] !== undefined) {
            const val = String(row[foundKey]).toLowerCase();
            if (val.includes('video') || val.includes('vid') || val === 'v') {
                typeVal = 'video';
            }
            break;
        }
    }

    // Size / Aspect Ratio
    let sizeVal: string | undefined;
    let aspectVal: string | undefined;
    for (const key of ['size', 'aspect', 'aspect_ratio', 'ratio', 'dimensions']) {
        const foundKey = Object.keys(row).find(k => k.toLowerCase() === key);
        if (foundKey && row[foundKey] !== undefined) {
            const val = String(row[foundKey]).trim();
            if (typeVal === 'image') {
                sizeVal = parseAspectRatioToSize(val);
            } else {
                const clean = val.replace(/\s+/g, '').toLowerCase();
                if (clean === 'portrait' || clean === '9:16') {
                    aspectVal = 'portrait';
                } else if (clean === 'landscape' || clean === '16:9') {
                    aspectVal = 'landscape';
                } else {
                    if (clean.includes('wide') || clean.includes('horiz') || clean.includes('land')) {
                        aspectVal = 'landscape';
                    } else if (clean.includes('tall') || clean.includes('vert') || clean.includes('port')) {
                        aspectVal = 'portrait';
                    } else {
                        // Find closest between 9:16 (0.5714) and 16:9 (1.75)
                        const match = clean.match(/^(\d+(?:\.\d+)?)[:x/*](\d+(?:\.\d+)?)$/);
                        let targetRatio = 1.0;
                        let hasParsedRatio = false;
                        if (match) {
                            const w = parseFloat(match[1]);
                            const h = parseFloat(match[2]);
                            if (w > 0 && h > 0) {
                                targetRatio = w / h;
                                hasParsedRatio = true;
                            }
                        } else {
                            const num = parseFloat(clean);
                            if (!isNaN(num) && num > 0) {
                                targetRatio = num;
                                hasParsedRatio = true;
                            }
                        }
                        
                        if (hasParsedRatio) {
                            const distToPortrait = Math.abs((1024 / 1792) - targetRatio);
                            const distToLandscape = Math.abs((1792 / 1024) - targetRatio);
                            aspectVal = distToPortrait < distToLandscape ? 'portrait' : 'landscape';
                        } else {
                            aspectVal = 'landscape'; // Default fallback
                        }
                    }
                }
            }
            break;
        }
    }

    // Variations
    let variationsVal: number | undefined;
    for (const key of ['variations', 'n', 'count', 'quantity', 'num']) {
        const foundKey = Object.keys(row).find(k => k.toLowerCase() === key);
        if (foundKey && row[foundKey] !== undefined) {
            const num = parseInt(row[foundKey]);
            if (!isNaN(num)) {
                variationsVal = num;
            }
            break;
        }
    }

    // Duration
    let durationVal: number | undefined;
    for (const key of ['duration', 'time', 'seconds', 'sec']) {
        const foundKey = Object.keys(row).find(k => k.toLowerCase() === key);
        if (foundKey && row[foundKey] !== undefined) {
            const num = parseInt(row[foundKey]);
            if (!isNaN(num)) {
                durationVal = num;
            }
            break;
        }
    }

    // Style Refs: collect values from any matching columns (e.g. Reference 1, Reference 2, Ref 3, etc.)
    const styleRefsVal: string[] = [];
    const refKeyRegex = /^(reference|ref|style_ref|style\s*ref|image|style|ref_image)(\s*\d+)?$/i;

    for (const key of Object.keys(row)) {
        if (refKeyRegex.test(key.trim())) {
            const val = String(row[key]).trim();
            if (val) {
                // Support comma/pipe separated values within a single cell, as well as separate columns
                const splitVals = val.split(/[|,]/).map(s => s.trim()).filter(Boolean);
                styleRefsVal.push(...splitVals);
            }
        }
    }

    return {
        prompt: promptVal,
        type: typeVal,
        size: sizeVal,
        aspect: aspectVal,
        variations: variationsVal,
        duration: durationVal,
        styleRefs: styleRefsVal
    };
}
export function updateBulkUI() {
    const placeholder = document.getElementById('bulk-template-placeholder');
    const info = document.getElementById('bulk-template-info');
    const fileNameSpan = info?.querySelector('.file-name');
    const fileStatusSpan = info?.querySelector('.file-status');
    const btnStart = document.getElementById('btn-start-bulk');
    
    const bulkImgSettings = document.getElementById('bulk-img-settings');
    const bulkVidSettings = document.getElementById('bulk-vid-settings');

    if (loadedBulkItems.length > 0) {
        if (placeholder) placeholder.classList.add('hide');
        if (info) info.classList.remove('hide');
        if (fileNameSpan) {
            fileNameSpan.textContent = loadedFilename;
        }

        const imageCount = loadedBulkItems.filter(item => item.type === 'image').length;
        const videoCount = loadedBulkItems.filter(item => item.type === 'video').length;

        // Dynamic visibility based on template contents:
        if (imageCount > 0) {
            bulkImgSettings?.classList.remove('hide');
        } else {
            bulkImgSettings?.classList.add('hide');
        }

        if (videoCount > 0) {
            bulkVidSettings?.classList.remove('hide');
        } else {
            bulkVidSettings?.classList.add('hide');
        }

        let statusText = '';
        if (imageCount > 0 && videoCount > 0) {
            statusText = `📦 ${loadedBulkItems.length} Prompts (${imageCount} Img, ${videoCount} Vid)`;
        } else if (imageCount > 0) {
            statusText = `📦 ${loadedBulkItems.length} Image Prompts`;
        } else if (videoCount > 0) {
            statusText = `📦 ${loadedBulkItems.length} Video Prompts`;
        } else {
            statusText = `📦 ${loadedBulkItems.length} Prompts Loaded`;
        }
        
        if (fileStatusSpan) {
            fileStatusSpan.textContent = statusText;
        }
        if (btnStart) {
            const span = btnStart.querySelector('span');
            if (span) {
                span.textContent = `Start Generation (${loadedBulkItems.length} runs)`;
            }
        }
    } else {
        if (placeholder) placeholder.classList.remove('hide');
        if (info) info.classList.add('hide');
        
        // Hide both settings when no file is loaded:
        bulkImgSettings?.classList.add('hide');
        bulkVidSettings?.classList.add('hide');

        if (btnStart) {
            const span = btnStart.querySelector('span');
            if (span) {
                span.textContent = 'Start Generation';
            }
        }
    }
}

async function uploadStyleRefFromUrl(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const blob = await response.blob();
        
        const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(new Error('Failed to read as base64'));
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });

        const uploadResp = await fetch(`${API_BASE}/v1/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_base64: base64Data
            })
        });

        if (!uploadResp.ok) {
            const errResult = await uploadResp.json();
            throw new Error(errResult.detail || 'Upload failed');
        }

        const result = await uploadResp.json();
        return result.media_id || null;
    } catch (e) {
        console.error(`CORS or upload error for URL ${url}:`, e);
        return null;
    }
}

function updateProgressBar(type: 'image' | 'video', currentIndex: number, total: number, isFinished = false) {
    const container = document.getElementById('bulk-progress-container');
    if (!container) return;

    const rowId = type === 'image' ? 'bulk-progress-img-row' : 'bulk-progress-vid-row';
    const counterId = type === 'image' ? 'bulk-img-counter' : 'bulk-vid-counter';
    const fillId = type === 'image' ? 'bulk-img-fill' : 'bulk-vid-fill';
    const percentId = type === 'image' ? 'bulk-img-percent' : 'bulk-vid-percent';

    const rowEl = document.getElementById(rowId);
    const counterEl = document.getElementById(counterId);
    const fillEl = document.getElementById(fillId);
    const percentEl = document.getElementById(percentId);

    if (isFinished) {
        if (rowEl) rowEl.classList.add('hide');
        
        // Hide container if both are finished/hidden
        const imgRow = document.getElementById('bulk-progress-img-row');
        const vidRow = document.getElementById('bulk-progress-vid-row');
        const isImgHidden = !imgRow || imgRow.classList.contains('hide');
        const isVidHidden = !vidRow || vidRow.classList.contains('hide');
        if (isImgHidden && isVidHidden) {
            container.classList.add('hide');
        }
        return;
    }

    container.classList.remove('hide');
    if (rowEl) rowEl.classList.remove('hide');

    const currentRun = currentIndex + 1;
    const progressPercent = total > 0 ? Math.round((currentIndex / total) * 100) : 0;

    if (counterEl) counterEl.textContent = `${currentRun} / ${total}`;
    if (fillEl) fillEl.style.width = `${progressPercent}%`;
    if (percentEl) percentEl.textContent = `${progressPercent}%`;
}

function checkQueueFinished() {
    const isImageRunning = activeImgQueue && activeImgQueue.isRunning;
    const isVideoRunning = activeVidQueue && activeVidQueue.isRunning;

    if (!isImageRunning && !isVideoRunning) {
        const btnStartBulk = document.getElementById('btn-start-bulk') as HTMLButtonElement | null;
        setButtonLoading(btnStartBulk, false);

        const btnCancelQueue = document.getElementById('btn-cancel-queue');
        if (btnCancelQueue) btnCancelQueue.classList.add('hide');

        const btnCancelBulk = document.getElementById('btn-cancel-bulk');
        if (btnCancelBulk) btnCancelBulk.classList.add('hide');
    }
}

async function resolveStyleRefsForQueue(
    item: ParsedBulkItem,
    type: 'image' | 'video'
): Promise<{ refMediaIds: string[]; startMediaId?: string; isVideo?: boolean }> {
    const refMediaIds: string[] = [];
    let startMediaId: string | undefined;
    let isVideo: boolean | undefined;

    if (!item.styleRefs || item.styleRefs.length === 0) {
        return { refMediaIds };
    }

    for (let j = 0; j < item.styleRefs.length; j++) {
        const ref: string = item.styleRefs[j];
        const urlLower = ref.toLowerCase();

        const match: RegExpMatchArray | null = ref.match(/^@(\d+)$/);
        if (match) {
            const targetRowIdx = parseInt(match[1]) - 1;
            if (targetRowIdx < 0 || targetRowIdx >= loadedBulkItems.length) {
                showToast(`Reference @${targetRowIdx + 1} is out of bounds. Skipping.`, 'error');
                continue;
            }

            const depItem = loadedBulkItems[targetRowIdx];
            const timeoutMs = 180000;
            const startWait = Date.now();

            if (item.originalIndex !== undefined) {
                bulkRowStatus[item.originalIndex] = `Waiting for Row ${targetRowIdx + 1}...`;
                updateGallery();
            }

            while (!bulkRowMediaIds[targetRowIdx]) {
                if (type === 'image' && (!activeImgQueue || !activeImgQueue.isRunning)) {
                    throw new Error('Image generation queue cancelled.');
                }
                if (type === 'video' && (!activeVidQueue || !activeVidQueue.isRunning)) {
                    throw new Error('Video generation queue cancelled.');
                }

                const isTargetImg = depItem.type === 'image';
                if (isTargetImg) {
                    if (!activeImgQueue || !activeImgQueue.isRunning) {
                        break;
                    }
                } else {
                    if (!activeVidQueue || !activeVidQueue.isRunning) {
                        break;
                    }
                }

                if (Date.now() - startWait > timeoutMs) {
                    showToast(`Timeout waiting for reference Row ${targetRowIdx + 1}.`, 'info');
                    break;
                }

                await new Promise(r => setTimeout(r, 1000));
            }

            const depMediaIds = bulkRowMediaIds[targetRowIdx];
            if (depMediaIds && depMediaIds.length > 0) {
                refMediaIds.push(...depMediaIds);
                if (type === 'video' && depItem.type === 'video') {
                    startMediaId = depMediaIds[0];
                    isVideo = true;
                }
            } else {
                showToast(`Row ${targetRowIdx + 1} did not produce any output media. Skipping reference.`, 'info');
            }
        } else if (urlLower.startsWith('http') || urlLower.startsWith('data:image')) {
            setCanvasLoading(true, 'Uploading Reference...', `Uploading reference image ${j + 1} of ${item.styleRefs.length}...`, type);
            const mediaId = await uploadStyleRefFromUrl(ref);
            if (mediaId) {
                refMediaIds.push(mediaId);
                const isVid = urlLower.endsWith('.mp4') || urlLower.includes('_vid_') || urlLower.includes('video');
                if (type === 'video' && isVid) {
                    startMediaId = mediaId;
                    isVideo = true;
                }
            }
        } else {
            refMediaIds.push(ref);
        }
    }

    if (item.originalIndex !== undefined) {
        bulkRowStatus[item.originalIndex] = 'Generating...';
        updateGallery();
    }

    return { refMediaIds, startMediaId, isVideo };
}

async function runImageQueue(imageItems: ParsedBulkItem[]) {
    if (imageItems.length === 0) return;

    const currentQueueId = Date.now();
    activeImgQueue = {
        id: currentQueueId,
        type: 'image',
        prompts: imageItems.map(it => it.prompt),
        currentIndex: 0,
        isRunning: true
    };

    updateProgressBar('image', 0, imageItems.length);

    try {
        for (let i = 0; i < imageItems.length; i++) {
            if (!activeImgQueue || !activeImgQueue.isRunning) {
                break;
            }

            activeImgQueue.currentIndex = i;
            updateProgressBar('image', i, imageItems.length);
            const item = imageItems[i];

            const progressMsg = `Item ${i + 1} of ${imageItems.length} (image): "${item.prompt.length > 50 ? item.prompt.substring(0, 47) + '...' : item.prompt}"`;
            setCanvasLoading(true, 'Creating Images...', progressMsg, 'image');

            if (item.originalIndex !== undefined) {
                bulkRowStatus[item.originalIndex] = 'Generating...';
                updateGallery();
            }

            const resolved = await resolveStyleRefsForQueue(item, 'image');

            setCanvasLoading(true, 'Creating Images...', progressMsg, 'image');
            const generatedIds = await generateImageItem(item.prompt, item.size, item.variations, resolved.refMediaIds);
            
            if (item.originalIndex !== undefined) {
                bulkRowMediaIds[item.originalIndex] = generatedIds;
                bulkRowStatus[item.originalIndex] = 'Done';
                updateGallery();
            }
        }
    } catch (e) {
        console.error('Error in bulk image queue:', e);
        showToast('An error occurred during bulk image generation.', 'error');
    } finally {
        updateProgressBar('image', 0, 0, true);
        if (activeImgQueue && activeImgQueue.id === currentQueueId) {
            const wasRunning = activeImgQueue.isRunning;
            const completedCount = activeImgQueue.currentIndex + 1;
            activeImgQueue.isRunning = false;
            activeImgQueue = null;
            
            setCanvasLoading(false, '', '', 'image');
            updateCredits();
            checkQueueFinished();
            
            if (wasRunning && completedCount === imageItems.length) {
                showToast('All bulk image generations completed!', 'success');
            }
        }
    }
}

async function runVideoQueue(videoItems: ParsedBulkItem[]) {
    if (videoItems.length === 0) return;

    const currentQueueId = Date.now();
    activeVidQueue = {
        id: currentQueueId,
        type: 'video',
        prompts: videoItems.map(it => it.prompt),
        currentIndex: 0,
        isRunning: true
    };

    updateProgressBar('video', 0, videoItems.length);

    try {
        for (let i = 0; i < videoItems.length; i++) {
            if (!activeVidQueue || !activeVidQueue.isRunning) {
                break;
            }

            activeVidQueue.currentIndex = i;
            updateProgressBar('video', i, videoItems.length);
            const item = videoItems[i];

            const progressMsg = `Item ${i + 1} of ${videoItems.length} (video): "${item.prompt.length > 50 ? item.prompt.substring(0, 47) + '...' : item.prompt}"`;
            setCanvasLoading(true, 'Generating Video...', progressMsg, 'video');

            if (item.originalIndex !== undefined) {
                bulkRowStatus[item.originalIndex] = 'Generating...';
                updateGallery();
            }

            const resolved = await resolveStyleRefsForQueue(item, 'video');

            setCanvasLoading(true, 'Generating Video...', progressMsg, 'video');
            const generatedIds = await generateVideoItem(
                item.prompt,
                item.aspect,
                item.variations,
                item.duration,
                resolved.refMediaIds,
                resolved.startMediaId,
                resolved.isVideo
            );

            if (item.originalIndex !== undefined) {
                bulkRowMediaIds[item.originalIndex] = generatedIds;
                bulkRowStatus[item.originalIndex] = 'Done';
                updateGallery();
            }
        }
    } catch (e) {
        console.error('Error in bulk video queue:', e);
        showToast('An error occurred during bulk video generation.', 'error');
    } finally {
        updateProgressBar('video', 0, 0, true);
        if (activeVidQueue && activeVidQueue.id === currentQueueId) {
            const wasRunning = activeVidQueue.isRunning;
            const completedCount = activeVidQueue.currentIndex + 1;
            activeVidQueue.isRunning = false;
            activeVidQueue = null;
            
            setCanvasLoading(false, '', '', 'video');
            updateCredits();
            checkQueueFinished();
            
            if (wasRunning && completedCount === videoItems.length) {
                showToast('All bulk video generations completed!', 'success');
            }
        }
    }
}

async function startBulkQueue(items: ParsedBulkItem[]) {
    const imageItems = items.filter(it => it.type === 'image');
    const videoItems = items.filter(it => it.type === 'video');

    if (imageItems.length === 0 && videoItems.length === 0) {
        showToast('No valid items to generate.', 'error');
        return;
    }

    const isImageRunning = activeImgQueue && activeImgQueue.isRunning;
    const isVideoRunning = activeVidQueue && activeVidQueue.isRunning;

    if (isImageRunning || isVideoRunning) {
        showToast('A bulk queue is already running. Please cancel it first.', 'error');
        return;
    }

    showToast(`Starting parallel generation (${imageItems.length} Img, ${videoItems.length} Vid)...`, 'success');

    const btnCancelQueue = document.getElementById('btn-cancel-queue');
    if (btnCancelQueue) btnCancelQueue.classList.remove('hide');
    const btnCancelBulk = document.getElementById('btn-cancel-bulk');
    if (btnCancelBulk) btnCancelBulk.classList.remove('hide');

    clearBulkAssets();

    const btnStartBulk = document.getElementById('btn-start-bulk') as HTMLButtonElement | null;
    setButtonLoading(btnStartBulk, true);

    bulkRowMediaIds = {};
    bulkRowStatus = {};

    // Run both queues concurrently!
    runImageQueue(imageItems);
    runVideoQueue(videoItems);
}

async function generateImageItem(prompt: string, size?: string, variations?: number, styleRefMediaIds?: string[] | null): Promise<string[]> {
    const bulkImgSize = document.getElementById('bulk-img-size') as HTMLSelectElement | null;
    const bulkImgCount = document.getElementById('bulk-img-count') as HTMLSelectElement | null;
    
    // Use Excel value if defined, otherwise fall back to UI controls
    const finalSize = size || (bulkImgSize ? bulkImgSize.value : '1024x1024');
    const finalCount = variations || (bulkImgCount ? parseInt(bulkImgCount.value) : 4);

    const bodyPayload: any = {
        prompt: prompt,
        size: finalSize,
        response_format: 'url'
    };

    if (styleRefMediaIds && styleRefMediaIds.length > 0) {
        bodyPayload.ref_media_ids = styleRefMediaIds;
    }

    const chunks: number[] = [];
    let remaining = finalCount;
    while (remaining > 0) {
        const chunk = Math.min(4, remaining);
        chunks.push(chunk);
        remaining -= chunk;
    }

    const generatedIds: string[] = [];

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

            if (!response.ok) {
                const errResult = await response.json();
                throw new Error(errResult.detail || 'Failed to generate image chunk');
            }

            const result = await response.json();
            if (result.data) {
                result.data.forEach((item: any) => {
                    addAsset({
                        type: 'image',
                        url: item.url,
                        prompt: prompt,
                        media_id: item.media_id,
                        isBulk: true
                    });
                    if (item.media_id) {
                        generatedIds.push(item.media_id);
                    }
                });
            }
        } catch (e: any) {
            console.error('Error generating image chunk:', e);
            showToast(`Chunk failed: ${e.message || e}`, 'error');
        }
    };

    for (const chunkSize of chunks) {
        if (activeImgQueue && !activeImgQueue.isRunning) break;
        await runChunk(chunkSize);
    }

    return generatedIds;
}

async function generateVideoItem(
    prompt: string,
    aspect?: string,
    variations?: number,
    duration?: number,
    styleRefMediaIds?: string[] | null,
    startMediaId?: string,
    isVideo?: boolean
): Promise<string[]> {
    const bulkVidAspect = document.getElementById('bulk-vid-aspect') as HTMLSelectElement | null;
    const bulkVidDuration = document.getElementById('bulk-vid-duration') as HTMLSelectElement | null;
    const bulkVidCount = document.getElementById('bulk-vid-count') as HTMLSelectElement | null;

    // Use Excel value if defined, otherwise fall back to UI controls
    const fallbackAspect = bulkVidAspect ? bulkVidAspect.value : 'landscape';
    const finalAspect = aspect ? (aspect === 'portrait' ? 'portrait' : 'landscape') : (fallbackAspect === 'portrait' ? 'portrait' : 'landscape');
    const finalCount = variations || (bulkVidCount ? parseInt(bulkVidCount.value) : 1);
    
    // Duration is read from the Excel row, falling back to UI
    const finalDuration = duration || (bulkVidDuration ? parseInt(bulkVidDuration.value) : 8);

    const bodyPayload: any = {
        prompt: prompt,
        aspect: finalAspect,
        n: finalCount,
        duration: finalDuration
    };

    if (styleRefMediaIds && styleRefMediaIds.length > 0) {
        bodyPayload.ref_media_ids = styleRefMediaIds;
    }

    if (startMediaId) {
        bodyPayload.start_media_id = startMediaId;
        if (isVideo) {
            bodyPayload.is_video = true;
        }
    }

    const generatedIds: string[] = [];

    try {
        const response = await fetch(`${API_BASE}/v1/videos/generations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload)
        });

        if (!response.ok) {
            const errResult = await response.json();
            throw new Error(errResult.detail || 'Failed to generate video');
        }

        const result = await response.json();
        if (result.data) {
            result.data.forEach((item: any) => {
                addAsset({
                    type: 'video',
                    url: item.url,
                    prompt: prompt,
                    media_id: item.media_id,
                    isBulk: true
                });
                if (item.media_id) {
                    generatedIds.push(item.media_id);
                }
            });
        }
    } catch (e: any) {
        console.error('Error generating video:', e);
        showToast(`Video failed: ${e.message || e}`, 'error');
    }

    return generatedIds;
}
