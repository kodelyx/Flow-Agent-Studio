export const Lightbox = () => {
  return (
    <div class="ios-modal" id="media-modal">
      <span class="close-modal">&times;</span>
      <div class="ios-modal-content">
        <div id="modal-media-container"></div>
        <div class="ios-modal-footer">
          <p id="modal-prompt"></p>
          <div class="modal-actions-row">
            <button class="ios-download-btn modal-btn-secondary" id="modal-add-to-canvas">Add to Canvas</button>
            <button class="ios-download-btn modal-btn-secondary" id="modal-add-to-video">Add Reference</button>
            <a href="#" class="ios-download-btn" id="modal-download" download={true}>Save to Device</a>
          </div>
        </div>
      </div>
    </div>
  )
}
