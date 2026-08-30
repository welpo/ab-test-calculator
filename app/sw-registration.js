if ('serviceWorker' in navigator) {
  function showUpdateToast() {
    if (document.getElementById('service-worker-update')) return;
    const toast = document.createElement('div');
    toast.id = 'service-worker-update';
    toast.className = 'service-worker-update';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<span>An app update is ready.</span><button type="button">Reload</button><button type="button">Dismiss</button>';
    const [reloadButton, dismissButton] = toast.querySelectorAll('button');
    reloadButton.addEventListener('click', () => window.location.reload());
    dismissButton.addEventListener('click', () => toast.remove());
    document.body.append(toast);
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker registered:', registration.scope);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          const replacesRunningVersion = Boolean(navigator.serviceWorker.controller);
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && replacesRunningVersion) {
              showUpdateToast();
            }
          });
        }
      });
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  });
}
