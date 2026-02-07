addEventListener('alpine:init', () => {
  Alpine.data('flowComponent', () => ({
    items: [],
    swiper: null,
    loading: true,
    error: null,
    async init() {
      try {
        const res = await fetch('data/flow.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        this.items = Array.isArray(data) ? data : [];
      } catch (e) {
        console.error('flow load failed:', e);
        this.error = 'フローの読み込みに失敗しました。';
      } finally {
        this.loading = false;
      }

      await this.$nextTick();

      if (this.swiper?.destroy) this.swiper.destroy(true, true);

      if (!this.$refs.container) return;

      this.swiper = new Swiper(this.$refs.container, {
        loop: false,
        spaceBetween: 0,
        slidesPerView: 'auto',
        centeredSlides: false,
        pagination: { el: this.$refs.pager, clickable: true },
        navigation: { nextEl: this.$refs.next, prevEl: this.$refs.prev },
        breakpoints: {
          640:  { slidesPerView: 2, spaceBetween: 24 },
          960:  { slidesPerView: 3, spaceBetween: 28, centeredSlides: false },
        },
        observer: true,
        observeParents: true,
      });
    },
  }));
});
