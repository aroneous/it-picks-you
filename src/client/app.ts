export function initializeApp() {
    console.log('Client application initialized');
    const h1 = document.createElement('h1');
    h1.textContent = 'Initialized';
    document.body.appendChild(h1);
}