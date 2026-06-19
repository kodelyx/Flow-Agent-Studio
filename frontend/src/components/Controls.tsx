export const Controls = () => {
  return (
    <section class="ios-card glass">
      {/* Image Modality Panel */}
      <div class="panel-content active" id="panel-image">
        <div class="ios-input-group">
          <label>Prompt</label>
          <textarea id="img-prompt" placeholder="A futuristic cybernetic samurai in neo-tokyo, red accents, highly detailed digital art..."></textarea>
        </div>

        <div class="ios-input-group">
          <label id="img-ref-label">Upload Reference Image</label>
          <div class="ios-dropzone" id="img-dropzone" style="flex-direction: column; min-height: 120px; padding: 1rem;">
            <input type="file" id="img-file-input" accept="image/*" class="hide" multiple />
            <div class="dropzone-inner" id="img-dropzone-placeholder">
              <div class="dropzone-icon">📸</div>
              <div class="dropzone-text">Drop Image or <span>browse</span></div>
            </div>
            <div class="ref-images-thumbnails hide" id="img-ref-images-container" style="width: 100%; justify-content: center; margin: 0;">
              {/* Populated dynamically */}
            </div>
          </div>
        </div>

        <div class="settings-row">
          <div class="ios-input-group">
            <label>Aspect Ratio</label>
            <select id="img-size">
              <option value="1024x1024">Square (1:1)</option>
              <option value="1024x1792">Portrait (9:16)</option>
              <option value="1792x1024">Landscape (16:9)</option>
              <option value="1024x768">Ratio (4:3)</option>
              <option value="768x1024">Ratio (3:4)</option>
            </select>
          </div>

          <div class="ios-input-group">
            <label>Variations</label>
            <select id="img-count">
              <option value="1">1 Image</option>
              <option value="2">2 Images</option>
              <option value="3">3 Images</option>
              <option value="4" selected={true}>4 Images</option>
              <option value="8">8 Images</option>
              <option value="12">12 Images</option>
              <option value="20">20 Images</option>
            </select>
          </div>
        </div>

        <button class="ios-btn" id="btn-generate-img">
          <span>Create Images</span>
        </button>
      </div>

      {/* Video Modality Panel */}
      <div class="panel-content" id="panel-video">
        <div class="ios-input-group">
          <label>Prompt</label>
          <textarea id="vid-prompt" placeholder="An elegant red sports car drifting on a wet neon street at night, close up shot..."></textarea>
        </div>

        <div class="ios-input-group">
          <label id="vid-ref-label">Upload Reference Image & Video</label>
          <div class="ios-dropzone" id="vid-dropzone" style="flex-direction: column; min-height: 120px; padding: 1rem;">
            <input type="file" id="vid-file-input" accept="image/*,video/*" class="hide" multiple />
            <div class="dropzone-inner" id="vid-dropzone-placeholder">
              <div class="dropzone-icon">📸</div>
              <div class="dropzone-text">Drop Image & Video or <span>browse</span></div>
            </div>
            <div class="ref-images-thumbnails hide" id="ref-images-container" style="width: 100%; justify-content: center; margin: 0;">
              {/* Populated dynamically */}
            </div>
          </div>
        </div>

        <div class="settings-row" style="grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
          <div class="ios-input-group">
            <label>Aspect Ratio</label>
            <select id="vid-aspect">
              <option value="portrait">9:16</option>
              <option value="landscape">16:9</option>
            </select>
          </div>

          <div class="ios-input-group">
            <label>Duration</label>
            <select id="vid-duration">
              <option value="4">4s</option>
              <option value="6">6s</option>
              <option value="8" selected={true}>8s</option>
              <option value="10">10s</option>
            </select>
          </div>

          <div class="ios-input-group">
            <label>Variations</label>
            <select id="vid-count">
              <option value="1">1 Video</option>
              <option value="2">2 Videos</option>
              <option value="3">3 Videos</option>
              <option value="4">4 Videos</option>
            </select>
          </div>
        </div>

        <button class="ios-btn btn-crimson" id="btn-generate-vid">
          <span>Generate Video</span>
        </button>
      </div>

      {/* Bulk Modality Panel */}
      <div class="panel-content" id="panel-bulk">
        <div class="ios-input-group">
          <label>Upload Template (.xlsx, .csv, .txt)</label>
          <div class="ios-dropzone" id="bulk-template-dropzone" style="flex-direction: column; min-height: 100px; padding: 1rem;">
            <input type="file" id="bulk-template-input" accept=".txt,.csv,.xlsx" class="hide" />
            <div class="dropzone-inner" id="bulk-template-placeholder">
              <div class="dropzone-icon" style="margin-bottom: 6px; display: flex; align-items: center; justify-content: center;">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.5 1.5H7.5C6.4 1.5 5.5 2.4 5.5 3.5V6.5H7.5V3.5H14.5V8.5C14.5 9.1 14.9 9.5 15.5 9.5H20.5V20.5H14.5V22.5H20.5C21.6 22.5 22.5 21.6 22.5 20.5V8.5L16.5 2.5L14.5 1.5Z" fill="#107C41" />
                  <path d="M1.5 6.5H12.5C13.1 6.5 13.5 6.9 13.5 7.5V18.5C13.5 19.1 13.1 19.5 12.5 19.5H1.5C0.9 19.5 0.5 19.1 0.5 18.5V7.5C0.5 6.9 0.9 6.5 1.5 6.5Z" fill="#107C41" />
                  <path d="M4 9L6.5 13L9 9H11.5L8 14L11.5 19H9L6.5 15L4 19H1.5L5 14L1.5 9H4Z" fill="white" />
                  <path d="M16.5 2.5V8.5H22.5L16.5 2.5Z" fill="#33C481" />
                </svg>
              </div>
              <div class="dropzone-text">Drop Template or <span>browse</span></div>
            </div>
            <div class="bulk-template-info hide" id="bulk-template-info" style="width: 100%; text-align: center; justify-content: center; align-items: center; flex-direction: column;">
              <span class="file-name" style="font-weight: 600; display: block; margin-bottom: 4px;"></span>
              <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span class="file-status" style="color: var(--accent-red); font-size: 0.85rem; font-weight: 500;"></span>
                <button id="btn-clear-bulk" style="background: none; border: none; color: var(--accent-red); cursor: pointer; font-weight: 600; font-size: 0.85rem; padding: 2px 6px;">Clear</button>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Image Default Settings */}
        <div id="bulk-img-settings" class="settings-group hide" style="margin-top: 1rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.5px;">Default Image Settings</div>
          <div class="settings-row" style="margin-bottom: 1rem;">
            <div class="ios-input-group">
              <label>Aspect Ratio</label>
              <select id="bulk-img-size">
                <option value="1024x1024">Square (1:1)</option>
                <option value="1024x1792">Portrait (9:16)</option>
                <option value="1792x1024">Landscape (16:9)</option>
                <option value="1024x768">Ratio (4:3)</option>
                <option value="768x1024">Ratio (3:4)</option>
              </select>
            </div>
            <div class="ios-input-group">
              <label>Variations</label>
              <select id="bulk-img-count">
                <option value="1">1 Image</option>
                <option value="2">2 Images</option>
                <option value="3">3 Images</option>
                <option value="4" selected={true}>4 Images</option>
                <option value="8">8 Images</option>
                <option value="12">12 Images</option>
                <option value="20">20 Images</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Video Default Settings */}
        <div id="bulk-vid-settings" class="settings-group hide" style="margin-top: 1rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.5px;">Default Video Settings</div>
          <div class="settings-row" style="grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
            <div class="ios-input-group">
              <label>Aspect Ratio</label>
              <select id="bulk-vid-aspect">
                <option value="portrait">9:16</option>
                <option value="landscape" selected={true}>16:9</option>
              </select>
            </div>
            <div class="ios-input-group">
              <label>Duration</label>
              <select id="bulk-vid-duration">
                <option value="4">4s</option>
                <option value="6">6s</option>
                <option value="8" selected={true}>8s</option>
                <option value="10">10s</option>
              </select>
            </div>
            <div class="ios-input-group">
              <label>Variations</label>
              <select id="bulk-vid-count">
                <option value="1" selected={true}>1 Video</option>
                <option value="2">2 Videos</option>
                <option value="3">3 Videos</option>
                <option value="4">4 Videos</option>
              </select>
            </div>
          </div>
        </div>

        <button class="ios-btn btn-crimson" id="btn-start-bulk" style="margin-bottom: 8px;">
          <span>Start Generation</span>
        </button>
        <button class="ios-btn danger hide" id="btn-cancel-bulk" style="width: 100%; display: flex; align-items: center; justify-content: center;">
          Cancel Generation
        </button>
      </div>
    </section>
  )
}
