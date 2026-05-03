/*!
 * Nexus Impacts — embeddable widget bootstrapper
 *
 * Usage on a donor's site:
 *   <div data-nexus-widget data-org="my-org-slug"></div>
 *   <script src="https://www.nexusimpacts.ai/embed.js" async></script>
 *
 * The widget always fills the width of the container it's dropped into and
 * adapts its layout (4-up metrics + 3-up stories on desktop, stacked on
 * mobile) automatically. Auto-resizes height via postMessage so the iframe
 * never has internal scrollbars.
 */
(function () {
    'use strict';

    // ── Detect base URL from the script's own src so dev (localhost) and
    //    prod (www.nexusimpacts.ai) both work without configuration. ──
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

    function buildSrc(slug) {
        return BASE + '/embed/' + encodeURIComponent(slug);
    }

    function mount(el) {
        if (initialised.has(el)) return;
        var slug = el.getAttribute('data-org');
        if (!slug) {
            console.warn('[nexus-widget] missing data-org attribute on', el);
            return;
        }
        initialised.add(el);

        // Wrapper isolates the widget visually from host CSS while still
        // filling whatever container the donor placed it in.
        var wrap = document.createElement('div');
        wrap.style.cssText = [
            'all: initial',
            'display: block',
            'width: 100%',
            'margin: 0 auto',
            'box-sizing: border-box',
            'border-radius: 20px',
            'overflow: hidden',
            'background: #ffffff',
            'box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(15,23,42,0.08)'
        ].join(';');

        var iframe = document.createElement('iframe');
        iframe.src = buildSrc(slug);
        iframe.title = 'Nexus Impacts — ' + slug;
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer-when-downgrade';
        iframe.setAttribute('allowtransparency', 'true');
        iframe.setAttribute('frameborder', '0');
        iframe.style.cssText = [
            'width: 100%',
            'height: 480px',
            'border: 0',
            'display: block',
            'background: #ffffff',
            'transition: height 200ms ease'
        ].join(';');

        wrap.appendChild(iframe);
        el.innerHTML = '';
        el.appendChild(wrap);

        // ── Resize handler: trust only messages from this iframe + our origin. ──
        function onMessage(ev) {
            if (!ev || !ev.source || ev.source !== iframe.contentWindow) return;
            try {
                if (ev.origin !== BASE) return;
            } catch (_) { return; }
            var data = ev.data;
            if (!data || data.type !== 'nexus:embed:height') return;
            if (typeof data.height !== 'number' || data.height < 50) return;
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
