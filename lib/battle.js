/**
 * Generate a random integer from [a, b).
 */
function random_int(a, b) {
	return a+Math.floor(Math.random()*(b-a));
}


/**
 * Generate a shuffled suit of 52 cards.
 */
var genShuffledDeck = function() {
	console.log("Yeah");
	var cards = [];
	var i,r,t;
	for (i=0; i<52; i++) {
		cards[i] = i;
	}
	for (i=0; i<52; i++) {
		r = random_int(0,52);
		t = cards[r];
		cards[r] = cards[i];
		cards[i] = t;
	}
	return cards;
}

exports.genShuffledDeck = genShuffledDeck;

