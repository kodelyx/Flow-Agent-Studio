// Premium iOS-style elastic easing curves
const SPRING_EASE = 'cubic-bezier(0.25, 0.8, 0.25, 1.1)';
const SLIDE_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Animates tab panels on tab switches with scale and slide-up transition
 */
export function animateTabSwitch(panel: HTMLElement) {
    if (!panel) return;
    panel.animate([
        { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], {
        duration: 300,
        easing: SLIDE_EASE,
        fill: 'both'
    });
}

/**
 * Animates newly loaded gallery items with staggered slide-up and scale-in spring fades
 */
export function animateGalleryItems(items: NodeListOf<HTMLElement>) {
    if (!items || items.length === 0) return;
    items.forEach((item, idx) => {
        // Set initial state
        item.style.opacity = '0';
        item.style.transform = 'translateY(15px) scale(0.97)';
        
        item.animate([
            { opacity: 0, transform: 'translateY(15px) scale(0.97)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], {
            duration: 400,
            delay: Math.min(idx * 30, 600), // Cap max delay to prevent long waiting times
            easing: SPRING_EASE,
            fill: 'forwards'
        });
    });
}

/**
 * Adds a micro-interaction spring scaling animation when a button is clicked
 */
export function animateButtonPress(btn: HTMLElement) {
    if (!btn) return;
    btn.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(0.96)' },
        { transform: 'scale(1)' }
    ], {
        duration: 200,
        easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)'
    });
}
