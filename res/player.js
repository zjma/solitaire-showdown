player = {
	init: function(){
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
		var key;
		for (key in this.sounds) {
			this.sounds[key].pause();
			this.sounds[key].currentTime = 0;
		}
		this.sounds[soundname].play();
	},
}
