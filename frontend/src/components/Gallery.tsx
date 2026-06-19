export const Gallery = () => {
  return (
    <section class="ios-card glass gallery-card">
      <div class="gallery-header">
        <div class="gallery-header-left">
          {/* Empty left side */}
        </div>
        
        <div class="gallery-header-right">
          <span class="ios-badge" id="asset-count">0</span>
          <button id="btn-clear-canvas" class="history-btn" style="margin: 0;" title="Clear Canvas">Clear</button>
        </div>
      </div>

      {/* Empty State */}
      <div class="ios-empty" id="empty-state">
        <h3>Studio Idle</h3>
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
