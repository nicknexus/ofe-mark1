const CACHE_NAME = 'nexus-v1'

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/Nexuslogo.png',
]

const NETWORK_ONLY_PATTERNS = [
    /\/api\//,
    /supabase/,
    /\.supabase\./,
    /stripe\.com/,
    /googleapis\.com\/auth/,
    /accounts\.google\.com/,
]

function isNetworkOnly(url) {
    return NETWORK_ONLY_PATTERNS.some((pattern) => pattern.test(url))
}

function isNavigationRequest(request) {
    return request.mode === 'navigate'
}

function isStaticAsset(url) {
    return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)(\?.*)?$/.test(url)
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = request.url

    if (request.method !== 'GET') return

    if (isNetworkOnly(url)) return

    if (isNavigationRequest(request)) {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match('/index.html'))
                .then((response) => response || caches.match('/index.html'))
        )
        return
    }

    if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetchPromise = fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
                    }
                    return response
                })
                return cached || fetchPromise
            })
        )
        return
    }

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone()
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
                }
                return response
            })
            .catch(() => caches.match(request))
    )
})
