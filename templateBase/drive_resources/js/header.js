document.addEventListener('alpine:init', () => {
  Alpine.data('headerComponent', () => ({
    onItemClick(e) {
      // ハッシュ前提
      console.log('Clicked item:', e.target.hash);
    }
  }));
});