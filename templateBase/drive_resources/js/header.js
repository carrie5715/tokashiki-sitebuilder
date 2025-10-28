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
      // ハッシュ遷移 + ドロワーを閉じる
      try {
        const hash = (e?.currentTarget?.hash) || (e?.target?.hash);
        if (hash) {
          const el = document.querySelector(hash);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            // 要素が無ければハッシュを直接変更
            window.location.hash = hash;
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