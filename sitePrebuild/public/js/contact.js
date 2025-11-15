addEventListener('alpine:init', () => {
  Alpine.data('contactComponent', () => ({
    onCtaClick(event, type, index) {
      console.log('Contact CTA clicked: event[%O] type[%s] index[%s]', event, type, index);
      if (true) {
        return; // pass-through now
      }
      event.preventDefault();
      const anchor = event.currentTarget.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      const target = anchor.getAttribute('target');
      if (target === '_blank') {
        window.open(href, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = href;
      }
    }
  }));
});