export const Lightbox = () => {
  return (
    <div class="ios-modal" id="media-modal">
      <div class="ios-modal-content">
        <span class="close-modal">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="1" y1="1" x2="11" y2="11"></line>
            <line x1="11" y1="1" x2="1" y2="11"></line>
          </svg>
        </span>
        <div id="modal-media-container"></div>
        <div class="ios-modal-footer">
          <div class="modal-actions-row">
            <button class="ios-download-btn modal-btn-secondary" id="modal-copy-prompt">Copy Prompt</button>
            <button class="ios-download-btn modal-btn-secondary" id="modal-add-to-canvas">Add to Canvas</button>
            <button class="ios-download-btn modal-btn-secondary" id="modal-add-to-video">Add Reference</button>
            <a href="#" class="ios-download-btn" id="modal-download" download={true}>Save to Device</a>
          </div>
        </div>
      </div>
    </div>
  )
}
