document.addEventListener('alpine:init', () => {
  Alpine.data('messageComponent', () => ({
    items: [],
    async init() {
      try {
        const res = await fetch('data/message.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        this.items = await res.json();

        // スライドDOMが描画されたあとでマルキースライダーを初期化
        if (window.MarqueeSlider && typeof window.MarqueeSlider.initAll === 'function') {
          this.$nextTick(() => {
            try {
              window.MarqueeSlider.initAll(this.$root);
            } catch (e) {
              console.error('MarqueeSlider init failed:', e);
            }
          });
        }
      } catch (e) {
        console.error('message load failed:', e);
      }
    },
  }));
});
