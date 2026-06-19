export const Gallery = () => {
  return (
    <section class="ios-card glass gallery-card">
      <div class="gallery-header">
        <h2>Generated Canvas</h2>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="ios-badge" id="asset-count">0</span>
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
