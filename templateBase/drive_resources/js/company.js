addEventListener('alpine:init', () => {
  Alpine.data('companyComponent', () => ({
    init() {
      console.log('it is company');
    }
  }));
});
