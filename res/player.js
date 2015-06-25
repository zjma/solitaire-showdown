player = {
	init: function(){
		var ua = navigator.userAgent.toLowerCase();
		this.disabled = false;
		if (ua.match(/chrome\/([\d.]+)/)==null)
		{
			this.disabled = true;
			return;
		}
		this.sounds = {
			'put':document.getElementById('put-sound'),
			'turn':document.getElementById('turn-sound'),
			'submit':document.getElementById('submit-sound'),
			'shuffle':document.getElementById('shuffle-sound'),
			'revert':document.getElementById('revert-sound'),
			'lose': document.getElementById('lose-sound'),
			'requestend': document.getElementById('requestend-sound'),
		};
	},
	play: function(soundname) {
		if (this.disabled==true) return;
		var key;
		for (key in this.sounds) {
			this.sounds[key].pause();
			this.sounds[key].currentTime = 0;
		}
		this.sounds[soundname].play();
	},
}
