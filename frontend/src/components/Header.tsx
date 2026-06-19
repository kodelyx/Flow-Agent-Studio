export const Header = () => {
  return (
    <header class="ios-navbar glass">
      <div class="nav-left">
        <div class="brand-logo">
          <div class="brand-logo-inner">
            <span class="logo-dot"></span>
          </div>
        </div>
        <span class="brand-title">Flow Agent <span>Studio</span></span>
      </div>

      <div class="nav-center">
        <div class="ios-segmented-control">
          <button class="segment-btn active" data-tab="image">Image Generator</button>
          <button class="segment-btn" data-tab="video">Video Generator</button>
        </div>
      </div>

      <div class="nav-right">
        <div class="credits-badge hide" id="credits-badge">
          <span>Credits: </span><span id="credits-count">?</span>
        </div>
        <button class="history-btn" id="btn-show-history" title="View Generation History">
          History
        </button>
        <div class="status-badge">
          <span class="status-dot"></span>
        </div>
      </div>
    </header>
  )
}
