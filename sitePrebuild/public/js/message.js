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
          centeredSlides: true,
          slidesPerView: 'auto',
          spaceBetween: 20,
          pagination: { el: this.$refs.pager, clickable: true },
          navigation: {
            nextEl: this.$refs.next,
            prevEl: this.$refs.prev,
          },
          speed: 6000,
          allowTouchMove: false,
          autoplay: {
            delay: 1,
            disableOnInteraction: false
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
