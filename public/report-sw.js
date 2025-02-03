// Service worker to handle report file requests
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only intercept requests that target our report files
  if (url.pathname.startsWith("/report/")) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        // If not in cache, try to fetch it (fallback)
        return fetch(event.request);
      })
    );
  }
});
