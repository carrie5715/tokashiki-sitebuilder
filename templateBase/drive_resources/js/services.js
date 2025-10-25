addEventListener('alpine:init', () => {
  Alpine.data('servicesComponent', () => ({
    items: [],
    loading: true,
    error: null,
    async init() {
      try {
        const res = await fetch('/data/service.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();

        const layoutClassMap = { 0: 'type-a', 1: 'type-b', 2: 'type-c' };
        this.items = (Array.isArray(data) ? data : []).map(item => ({
          ...item,
          typeClass: layoutClassMap[item.layout] ?? 'type-a'
        }));
      } catch (e) {
        console.error('services load failed:', e);
        this.error = 'サービス情報の読み込みに失敗しました。';
      } finally {
        this.loading = false;
      }
    }
  }));
});
