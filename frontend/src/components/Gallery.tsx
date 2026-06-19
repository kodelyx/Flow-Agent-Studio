export const Gallery = () => {
  return (
    <section class="ios-card glass gallery-card">
      <div class="gallery-header">
        <div class="gallery-header-left">
          <span class="ios-badge" id="asset-count">0</span>
        </div>
        
        <div class="gallery-header-right">
          {/* Image Modality Actions */}
          <div id="gallery-image-actions" class="gallery-context-actions">
            <button id="btn-add-all-img" class="context-action-btn" title="Add all images to references">✨ Add All to Ref</button>
            <button id="btn-download-all-img" class="context-action-btn" title="Download all images">⬇️ Download All</button>
          </div>
          
          {/* Video Modality Actions */}
          <div id="gallery-video-actions" class="gallery-context-actions hide">
            <button id="btn-autoplay-vids" class="context-action-btn" title="Toggle Auto-play Videos">🎬 Auto-play: Off</button>
            <button id="btn-add-all-vid" class="context-action-btn" title="Add all videos to references">✨ Add All to Ref</button>
            <button id="btn-download-all-vid" class="context-action-btn" title="Download all videos">⬇️ Download All</button>
          </div>
          
          <button id="btn-clear-canvas" class="canvas-clear-btn" title="Clear Canvas">🗑️</button>
        </div>
      </div>

      {/* Empty State */}
      <div class="ios-empty" id="empty-state">
        <div class="empty-icon">🔴</div>
        <h3>Studio Idle</h3>
        <p>Generate high-quality images and video assets. Outputs will display instantly here.</p>
      </div>

      {/* Loading State */}
      <div class="ios-loader hide" id="gallery-loader">
        <div class="loader-visual">
          <div class="pulse-ring"></div>
          <div class="pulse-ring-slow"></div>
          <div class="loader-icon">✨</div>
        </div>
        <h3 id="loader-title">Generating...</h3>
      </div>

      {/* Grid */}
      <div class="ios-gallery-grid hide" id="gallery-grid"></div>
    </section>
  )
}
