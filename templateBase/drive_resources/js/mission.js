addEventListener('alpine:init', () => {
  Alpine.data('missionComponent', () => ({
    items: [],
    swiper: null,
    async init() {
      try {
        const res = await fetch('/data/mission.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        this.items = await res.json();

        // Alpineがテンプレートを描画し終わるのを待つ
        await this.$nextTick();

        // 再初期化対策
        if (this.swiper?.destroy) this.swiper.destroy(true, true);

        // refsで安全にスコープ
        this.swiper = new Swiper(this.$refs.container, {
          loop: true,
          slidesPerView: 1,
          spaceBetween: 16,
          pagination: { el: this.$refs.pager, clickable: true },
          navigation: {
            nextEl: this.$refs.next,
            prevEl: this.$refs.prev,
          },
          breakpoints: {
            768:  { slidesPerView: 2, spaceBetween: 24 },
            1024: { slidesPerView: 3, spaceBetween: 32 },
          },
          observer: true,
          observeParents: true,
        });
      } catch (e) {
        console.error('mission load failed:', e);
      }
    },
  }));
});
