addEventListener('alpine:init', () => {
  Alpine.data('worksComponent', () => ({
    items: [],
    swiper: null,
    loading: true,
    error: null,
    async init() {
      try {
        const res = await fetch('/data/works.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        this.items = Array.isArray(data) ? data : [];
      } catch (e) {
        console.error('works load failed:', e);
        this.error = '制作事例の読み込みに失敗しました。';
      } finally {
        this.loading = false;
      }

      // Alpineの描画が完了してからSwiperを初期化
      await this.$nextTick();

      if (this.swiper?.destroy) this.swiper.destroy(true, true);

      this.swiper = new Swiper(this.$refs.container, {
        loop: true,
        spaceBetween: 24,
        slidesPerView: 1.4, // モバイルで少し見切れ
        centeredSlides: true,
        pagination: { el: this.$refs.pager, clickable: true },
        navigation: { nextEl: this.$refs.next, prevEl: this.$refs.prev },
        breakpoints: {
          640:  { slidesPerView: 2, spaceBetween: 24 },
          // PC では端までカードを詰めるため中央寄せを解除
          960:  { slidesPerView: 3, spaceBetween: 28, centeredSlides: false },
          1200: { slidesPerView: 4, spaceBetween: 32, centeredSlides: false }
        },
        observer: true,
        observeParents: true
      });

      // ビューポート入退場で reverse クラスをトグル（ローカルプレビュー用）
      try {
        const targetEl = this.$el; // section#works
        const obs = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              targetEl.classList.add('reverse');
            } else {
              targetEl.classList.remove('reverse');
            }
          });
        }, { threshold: 1.0 });
        obs.observe(targetEl);
      } catch (e) {
        console.warn('reverseクラストグル用Observer初期化失敗:', e);
      }
    }
  }));
});