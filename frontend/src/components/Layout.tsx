import { Glows } from './Glows.js'
import { Header } from './Header.js'
import { Controls } from './Controls.js'
import { Gallery } from './Gallery.js'
import { Lightbox } from './Lightbox.js'

export const Layout = () => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Flow-Agent</title>
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;500;700&display=swap" rel="stylesheet" />
        {/* Stylesheet */}
        <link rel="stylesheet" href={`/static/public/style.css?v=${Date.now()}`} />
      </head>
      <body>
        <Glows />

        <div class="ios-container">
            <Header />

            {/* Main Studio Content */}
            <main class="ios-grid" id="workspace-view">
              <Controls />
              <Gallery />
            </main>

            {/* Full Page History View */}
            <main class="ios-history-view hide" id="history-view">
              <div class="history-view-header">
                <div class="header-left">
                  <h2>Generation History</h2>
                </div>
                <div class="header-right" style="display: flex; gap: 0.75rem; align-items: center;">
                  <button class="back-btn" id="btn-history-back">← Back to Studio</button>
                  <button class="history-clear-btn" id="btn-history-clear">Clear History</button>
                </div>
              </div>
              
              <div class="history-view-grid" id="history-view-items">
                <div class="history-empty">Loading history items...</div>
              </div>
            </main>
        </div>

        <Lightbox />

        {/* Toast Container */}
        <div class="ios-toast-container" id="toast-container"></div>

        {/* Script */}
        <script src={`/static/public/app.js?v=${Date.now()}`}></script>
      </body>
    </html>
  )
}
