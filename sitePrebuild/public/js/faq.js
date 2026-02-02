document.addEventListener('alpine:init', () => {
  Alpine.data('faqComponent', () => ({
    items: [],
    loading: true,
    error: null,
    async init() {
      try {
        const res = await fetch('data/faq.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        this.items = await res.json();
      } catch (e) {
        console.error(e);
        this.error = 'FAQの読み込みに失敗しました。';
      } finally {
        this.loading = false;
      }
    },
    onFaqItemClick(e) {
      console.log('FAQ item clicked', e);
    }
  }));
});