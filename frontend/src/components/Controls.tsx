export const Controls = () => {
  return (
    <section class="ios-card glass">
      {/* Image Modality Panel */}
      <div class="panel-content active" id="panel-image">
        <div class="ios-input-group">
          <label>Describe your vision</label>
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
          <label>Describe the motion</label>
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
    </section>
  )
}
