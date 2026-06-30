importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// We need to initialize the app in the service worker too.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Note: We can't use process.env here directly since this is served static.
// The query parameters or a config file approach could be used, but for simplicity,
// we'll rely on the standard Firebase approach of inserting the sender ID if known,
// or expecting the user to fill this file in correctly before deploying.
// For now, if the config isn't populated, it'll fail gracefully.

const firebaseConfig = {
  apiKey: "AIzaSyAjkq39dJSuoc-LGjaae4hzmh-oXQBmhz0",
  authDomain: "gharpayy-arena.firebaseapp.com",
  projectId: "gharpayy-arena",
  storageBucket: "gharpayy-arena.firebasestorage.app",
  messagingSenderId: "171812629577",
  appId: "1:171812629577:web:c0fce6a7da9351c9312398",
};

// Only initialize if we have actual values (the user must replace YOUR_API_KEY)
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    // Firebase Web SDK automatically displays notifications if the payload includes
    // a "notification" object. We only manually show it if it's a data-only payload.
    if (!payload.notification) {
      const notificationTitle = payload.data?.title || 'Arena Chat';
      const notificationOptions = {
        body: payload.data?.body || 'You have a new message.',
        icon: '/icon-192x192.png'
      };
      return self.registration.showNotification(notificationTitle, notificationOptions);
    }
  });

  // Handle clicking on the notification
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // This looks to see if the current is already open and focuses if it is
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Find a client that is focused, or at least open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // If no client is open, open a new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  });
} else {
  console.warn("[firebase-messaging-sw.js] Please update firebaseConfig with your actual Firebase keys for background notifications to work.");
}
