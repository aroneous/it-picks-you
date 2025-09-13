// Entrypoint for the client application
import { initializeApp } from './app';
import { playScale } from './audio';

document.addEventListener('DOMContentLoaded', () => {
    // Detect touch support
    const supportsTouch = (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0
    );

    function showTouchRequiredMessage() {
        const msg = document.createElement('div');
        msg.textContent = "I need to feel your fingers! This doesn't seem to be a touch-sensitive screen. :(";
        msg.style.position = 'fixed';
        msg.style.top = '0';
        msg.style.left = '0';
        msg.style.width = '100vw';
        msg.style.height = '100vh';
        msg.style.display = 'flex';
        msg.style.alignItems = 'center';
        msg.style.justifyContent = 'center';
        msg.style.background = 'black';
        msg.style.color = '#aaa';
        msg.style.fontFamily = 'sans-serif';
        msg.style.fontSize = '2rem';
        msg.style.zIndex = '9999';
        document.body.appendChild(msg);
    }

    if (!supportsTouch) {
        showTouchRequiredMessage();
    }

    initializeApp();

    // playScale(250);
});