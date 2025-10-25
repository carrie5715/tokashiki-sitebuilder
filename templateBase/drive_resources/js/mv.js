
document.addEventListener('alpine:init', () => {
  Alpine.data('mvComponent', () => ({
    init() {
      console.log('it is mv')
    }
  }));
});