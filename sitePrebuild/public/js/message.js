addEventListener('alpine:init', () => {
  Alpine.data('messageComponent', () => ({
    items: [],
    swiper: null,
    async init() {
      try {
        const res = await fetch('data/message.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        this.items = await res.json();

        await this.$nextTick();

        if (this.swiper?.destroy) this.swiper.destroy(true, true);

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
        console.error('message load failed:', e);
      }
    },
  }));
});
