export const Gallery = () => {
  return (
    <section class="ios-card glass gallery-card">
      <div class="gallery-header">
        <div class="gallery-header-left">
          <a id="bulk-template-download" href="data:text/csv;charset=utf-8,Prompt%2CType%2CSize%2CVariations%2CDuration%2CReference%201%2CReference%202%2CReference%203%0AA%20futuristic%20cybernetic%20samurai%20in%20neo-tokyo%20with%20red%20neon%20accents%2Cimage%2C1%3A1%2C1%2C%2C%2C%2C%2C%0AA%20cinematic%20video%20of%20the%20cybernetic%20samurai%20walking%20down%20the%20street%2Cvideo%2C16%3A9%2C1%2C8%2C%401%2C%2C%2C%0AAn%20elegant%20sports%20car%20drifting%20on%20a%20wet%20neon%20street%20at%20night%2Cvideo%2Clandscape%2C1%2C8%2C%2C%2C%2C" download="bulk_prompt_template.csv" class="bulk-sample-btn hide" title="Download sample CSV template">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Sample Template</span>
          </a>
        </div>
        
        <div class="gallery-header-right" style="display: flex; align-items: center; gap: 8px;">
          <button id="bulk-results-export" class="bulk-sample-btn hide" title="Export bulk generation results to Excel" style="border: none; background: rgba(0, 113, 227, 0.08); color: var(--accent-blue); padding: 4px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export Excel</span>
          </button>
          <span class="ios-badge" id="asset-count">0</span>
        </div>
      </div>

      {/* Bulk Queue Progress Bar Container */}
      <div id="bulk-progress-container" class="hide" style="padding: 1.25rem; background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(0, 0, 0, 0.06); border-radius: 20px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 4px 16px rgba(0, 0, 0, 0.02); margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
        
        {/* Image Progress Section */}
        <div id="bulk-progress-img-row" class="hide">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
            <span style="font-weight: 700; display: flex; align-items: center; gap: 4px;">📸 Images</span>
            <span id="bulk-img-counter" style="color: var(--accent-red); font-weight: 700; font-size: 0.82rem; background: rgba(239, 68, 68, 0.08); padding: 2px 10px; border-radius: 12px;">0 / 0</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="flex: 1; height: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; overflow: hidden; position: relative;">
              <div id="bulk-img-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--accent-red) 0%, #b91c1c 100%); border-radius: 4px; transition: width 0.3s ease;"></div>
            </div>
            <span id="bulk-img-percent" style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); min-width: 32px; text-align: right;">0%</span>
          </div>
        </div>

        {/* Video Progress Section */}
        <div id="bulk-progress-vid-row" class="hide">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
            <span style="font-weight: 700; display: flex; align-items: center; gap: 4px;">🎥 Videos</span>
            <span id="bulk-vid-counter" style="color: #b91c1c; font-weight: 700; font-size: 0.82rem; background: rgba(185, 28, 28, 0.08); padding: 2px 10px; border-radius: 12px;">0 / 0</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="flex: 1; height: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; overflow: hidden; position: relative;">
              <div id="bulk-vid-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #b91c1c 0%, #7f1d1d 100%); border-radius: 4px; transition: width 0.3s ease;"></div>
            </div>
            <span id="bulk-vid-percent" style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); min-width: 32px; text-align: right;">0%</span>
          </div>
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
          <div class="loader-icon">
            <img src="/static/public/logo.png" alt="Logo" class="loader-logo" />
          </div>
        </div>
        <h3 id="loader-title">Generating...</h3>
        <p id="loader-status" style="margin-top: 0.5rem; color: var(--ios-text-secondary); font-size: 0.9rem; text-align: center; max-width: 80%; word-break: break-word;"></p>
        <button id="btn-cancel-queue" class="ios-btn danger hide" style="margin-top: 1.25rem; width: auto; min-width: 140px; padding: 0.5rem 1.5rem; font-size: 0.85rem; border-radius: 20px;">Cancel Queue</button>
      </div>

      {/* Grid */}
      <div class="ios-gallery-grid hide" id="gallery-grid"></div>
    </section>
  )
}
