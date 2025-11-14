document.addEventListener('alpine:init', () => {
  Alpine.data('headerComponent', () => ({
    // state
    isDrawerOpen: false,

    // lifecycle
    init() {
      // ESCキーで閉じる
      this._onKeydown = (ev) => {
        if (ev.key === 'Escape' && this.isDrawerOpen) this.closeDrawer();
      };
      document.addEventListener('keydown', this._onKeydown);

      // 背景クリックで閉じる（.drawer-wrap 以外をクリック）
      const modalBg = this.$root.querySelector('.modal-bg');
      if (modalBg) {
        modalBg.addEventListener('click', (ev) => {
          if (!ev.target.closest('.drawer-wrap')) this.closeDrawer();
        });
      }

      // ドロワーナビ内のリンククリックで閉じる
      const drawerNav = this.$root.querySelector('.drawer-nav');
      if (drawerNav) {
        drawerNav.addEventListener('click', (ev) => {
          const a = ev.target.closest('a');
          if (a) this.closeDrawer();
        });
      }
    },

    // actions
    toggleDrawer() { this.isDrawerOpen = !this.isDrawerOpen; },
    openDrawer() { this.isDrawerOpen = true; },
    closeDrawer() { this.isDrawerOpen = false; },

    onItemClick(e) {
      // アンカー(#)はスムーズスクロール、その他は通常遷移（target="_blank" は別タブ）
      try {
        const a = e?.currentTarget || e?.target?.closest('a');
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (!href) return;

        if (href.startsWith('#')) {
          const el = document.querySelector(href);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.location.hash = href;
          }
        } else {
          const target = (a.getAttribute('target') || '').toLowerCase();
          if (target === '_blank') {
            window.open(href, '_blank', 'noopener');
          } else {
            window.location.href = href;
          }
        }
      } catch (_) {
        // noop
      } finally {
        this.closeDrawer();
      }
    }
  }));
});