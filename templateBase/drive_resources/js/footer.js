document.addEventListener('alpine:init', () => {
  Alpine.data('footerComponent', () => ({
    onItemClick(e) {
      try {
        const a = e?.currentTarget || e?.target?.closest('a');
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (!href) return;

        if (href.startsWith('#')) {
          const el = document.querySelector(href);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.location.hash = href;
          }
        } else {
          const target = (a.getAttribute('target') || '').toLowerCase();
          if (target === '_blank') {
            window.open(href, '_blank', 'noopener');
          } else {
            window.location.href = href;
          }
        }
      } catch (_) {
        // noop
      }
    }
  }));
});
