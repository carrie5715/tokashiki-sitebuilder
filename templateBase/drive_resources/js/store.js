document.addEventListener('alpine:init', () => {
  Alpine.store('myStore', {
    // グローバルで共有したい値
    count: 0,
    // グローバルで使いたい関数
    increment() {
      this.count++;
    },
    reset() {
      this.count = 0;
    }
  });
});