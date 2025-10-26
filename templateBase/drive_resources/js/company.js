addEventListener('alpine:init', () => {
  Alpine.data('companyComponent', () => ({
    items: [],
    loading: true,
    error: null,
    async init() {
      try {
        const res = await fetch('/data/company.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        this.items = Array.isArray(data) ? data : [];
      } catch (e) {
        console.error('company load failed:', e);
        this.error = '会社概要の読み込みに失敗しました。';
      } finally {
        this.loading = false;
      }
    }
  }));
});
