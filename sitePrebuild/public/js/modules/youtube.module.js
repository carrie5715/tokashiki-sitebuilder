console.log('youtube.module.js loaded');

// YouTube iframe API を使った複数プレイヤー制御ユーティリティ
const YoutubeController = (() => {
	let apiLoading = false;
	let apiReady = false;
	const pendingInits = [];
	const players = {};

	function ensureApiScript() {
		if (apiLoading || apiReady || (window.YT && window.YT.Player)) return;
		apiLoading = true;
		const tag = document.createElement('script');
		tag.src = 'https://www.youtube.com/iframe_api';
		const firstScriptTag = document.getElementsByTagName('script')[0];
		if (firstScriptTag && firstScriptTag.parentNode) {
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
		} else if (document.head) {
			document.head.appendChild(tag);
		} else {
			document.documentElement.appendChild(tag);
		}
	}

	function onApiReady() {
		apiReady = true;
		apiLoading = false;
		while (pendingInits.length) {
			const fn = pendingInits.shift();
			try { fn(); } catch (_) {}
		}
	}

	function init() {
		const nodes = document.querySelectorAll('[data-youtube-id]');
		if (!nodes || nodes.length === 0) return;

		nodes.forEach((el) => {
			if (!el || el.dataset.youtubeInitialized === '1') return;
			const videoId = (el.getAttribute('data-youtube-id') || '').trim();
			if (!videoId) return;

			el.dataset.youtubeInitialized = '1';
			// プレイヤー用の内側コンテナを作成し、その中に iframe を埋め込む
			const key = `yt-player-${Object.keys(players).length + 1}`;
			const container = document.createElement('div');
			container.className = 'youtube-iframe-container';
			container.id = key;
			el.appendChild(container);

			const createPlayer = () => {
				if (!(window.YT && window.YT.Player)) return;
				const player = new window.YT.Player(container, {
					videoId: videoId,
					playerVars: {
						rel: 0,
						playsinline: 1,
					},
					events: {
						onStateChange: (event) => {
							try {
								if (event.data === window.YT.PlayerState.PLAYING) {
									Object.keys(players).forEach((k) => {
										if (k === key) return;
										const p = players[k];
										if (p && typeof p.pauseVideo === 'function') {
											try { p.pauseVideo(); } catch (_) {}
										}
									});
								}
							} catch (_) {}
						},
					},
				});
				players[key] = player;
			};

			if (apiReady || (window.YT && window.YT.Player)) {
				apiReady = true;
				createPlayer();
			} else {
				pendingInits.push(createPlayer);
			}
		});

		ensureApiScript();
	}

	return { init, onApiReady };
})();

// グローバル公開（他モジュールから再初期化したい場合に利用）
window.YoutubeController = YoutubeController;
window.onYouTubeIframeAPIReady = function () {
	if (window.YoutubeController && typeof window.YoutubeController.onApiReady === 'function') {
		window.YoutubeController.onApiReady();
	}
};

