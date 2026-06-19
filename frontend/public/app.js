"use strict";
(() => {
  // src/client.ts
  var API_BASE = "http://127.0.0.1:8001";
  var tabBtns = document.querySelectorAll(".segment-btn");
  var tabContents = document.querySelectorAll(".panel-content");
  var btnGenerateImg = document.getElementById("btn-generate-img");
  var btnGenerateVid = document.getElementById("btn-generate-vid");
  var imgPrompt = document.getElementById("img-prompt");
  var imgSize = document.getElementById("img-size");
  var imgCount = document.getElementById("img-count");
  var vidPrompt = document.getElementById("vid-prompt");
  var vidAspect = document.getElementById("vid-aspect");
  var vidCount = document.getElementById("vid-count");
  var vidDuration = document.getElementById("vid-duration");
  var assetCountBadge = document.getElementById("asset-count");
  var btnClearCanvas = document.getElementById("btn-clear-canvas");
  var emptyState = document.getElementById("empty-state");
  var galleryGrid = document.getElementById("gallery-grid");
  var mediaModal = document.getElementById("media-modal");
  var modalMediaContainer = document.getElementById("modal-media-container");
  var modalPrompt = document.getElementById("modal-prompt");
  var modalDownload = document.getElementById("modal-download");
  var modalAddToCanvas = document.getElementById("modal-add-to-canvas");
  var modalAddToVideo = document.getElementById("modal-add-to-video");
  var closeModal = document.querySelector(".close-modal");
  var vidDropzone = document.getElementById("vid-dropzone");
  var vidFileInput = document.getElementById("vid-file-input");
  var dropzoneImgPreview = document.getElementById("dropzone-img-preview");
  var btnRemoveStartImg = document.getElementById("btn-remove-start-img");
  var imgDropzone = document.getElementById("img-dropzone");
  var imgFileInput = document.getElementById("img-file-input");
  var galleryLoader = document.getElementById("gallery-loader");
  var loaderTitle = document.getElementById("loader-title");
  var loaderStatus = document.getElementById("loader-status");
  var refImagesContainer = document.getElementById("ref-images-container");
  var vidRefLabel = document.getElementById("vid-ref-label");
  var vidDropzonePlaceholder = document.getElementById("vid-dropzone-placeholder");
  var imgRefImagesContainer = document.getElementById("img-ref-images-container");
  var imgRefLabel = document.getElementById("img-ref-label");
  var imgDropzonePlaceholder = document.getElementById("img-dropzone-placeholder");
  var assets = (() => {
    try {
      const saved = localStorage.getItem("canvasAssets");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error parsing canvasAssets:", e);
      return [];
    }
  })();
  var selectedReferences = [];
  var selectedImageReferences = [];
  var activeLightboxAsset = null;
  var activeImageUploadsCount = 0;
  var activeVideoUploadsCount = 0;
  var autoplayVideos = false;
  var isGeneratingImg = false;
  var isGeneratingVid = false;
  var imgLoadingTitle = "Creating Images...";
  var imgLoadingStatus = "";
  var vidLoadingTitle = "Generating Video...";
  var vidLoadingStatus = "";
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const tabName = btn.dataset.tab;
      if (tabName) {
        const targetPanel = document.getElementById(`panel-${tabName}`);
        if (targetPanel)
          targetPanel.classList.add("active");
        localStorage.setItem("activeTab", tabName);
        updateGallery();
      }
    });
  });
  var savedTab = localStorage.getItem("activeTab");
  if (savedTab) {
    tabBtns.forEach((btn) => {
      if (btn.dataset.tab === savedTab) {
        tabBtns.forEach((b) => b.classList.remove("active"));
        tabContents.forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        const targetPanel = document.getElementById(`panel-${savedTab}`);
        if (targetPanel)
          targetPanel.classList.add("active");
      }
    });
  }
  if (imgPrompt) {
    imgPrompt.value = localStorage.getItem("imgPrompt") || "";
    imgPrompt.addEventListener("input", () => {
      localStorage.setItem("imgPrompt", imgPrompt.value);
    });
  }
  if (imgSize) {
    imgSize.value = localStorage.getItem("imgSize") || "1024x1024";
    imgSize.addEventListener("change", () => {
      localStorage.setItem("imgSize", imgSize.value);
    });
  }
  if (imgCount) {
    imgCount.value = localStorage.getItem("imgCount") || "4";
    imgCount.addEventListener("change", () => {
      localStorage.setItem("imgCount", imgCount.value);
    });
  }
  if (vidPrompt) {
    vidPrompt.value = localStorage.getItem("vidPrompt") || "";
    vidPrompt.addEventListener("input", () => {
      localStorage.setItem("vidPrompt", vidPrompt.value);
    });
  }
  if (vidAspect) {
    vidAspect.value = localStorage.getItem("vidAspect") || "landscape";
    vidAspect.addEventListener("change", () => {
      localStorage.setItem("vidAspect", vidAspect.value);
    });
  }
  if (vidCount) {
    vidCount.value = localStorage.getItem("vidCount") || "1";
    vidCount.addEventListener("change", () => {
      localStorage.setItem("vidCount", vidCount.value);
    });
  }
  if (vidDuration) {
    vidDuration.value = localStorage.getItem("vidDuration") || "8";
    vidDuration.addEventListener("change", () => {
      localStorage.setItem("vidDuration", vidDuration.value);
    });
  }
  if (vidDropzone && vidFileInput) {
    vidDropzone.addEventListener("click", (e) => {
      if (e.target instanceof HTMLElement && (e.target.closest(".ref-thumb") && !e.target.closest(".ref-thumb-add-more"))) {
        return;
      }
      vidFileInput.click();
    });
    vidFileInput.addEventListener("change", () => {
      if (vidFileInput.files) {
        Array.from(vidFileInput.files).forEach((file) => {
          handleSelectedFile(file, "video");
        });
      }
    });
    vidDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      vidDropzone.classList.add("dragover");
    });
    vidDropzone.addEventListener("dragleave", () => {
      vidDropzone.classList.remove("dragover");
    });
    vidDropzone.addEventListener("drop", async (e) => {
      e.preventDefault();
      vidDropzone.classList.remove("dragover");
      if (e.dataTransfer) {
        const jsonData = e.dataTransfer.getData("application/json");
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
          Array.from(e.dataTransfer.files).forEach((file) => {
            handleSelectedFile(file, "video");
          });
        } else {
          const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
          if (url) {
            await handleDroppedUrl(url, "video");
          }
        }
      }
    });
  }
  if (imgDropzone && imgFileInput) {
    imgDropzone.addEventListener("click", (e) => {
      if (e.target instanceof HTMLElement && (e.target.closest(".ref-thumb") && !e.target.closest(".ref-thumb-add-more"))) {
        return;
      }
      imgFileInput.click();
    });
    imgFileInput.addEventListener("change", () => {
      if (imgFileInput.files) {
        Array.from(imgFileInput.files).forEach((file) => {
          handleSelectedFile(file, "image");
        });
      }
    });
    imgDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      imgDropzone.classList.add("dragover");
    });
    imgDropzone.addEventListener("dragleave", () => {
      imgDropzone.classList.remove("dragover");
    });
    imgDropzone.addEventListener("drop", async (e) => {
      e.preventDefault();
      imgDropzone.classList.remove("dragover");
      if (e.dataTransfer) {
        const jsonData = e.dataTransfer.getData("application/json");
        if (jsonData) {
          try {
            const data = JSON.parse(jsonData);
            if (data.media_id) {
              if (data.type === "image") {
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
          Array.from(e.dataTransfer.files).forEach((file) => {
            handleSelectedFile(file, "image");
          });
        } else {
          const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
          if (url) {
            await handleDroppedUrl(url, "image");
          }
        }
      }
    });
  }
  async function handleDroppedUrl(url, type) {
    try {
      const absoluteUrl = url.startsWith("http") ? url : new URL(url, window.location.origin).href;
      const response = await fetch(absoluteUrl);
      if (!response.ok)
        throw new Error("Failed to fetch file");
      const blob = await response.blob();
      if (type === "image") {
        if (!blob.type.startsWith("image/")) {
          showToast("Please drop a valid image file.", "error");
          return;
        }
        const file = new File([blob], "dragged_image.png", { type: blob.type });
        handleSelectedFile(file, type);
      } else {
        if (!blob.type.startsWith("image/") && !blob.type.startsWith("video/")) {
          showToast("Please drop a valid image or video file.", "error");
          return;
        }
        const isVideo = blob.type.startsWith("video/");
        const filename = isVideo ? "dragged_video.mp4" : "dragged_image.png";
        const file = new File([blob], filename, { type: blob.type });
        handleSelectedFile(file, type);
      }
    } catch (err) {
      console.error("Error handling dropped URL:", err);
      showToast("Failed to load the dragged file.", "error");
    }
  }
  function handleSelectedFile(file, type) {
    if (type === "image") {
      if (!file.type.startsWith("image/")) {
        showToast("Please select a valid image file.", "error");
        return;
      }
    } else {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        showToast("Please select a valid image or video file.", "error");
        return;
      }
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === "string") {
        if (type === "video") {
          uploadAndAddReference(e.target.result);
          if (vidFileInput)
            vidFileInput.value = "";
        } else {
          uploadAndAddImageReference(e.target.result);
          if (imgFileInput)
            imgFileInput.value = "";
        }
      }
    };
    reader.readAsDataURL(file);
  }
  async function uploadAndAddImageReference(base64Data) {
    if (selectedImageReferences.length >= 10) {
      showToast("You can select up to 10 reference items.", "error");
      return;
    }
    activeImageUploadsCount++;
    setCanvasLoading(true, "Uploading Reference...", `Uploading reference image to Google Flow (${activeImageUploadsCount} active)...`, "image");
    try {
      const response = await fetch(`${API_BASE}/v1/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        showToast(`Upload failed: ${result.detail || "Unknown error"}`, "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to upload reference image to server.", "error");
    } finally {
      activeImageUploadsCount--;
      if (activeImageUploadsCount <= 0) {
        activeImageUploadsCount = 0;
        setCanvasLoading(false, "", "", "image");
      } else {
        setCanvasLoading(true, "Uploading Reference...", `Uploading reference image to Google Flow (${activeImageUploadsCount} active)...`, "image");
      }
    }
  }
  function addImageReference(url, mediaId) {
    if (!mediaId) {
      showToast("This item cannot be selected as a reference (missing Flow media ID).", "error");
      return;
    }
    if (selectedImageReferences.some((ref) => ref.media_id === mediaId)) {
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
    const imageTabBtn = Array.from(tabBtns).find((btn) => btn.dataset.tab === "image");
    if (imageTabBtn) {
      imageTabBtn.click();
    }
  }
  function removeImageReference(mediaId) {
    selectedImageReferences = selectedImageReferences.filter((ref) => ref.media_id !== mediaId);
    updateImageReferencesUI();
  }
  function updateImageReferencesUI() {
    if (!imgRefImagesContainer || !imgRefLabel || !imgDropzonePlaceholder)
      return;
    if (selectedImageReferences.length === 0) {
      imgRefLabel.innerHTML = "Upload Reference Image";
      imgDropzonePlaceholder.classList.remove("hide");
      imgRefImagesContainer.classList.add("hide");
      imgRefImagesContainer.innerHTML = "";
      return;
    }
    imgRefLabel.innerHTML = `Selected Reference Image (<span id="img-ref-images-count">${selectedImageReferences.length}</span>/10)`;
    imgDropzonePlaceholder.classList.add("hide");
    imgRefImagesContainer.classList.remove("hide");
    imgRefImagesContainer.innerHTML = selectedImageReferences.map((ref) => {
      return `
            <div class="ref-thumb">
                <img src="${ref.url}" alt="Image Reference Thumbnail">
                <button class="ref-thumb-remove" data-id="${ref.media_id}" title="Remove reference">&times;</button>
            </div>
        `;
    }).join("") + `
        <div class="ref-thumb-add-more" style="width: 58px; height: 58px; border-radius: 12px; border: 2px dashed rgba(255, 55, 95, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--accent-red); cursor: pointer; background: rgba(255, 55, 95, 0.05); font-weight: bold;">
            +
        </div>
    `;
    imgRefImagesContainer.querySelectorAll(".ref-thumb-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (id)
          removeImageReference(id);
      });
    });
  }
  async function uploadAndAddReference(base64Data) {
    if (selectedReferences.length >= 10) {
      showToast("You can select up to 10 reference items.", "error");
      return;
    }
    activeVideoUploadsCount++;
    setCanvasLoading(true, "Uploading Reference...", `Uploading reference to Google Flow (${activeVideoUploadsCount} active)...`, "video");
    try {
      const response = await fetch(`${API_BASE}/v1/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64Data
        })
      });
      const result = await response.json();
      if (response.ok && result.media_id && result.url) {
        selectedReferences.push({ url: result.url, media_id: result.media_id });
        updateReferencesUI();
        showToast("Reference uploaded and added!", "success");
        const videoTabBtn = Array.from(tabBtns).find((btn) => btn.dataset.tab === "video");
        if (videoTabBtn) {
          videoTabBtn.click();
        }
      } else {
        showToast(`Upload failed: ${result.detail || "Unknown error"}`, "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to upload reference file to server.", "error");
    } finally {
      activeVideoUploadsCount--;
      if (activeVideoUploadsCount <= 0) {
        activeVideoUploadsCount = 0;
        setCanvasLoading(false, "", "", "video");
      } else {
        setCanvasLoading(true, "Uploading Reference...", `Uploading reference to Google Flow (${activeVideoUploadsCount} active)...`, "video");
      }
    }
  }
  function addReference(url, mediaId) {
    if (!mediaId) {
      showToast("This item cannot be selected as a reference (missing Flow media ID).", "error");
      return;
    }
    if (selectedReferences.some((ref) => ref.media_id === mediaId)) {
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
    const videoTabBtn = Array.from(tabBtns).find((btn) => btn.dataset.tab === "video");
    if (videoTabBtn) {
      videoTabBtn.click();
    }
  }
  function removeReference(mediaId) {
    selectedReferences = selectedReferences.filter((ref) => ref.media_id !== mediaId);
    updateReferencesUI();
  }
  function updateReferencesUI() {
    if (!refImagesContainer || !vidRefLabel || !vidDropzonePlaceholder)
      return;
    if (selectedReferences.length === 0) {
      vidRefLabel.innerHTML = "Upload Reference Image & Video";
      vidDropzonePlaceholder.classList.remove("hide");
      refImagesContainer.classList.add("hide");
      refImagesContainer.innerHTML = "";
      return;
    }
    vidRefLabel.innerHTML = `Selected Reference Image & Video (<span id="ref-images-count">${selectedReferences.length}</span>/10)`;
    vidDropzonePlaceholder.classList.add("hide");
    refImagesContainer.classList.remove("hide");
    refImagesContainer.innerHTML = selectedReferences.map((ref) => {
      const isVid = ref.url.toLowerCase().endsWith(".mp4") || ref.url.toLowerCase().includes("_vid_") || ref.url.toLowerCase().includes("video");
      const mediaHtml = isVid ? `<video src="${ref.url}" muted autoplay loop playsinline style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;"></video>` : `<img src="${ref.url}" alt="Video Reference Image">`;
      return `
            <div class="ref-thumb">
                ${mediaHtml}
                <button class="ref-thumb-remove" data-id="${ref.media_id}" title="Remove reference">&times;</button>
            </div>
        `;
    }).join("") + `
        <div class="ref-thumb-add-more" style="width: 58px; height: 58px; border-radius: 12px; border: 2px dashed rgba(255, 55, 95, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--accent-red); cursor: pointer; background: rgba(255, 55, 95, 0.05); font-weight: bold;">
            +
        </div>
    `;
    refImagesContainer.querySelectorAll(".ref-thumb-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (id)
          removeReference(id);
      });
    });
  }
  function setCanvasLoading(isLoading, title = "Generating...", status = "", type) {
    const targetType = type || (localStorage.getItem("activeTab") || "image");
    if (targetType === "image") {
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
  function setButtonLoading(btn, isLoading) {
    if (btn) {
      btn.disabled = isLoading;
    }
  }
  if (btnClearCanvas) {
    btnClearCanvas.addEventListener("click", () => {
      if (assets.length === 0) {
        showToast("Canvas is already empty", "info");
        return;
      }
      assets = [];
      localStorage.setItem("canvasAssets", JSON.stringify(assets));
      updateGallery();
      showToast("Canvas cleared successfully!", "success");
    });
  }
  if (btnGenerateImg) {
    btnGenerateImg.addEventListener("click", async () => {
      if (!imgPrompt || !imgSize || !imgCount)
        return;
      const prompt = imgPrompt.value.trim();
      if (!prompt) {
        showToast("Please enter a prompt", "error");
        return;
      }
      setButtonLoading(btnGenerateImg, true);
      const loadingMsg = selectedImageReferences.length > 0 ? `Generating images consistent with ${selectedImageReferences.length} reference image(s)...` : "Sending request to Flow Agent Bridge...";
      setCanvasLoading(true, "Creating Images...", loadingMsg, "image");
      try {
        const bodyPayload = {
          prompt,
          size: imgSize.value,
          n: parseInt(imgCount.value),
          response_format: "url"
        };
        if (selectedImageReferences.length > 0) {
          bodyPayload.ref_media_ids = selectedImageReferences.map((ref) => ref.media_id);
        }
        const response = await fetch(`${API_BASE}/v1/images/generations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload)
        });
        const result = await response.json();
        if (response.ok && result.data) {
          result.data.forEach((item) => {
            addAsset({
              type: "image",
              url: item.url,
              prompt,
              media_id: item.media_id
            });
          });
          imgPrompt.value = "";
          localStorage.removeItem("imgPrompt");
          selectedImageReferences = [];
          updateImageReferencesUI();
          showToast("Images generated successfully!", "success");
        } else {
          showToast(`Error: ${result.detail || "Failed to generate images"}`, "error");
        }
      } catch (e) {
        console.error(e);
        showToast("Could not connect to the Flow Agent server. Make sure it is running.", "error");
      } finally {
        setButtonLoading(btnGenerateImg, false);
        setCanvasLoading(false, "", "", "image");
      }
    });
  }
  if (btnGenerateVid) {
    btnGenerateVid.addEventListener("click", async () => {
      if (!vidPrompt || !vidAspect || !vidCount)
        return;
      const prompt = vidPrompt.value.trim();
      if (!prompt) {
        showToast("Please enter a prompt", "error");
        return;
      }
      setButtonLoading(btnGenerateVid, true);
      let loadingMsg = "Initiating video generation on Flow...";
      const hasVideoRef = selectedReferences.some((ref) => {
        const url = ref.url.toLowerCase();
        return url.endsWith(".mp4") || url.includes("_vid_") || url.includes("video");
      });
      if (selectedReferences.length > 0) {
        if (hasVideoRef) {
          loadingMsg = `Generating Video-to-Video using consistent style and reference(s)...`;
        } else {
          loadingMsg = `Generating video consistent with ${selectedReferences.length} reference image(s)...`;
        }
      }
      setCanvasLoading(true, "Generating Video...", loadingMsg, "video");
      try {
        const bodyPayload = {
          prompt,
          aspect: vidAspect.value,
          n: parseInt(vidCount.value),
          duration: vidDuration ? parseInt(vidDuration.value) : 8
        };
        if (selectedReferences.length > 0) {
          const firstVideoRef = selectedReferences.find((ref) => {
            const url = ref.url.toLowerCase();
            return url.endsWith(".mp4") || url.includes("_vid_") || url.includes("video");
          });
          if (firstVideoRef) {
            bodyPayload.start_media_id = firstVideoRef.media_id;
            bodyPayload.is_video = true;
          }
          bodyPayload.ref_media_ids = selectedReferences.map((ref) => ref.media_id);
        }
        const response = await fetch(`${API_BASE}/v1/videos/generations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload)
        });
        const result = await response.json();
        if (response.ok && result.data) {
          result.data.forEach((item) => {
            addAsset({
              type: "video",
              url: item.url,
              prompt,
              media_id: item.media_id
            });
          });
          vidPrompt.value = "";
          localStorage.removeItem("vidPrompt");
          selectedReferences = [];
          updateReferencesUI();
          showToast("Video generated successfully!", "success");
        } else {
          showToast(`Error: ${result.detail || "Failed to generate video"}`, "error");
        }
      } catch (e) {
        console.error(e);
        showToast("Could not connect to the Flow Agent server. Make sure it is running.", "error");
      } finally {
        setButtonLoading(btnGenerateVid, false);
        setCanvasLoading(false, "", "", "video");
        updateCredits();
      }
    });
  }
  function addAsset(asset) {
    assets.unshift(asset);
    localStorage.setItem("canvasAssets", JSON.stringify(assets));
    updateGallery();
  }
  function updateGallery() {
    if (!assetCountBadge || !emptyState || !galleryGrid || !galleryLoader || !loaderTitle)
      return;
    const activeTab = localStorage.getItem("activeTab") || "image";
    const imageActions = document.getElementById("gallery-image-actions");
    const videoActions = document.getElementById("gallery-video-actions");
    if (imageActions && videoActions) {
      if (activeTab === "image") {
        imageActions.classList.remove("hide");
        videoActions.classList.add("hide");
      } else {
        imageActions.classList.add("hide");
        videoActions.classList.remove("hide");
      }
    }
    const isGenerating = activeTab === "image" ? isGeneratingImg : isGeneratingVid;
    if (isGenerating) {
      galleryLoader.classList.remove("hide");
      emptyState.classList.add("hide");
      galleryGrid.classList.add("hide");
      loaderTitle.textContent = activeTab === "image" ? imgLoadingTitle : vidLoadingTitle;
      if (loaderStatus) {
        loaderStatus.textContent = activeTab === "image" ? imgLoadingStatus : vidLoadingStatus;
      }
      return;
    }
    galleryLoader.classList.add("hide");
    const filteredAssets = assets.filter((asset) => asset.type === activeTab);
    assetCountBadge.textContent = `${filteredAssets.length}`;
    if (filteredAssets.length === 0) {
      emptyState.classList.remove("hide");
      galleryGrid.classList.add("hide");
      const emptyTitle = emptyState.querySelector("h3");
      if (emptyTitle) {
        if (activeTab === "image") {
          emptyTitle.textContent = "No Image Assets";
        } else {
          emptyTitle.textContent = "No Video Assets";
        }
      }
      return;
    }
    emptyState.classList.add("hide");
    galleryGrid.classList.remove("hide");
    galleryGrid.innerHTML = filteredAssets.map((asset) => {
      const globalIndex = assets.indexOf(asset);
      if (asset.type === "image") {
        const addBtnHtml = asset.media_id ? `
                  <div class="overlay-buttons">
                      <button class="add-to-vid-btn add-to-img-ref-btn" data-index="${globalIndex}" title="Add reference to Image Generator">Add Image Ref</button>
                      <button class="add-to-vid-btn add-to-vid-ref-btn" data-index="${globalIndex}" title="Add reference to Video Generator">Add Video Ref</button>
                  </div>
                  ` : "";
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
        const addBtnHtml = asset.media_id ? `
                  <div class="overlay-buttons">
                      <button class="add-to-vid-btn add-to-vid-ref-btn" data-index="${globalIndex}" title="Add reference to Video Generator">Add Video Ref</button>
                  </div>
                  ` : "";
        const autoplayAttr = autoplayVideos ? "autoplay" : "";
        return `
                <div class="gallery-item" data-index="${globalIndex}" draggable="true">
                    <video src="${asset.url}" muted loop ${autoplayAttr}></video>
                    ${autoplayVideos ? "" : '<div class="play-badge">\u25B6</div>'}
                    <div class="item-overlay">
                        <p class="overlay-prompt">${escapeHtml(asset.prompt)}</p>
                        ${addBtnHtml}
                    </div>
                </div>
            `;
      }
    }).join("");
    document.querySelectorAll(".gallery-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target instanceof HTMLElement && e.target.closest(".add-to-vid-btn")) {
          return;
        }
        const indexStr = item.dataset.index;
        if (indexStr) {
          const index = parseInt(indexStr);
          openLightbox(assets[index]);
        }
      });
      item.addEventListener("dragstart", (e) => {
        const indexStr = item.dataset.index;
        if (indexStr && e.dataTransfer) {
          const index = parseInt(indexStr);
          const asset = assets[index];
          if (asset) {
            e.dataTransfer.setData("text/uri-list", asset.url);
            e.dataTransfer.setData("text/plain", asset.url);
            e.dataTransfer.setData("application/json", JSON.stringify({
              url: asset.url,
              media_id: asset.media_id || "",
              type: asset.type
            }));
            e.dataTransfer.effectAllowed = "copy";
          }
        }
      });
      const video = item.querySelector("video");
      if (video) {
        item.addEventListener("mouseenter", () => video.play().catch(() => {
        }));
        item.addEventListener("mouseleave", () => {
          video.pause();
          video.currentTime = 0;
        });
      }
    });
    galleryGrid.querySelectorAll(".add-to-img-ref-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
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
    galleryGrid.querySelectorAll(".add-to-vid-ref-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
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
  function openLightbox(asset) {
    if (!modalMediaContainer || !modalPrompt || !modalDownload || !mediaModal || !modalAddToVideo)
      return;
    activeLightboxAsset = asset;
    modalMediaContainer.innerHTML = "";
    if (asset.type === "image") {
      const img = document.createElement("img");
      img.src = asset.url;
      modalMediaContainer.appendChild(img);
    } else {
      const video = document.createElement("video");
      video.src = asset.url;
      video.controls = true;
      video.autoplay = true;
      modalMediaContainer.appendChild(video);
    }
    if (asset.media_id) {
      modalAddToVideo.classList.remove("hide");
    } else {
      modalAddToVideo.classList.add("hide");
    }
    if (modalAddToCanvas) {
      const isAlreadyAdded = assets.some((a) => a.url === asset.url);
      if (isAlreadyAdded) {
        modalAddToCanvas.textContent = "Remove Canvas";
        modalAddToCanvas.classList.add("added-canvas");
      } else {
        modalAddToCanvas.textContent = "Add to Canvas";
        modalAddToCanvas.classList.remove("added-canvas");
      }
    }
    modalPrompt.textContent = asset.prompt;
    modalDownload.href = asset.url;
    mediaModal.classList.add("open");
  }
  if (modalAddToVideo) {
    modalAddToVideo.addEventListener("click", () => {
      if (activeLightboxAsset && activeLightboxAsset.media_id) {
        const activeTab = localStorage.getItem("activeTab") || "image";
        if (activeTab === "image") {
          if (activeLightboxAsset.type === "image") {
            addImageReference(activeLightboxAsset.url, activeLightboxAsset.media_id);
          } else {
            showToast("You can only add image references to the Image Generator.", "error");
          }
        } else {
          addReference(activeLightboxAsset.url, activeLightboxAsset.media_id);
        }
        if (mediaModal) {
          mediaModal.classList.remove("open");
          if (modalMediaContainer)
            modalMediaContainer.innerHTML = "";
        }
      }
    });
  }
  if (modalAddToCanvas) {
    modalAddToCanvas.addEventListener("click", () => {
      if (activeLightboxAsset) {
        const index = assets.findIndex((asset) => asset.url === activeLightboxAsset.url);
        if (index !== -1) {
          assets.splice(index, 1);
          localStorage.setItem("canvasAssets", JSON.stringify(assets));
          updateGallery();
          showToast("Removed from canvas", "success");
        } else {
          addAsset(activeLightboxAsset);
          showToast("Added to canvas!", "success");
        }
        if (mediaModal) {
          mediaModal.classList.remove("open");
          if (modalMediaContainer)
            modalMediaContainer.innerHTML = "";
        }
      }
    });
  }
  if (closeModal) {
    closeModal.addEventListener("click", () => {
      if (mediaModal && modalMediaContainer) {
        mediaModal.classList.remove("open");
        modalMediaContainer.innerHTML = "";
        activeLightboxAsset = null;
      }
    });
  }
  if (mediaModal) {
    mediaModal.addEventListener("click", (e) => {
      if (e.target === mediaModal && modalMediaContainer) {
        mediaModal.classList.remove("open");
        modalMediaContainer.innerHTML = "";
        activeLightboxAsset = null;
      }
    });
  }
  async function updateCredits() {
    const creditsBadge = document.getElementById("credits-badge");
    const creditsCount = document.getElementById("credits-count");
    if (!creditsBadge || !creditsCount)
      return;
    try {
      const response = await fetch(`${API_BASE}/v1/credits`);
      if (response.ok) {
        const json = await response.json();
        const data = json && json.data !== void 0 ? json.data : json;
        const count = data.remainingCredits !== void 0 ? data.remainingCredits : data.credits !== void 0 ? data.credits : "?";
        creditsCount.textContent = count.toString();
        creditsBadge.classList.remove("hide");
      } else {
        creditsBadge.classList.add("hide");
      }
    } catch (e) {
      console.error("Error fetching credits:", e);
      creditsBadge.classList.add("hide");
    }
  }
  async function checkHealth() {
    const statusDot = document.querySelector(".status-dot");
    if (!statusDot)
      return;
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      if (response.ok && data.status === "healthy") {
        statusDot.classList.remove("offline");
        statusDot.classList.add("online");
      } else {
        statusDot.classList.remove("online");
        statusDot.classList.add("offline");
      }
    } catch (e) {
      statusDot.classList.remove("online");
      statusDot.classList.add("offline");
    }
  }
  checkHealth();
  updateCredits();
  setInterval(checkHealth, 5e3);
  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container)
      return;
    let displayMessage = message;
    if (message.includes("PUBLIC_ERROR_USER_QUOTA_REACHED") || message.includes("Resource has been exhausted") || message.toLowerCase().includes("quota")) {
      const creditsCountEl = document.getElementById("credits-count");
      const count = creditsCountEl ? creditsCountEl.textContent : "?";
      displayMessage = `Insufficient credits. Current Credit is ${count}.`;
    }
    const toast = document.createElement("div");
    toast.className = `ios-toast ${type}`;
    const dot = document.createElement("div");
    dot.className = "toast-dot";
    const msg = document.createElement("div");
    msg.className = "toast-message";
    msg.textContent = displayMessage;
    toast.appendChild(dot);
    toast.appendChild(msg);
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("show");
    }, 50);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 3e3);
  }
  var btnShowHistory = document.getElementById("btn-show-history");
  var btnHistoryBack = document.getElementById("btn-history-back");
  var btnHistoryClear = document.getElementById("btn-history-clear");
  var workspaceView = document.getElementById("workspace-view");
  var historyView = document.getElementById("history-view");
  var historyViewItems = document.getElementById("history-view-items");
  if (btnShowHistory && btnHistoryBack && workspaceView && historyView) {
    btnShowHistory.addEventListener("click", async () => {
      workspaceView.classList.add("hide");
      historyView.classList.remove("hide");
      localStorage.setItem("activeView", "history");
      await loadHistory();
    });
    btnHistoryBack.addEventListener("click", () => {
      historyView.classList.add("hide");
      workspaceView.classList.remove("hide");
      localStorage.setItem("activeView", "workspace");
    });
  }
  if (workspaceView && historyView) {
    const savedView = localStorage.getItem("activeView");
    if (savedView === "history") {
      workspaceView.classList.add("hide");
      historyView.classList.remove("hide");
      loadHistory();
    } else {
      workspaceView.classList.remove("hide");
      historyView.classList.add("hide");
    }
  }
  updateGallery();
  if (btnHistoryClear) {
    btnHistoryClear.addEventListener("click", async () => {
      try {
        const response = await fetch(`${API_BASE}/v1/history`, { method: "DELETE" });
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
    if (!historyViewItems)
      return;
    historyViewItems.innerHTML = '<div class="history-empty">Loading history items...</div>';
    try {
      const response = await fetch(`${API_BASE}/v1/history`);
      if (!response.ok)
        throw new Error("Failed to fetch history");
      const data = await response.json();
      const historyItems = data.history || [];
      if (historyItems.length === 0) {
        historyViewItems.innerHTML = '<div class="history-empty">No generations in history. Start creating!</div>';
        return;
      }
      historyViewItems.innerHTML = historyItems.map((item) => {
        const isVid = item.type === "video";
        const urlParts = item.url.split("/");
        const filename = urlParts[urlParts.length - 1];
        const isAdded = assets.some((asset) => asset.url === item.url);
        const importBtnText = isAdded ? "Added Canvas" : "Add Canvas";
        const importBtnClass = isAdded ? "added-canvas" : "";
        let actionBtnHtml = "";
        if (item.media_id) {
          actionBtnHtml = `<button class="history-btn-small success btn-hist-add-ref" data-media-id="${item.media_id}" data-url="${item.url}" data-type="${item.type}">Add Reference</button>`;
        } else {
          actionBtnHtml = `<button class="history-btn-small primary btn-hist-import ${importBtnClass}" data-url="${item.url}" data-type="${item.type}" data-prompt="${escapeHtml(item.prompt)}">${importBtnText}</button>`;
        }
        const mediaHtml = isVid ? `<video src="${item.url}" muted></video><div class="history-play-icon">\u25B6</div>` : `<img src="${item.url}" alt="${escapeHtml(item.prompt)}">`;
        return `
                <div class="history-card" data-filename="${filename}">
                    <div class="history-media-wrapper" data-url="${item.url}" data-type="${item.type}" data-prompt="${escapeHtml(item.prompt)}" data-media-id="${item.media_id || ""}" draggable="true">
                        ${mediaHtml}
                    </div>
                    <p class="history-prompt" title="${escapeHtml(item.prompt)}">${escapeHtml(item.prompt)}</p>
                    <div class="history-actions">
                        ${actionBtnHtml}
                        <a href="${item.url}" download="${filename}" target="_blank" class="history-btn-small success" style="text-decoration: none; line-height: 1.8; display: inline-block;">Download</a>
                        <button class="history-btn-small primary btn-hist-import ${importBtnClass}" data-url="${item.url}" data-type="${item.type}" data-prompt="${escapeHtml(item.prompt)}" data-media-id="${item.media_id || ""}" style="${item.media_id ? "grid-column: span 1" : "display:none;"}">${importBtnText}</button>
                        <button class="history-btn-small danger btn-hist-delete" data-filename="${filename}" style="${item.media_id ? "grid-column: span 1" : "grid-column: span 2"}">${"Delete"}</button>
                    </div>
                </div>
            `;
      }).join("");
      historyViewItems.querySelectorAll(".history-media-wrapper").forEach((wrapper) => {
        wrapper.addEventListener("click", () => {
          const url = wrapper.getAttribute("data-url") || "";
          const type = wrapper.getAttribute("data-type");
          const prompt = wrapper.getAttribute("data-prompt") || "";
          const media_id = wrapper.getAttribute("data-media-id") || void 0;
          openLightbox({ type, url, prompt, media_id });
        });
        wrapper.addEventListener("dragstart", (e) => {
          const url = wrapper.getAttribute("data-url") || "";
          const mediaId = wrapper.getAttribute("data-media-id") || "";
          const type = wrapper.getAttribute("data-type") || "image";
          if (url && e.dataTransfer) {
            e.dataTransfer.setData("text/uri-list", url);
            e.dataTransfer.setData("text/plain", url);
            e.dataTransfer.setData("application/json", JSON.stringify({
              url,
              media_id: mediaId,
              type
            }));
            e.dataTransfer.effectAllowed = "copy";
          }
        });
      });
      historyViewItems.querySelectorAll(".btn-hist-add-ref").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const mediaId = btn.getAttribute("data-media-id") || "";
          const url = btn.getAttribute("data-url") || "";
          const type = btn.getAttribute("data-type") || "image";
          if (mediaId && url) {
            const activeTab = localStorage.getItem("activeTab") || "image";
            if (activeTab === "image") {
              if (type === "image") {
                addImageReference(url, mediaId);
              } else {
                showToast("You can only add image references to the Image Generator.", "error");
                return;
              }
            } else {
              addReference(url, mediaId);
            }
            historyView?.classList.add("hide");
            workspaceView?.classList.remove("hide");
            localStorage.setItem("activeView", "workspace");
          }
        });
      });
      historyViewItems.querySelectorAll(".btn-hist-import").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const url = btn.getAttribute("data-url") || "";
          const type = btn.getAttribute("data-type");
          const prompt = btn.getAttribute("data-prompt") || "";
          const media_id = btn.getAttribute("data-media-id") || void 0;
          if (url) {
            const index = assets.findIndex((asset) => asset.url === url);
            if (index !== -1) {
              assets.splice(index, 1);
              localStorage.setItem("canvasAssets", JSON.stringify(assets));
              updateGallery();
              const siblingBtns = btn.closest(".history-card")?.querySelectorAll(".btn-hist-import");
              siblingBtns?.forEach((sBtn) => {
                sBtn.textContent = "Add Canvas";
                sBtn.classList.remove("added-canvas");
              });
              showToast("Removed from canvas", "success");
            } else {
              addAsset({ type, url, prompt, media_id });
              const siblingBtns = btn.closest(".history-card")?.querySelectorAll(".btn-hist-import");
              siblingBtns?.forEach((sBtn) => {
                sBtn.textContent = "Added Canvas";
                sBtn.classList.add("added-canvas");
              });
              showToast("Added to canvas!", "success");
            }
          }
        });
      });
      historyViewItems.querySelectorAll(".btn-hist-delete").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const filename = btn.getAttribute("data-filename") || "";
          if (!filename)
            return;
          try {
            const response2 = await fetch(`${API_BASE}/v1/history/${filename}`, { method: "DELETE" });
            if (response2.ok) {
              const card = btn.closest(".history-card");
              if (card) {
                card.remove();
              }
              showToast("Asset deleted successfully!", "success");
              const remainingCards = historyViewItems.querySelectorAll(".history-card");
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
})();
