/*!
 * Nexus Impacts — embeddable widget bootstrapper
 *
 * Usage on a donor's site:
 *   <div data-nexus-widget data-org="my-org-slug"></div>
 *   <script src="https://www.nexusimpacts.ai/embed.js" async></script>
 *
 * Optional attributes on the placeholder div:
 *   data-org          (required) Org slug, e.g. "acme-foundation"
 *   data-initiatives  Number of initiatives to feature, 1 or 2 (default: 1)
 *   data-metrics      Number of hero metrics, 2-4 (default: 3)
 *   data-max-width    Max widget width in px (default: 640)
 *   data-min-height   Initial min-height in px while loading (default: 320)
 *
 * The iframe auto-resizes to its content via postMessage, so the widget
 * never has internal scrollbars.
 */
(function () {
    'use strict';

    // ── Detect base URL from the script's own src so dev (localhost) and
    //    prod (app.nexusimpacts.ai) both work without configuration. ──
    function getBase() {
        try {
            var s = document.currentScript;
            if (!s || !s.src) {
                var tags = document.getElementsByTagName('script');
                for (var i = tags.length - 1; i >= 0; i--) {
                    if (tags[i].src && /\/embed\.js(\?|$)/.test(tags[i].src)) {
                        s = tags[i];
                        break;
                    }
                }
            }
            if (s && s.src) return new URL(s.src).origin;
        } catch (_) { /* fall through */ }
        return 'https://www.nexusimpacts.ai';
    }

    var BASE = getBase();
    var initialised = new WeakSet();

    function buildSrc(el) {
        var slug = el.getAttribute('data-org');
        if (!slug) return null;
        var params = new URLSearchParams();
        var initiatives = el.getAttribute('data-initiatives');
        var metrics = el.getAttribute('data-metrics');
        if (initiatives) params.set('initiatives', initiatives);
        if (metrics) params.set('metrics', metrics);
        var qs = params.toString();
        return BASE + '/embed/' + encodeURIComponent(slug) + (qs ? '?' + qs : '');
    }

    function mount(el) {
        if (initialised.has(el)) return;
        var src = buildSrc(el);
        if (!src) {
            console.warn('[nexus-widget] missing data-org attribute on', el);
            return;
        }
        initialised.add(el);

        var maxWidth = parseInt(el.getAttribute('data-max-width') || '640', 10) || 640;
        var minHeight = parseInt(el.getAttribute('data-min-height') || '320', 10) || 320;
        var slug = el.getAttribute('data-org') || '';

        // Wrapper to enforce max-width while allowing host CSS to constrain its parent.
        var wrap = document.createElement('div');
        wrap.style.cssText = [
            'all: initial',
            'display: block',
            'width: 100%',
            'max-width: ' + maxWidth + 'px',
            'margin: 0 auto',
            'box-sizing: border-box',
            'border-radius: 16px',
            'overflow: hidden',
            'background: #ffffff',
            'box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(15,23,42,0.06)'
        ].join(';');

        var iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.title = 'Nexus Impacts widget';
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer-when-downgrade';
        iframe.setAttribute('allowtransparency', 'true');
        iframe.setAttribute('frameborder', '0');
        iframe.style.cssText = [
            'width: 100%',
            'height: ' + minHeight + 'px',
            'border: 0',
            'display: block',
            'background: #ffffff',
            'transition: height 200ms ease'
        ].join(';');

        wrap.appendChild(iframe);
        el.innerHTML = '';
        el.appendChild(wrap);

        // ── Resize handler: listen for height messages from this iframe only. ──
        function onMessage(ev) {
            // Only trust messages from our origin.
            if (!ev || !ev.source || ev.source !== iframe.contentWindow) return;
            try {
                var originOk = ev.origin === BASE;
                if (!originOk) return;
            } catch (_) { return; }
            var data = ev.data;
            if (!data || data.type !== 'nexus:embed:height') return;
            if (typeof data.height !== 'number' || data.height < 50) return;
            // If the widget says it belongs to a specific slug, make sure it matches ours.
            if (data.slug && slug && data.slug !== slug) return;
            iframe.style.height = data.height + 'px';
        }
        window.addEventListener('message', onMessage);
    }

    function scan(root) {
        var nodes = (root || document).querySelectorAll('[data-nexus-widget]');
        for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
    }

    // ── Boot: run now if DOM is ready, otherwise wait for it. ──
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { scan(document); });
    } else {
        scan(document);
    }

    // ── Watch for late-injected widgets (SPAs that mount the placeholder
    //    after navigation, etc.). Fully optional — keeps the API drop-in. ──
    if (typeof MutationObserver !== 'undefined') {
        var mo = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var added = muts[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var n = added[j];
                    if (n.nodeType !== 1) continue;
                    if (n.matches && n.matches('[data-nexus-widget]')) mount(n);
                    if (n.querySelectorAll) scan(n);
                }
            }
        });
        mo.observe(document.documentElement, { childList: true, subtree: true });
    }

    // ── Public API for advanced use: window.NexusImpacts.refresh() to rescan. ──
    window.NexusImpacts = window.NexusImpacts || {};
    window.NexusImpacts.refresh = function (root) { scan(root || document); };
})();
