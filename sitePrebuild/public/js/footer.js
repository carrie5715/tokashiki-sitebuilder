document.addEventListener('alpine:init', () => {
  Alpine.data('footerComponent', () => ({
    onItemClick(e) {
      this.$store.navUtils.onNavItemClick(e);
    }
  }));
});
