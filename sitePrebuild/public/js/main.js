console.log('main.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  // マーキー表示の初期化
	const elements = document.querySelectorAll('.bg-title[data-marquee-data]');
	elements.forEach((el) => {
		const text = (el.getAttribute('data-marquee-data') || '').trim();
		if (!text) return;

		// 既に初期化済みならスキップ
		if (el.dataset.marqueeInitialized === '1') return;

		const track = document.createElement('div');
		track.className = 'marquee-track';

		// テキストを複数回並べてループ感を出す
		const repeatCount = 8;
		for (let i = 0; i < repeatCount; i++) {
			const span = document.createElement('span');
			span.textContent = text;
			track.appendChild(span);
		}

		// 既存の子要素は一旦クリアしてから挿入
		while (el.firstChild) {
			el.removeChild(el.firstChild);
		}
		el.appendChild(track);

		el.dataset.marqueeInitialized = '1';
	});
});

