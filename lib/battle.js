exports.generate_new_game = generate_new_game;

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


/**
 * Initialize player data (by deploy cards on pile, home and zones).
 */
function generate_player_data(player_id) {
	var cards = genShuffledDeck();
	var i;
	var pile = [];
	var home = [];
	var zones = [[],[],[],[]];
	
/*	for (i=0; i<52; i++)
		if (cards[i] % 13 == 0) {
			var t = cards[i];
			cards[i] = cards[3];
			cards[3] = t;
			break;
		}
*/

	for (i=0;i<13;i++) pile[i] = cards.pop();
	for (i=0;i<35;i++) home[i] = cards.pop();
	for (i=0;i<4;i++) zones[i][0] = cards.pop();
	var player = {
		id:                 player_id,
		score:              0,
		standby:            false,
		requested_end:      false,
		pile:               pile,
		home:               home,
		cut:                32,//Player can see home[cut](top) to home[bot](bottom)
		bot:                34,
		zones:              zones,

		get_overview: function(){
			return {
				name:           map_id_to_name[this.id],
				score:          this.score,
				requested_end:  this.requested_end,
				pile:           this.pile[this.pile.length-1],
				pile_count:     this.pile.length,
				home_count:     this.cut,
				homeside:       this.home.slice(this.cut, this.bot+1).reverse(),
				zones:          this.zones,
			};
		},
		homenext: function(){
			this.bot = this.cut-1;
			if (this.cut == 0)
				this.cut = this.home.length;
			else {
				this.cut -= 3;
				if (this.cut < 0) this.cut = 0;
			}
		},
		move: function(srcz, srcf, dstz){
			var srccard = this.get_card_value(srcz, srcf);
			var dstcard = this.zones[dstz][this.zones[dstz].length-1];
			console.log('move '+srccard+' to '+dstcard);
			if (dstcard >= 0 && dstcard <=51) {
				if ((srccard+1+39-dstcard)%26 != 0 || srccard % 13 == 12) {
					return false;
				}
			}

			if (srcz < 4) {
				this.zones[dstz] = this.zones[dstz].concat(this.zones[srcz].splice(srcf, this.zones[srcz].length-srcf));
			}
			else if (srcz == 4) {
				this.zones[dstz] = this.zones[dstz].concat(this.home.splice(this.cut, 1));
				if (this.bot > this.cut) this.bot -= 1;
			}
			else if (srcz == 5) {
				this.zones[dstz].push(this.pile.pop());
				this.score += 2;
			}
			return true;
		},
		get_card_value: function(z, f){
			if (z < 4)
				return this.zones[z][f];
			else if (z == 4)
				return this.home[this.cut];
			else if (z == 5)
				return this.pile[this.pile.length-1];
		},
		abandon: function(z){
			if (z < 4) {
				if (this.zones[z].length > 0) {
					this.zones[z].pop();
				}
				else {
					console.error('Abandoning a nonexistent card!');
				}
			}
			else if (z == 4) {
				if (this.cut < home.length && this.cut >= 0) {
					this.home.splice(this.cut, 1);
					if (this.bot > this.cut) this.bot -= 1;
				}
				else {
					console.error('Abandoning a nonexistent card!');
				}

			}
			else if (z == 5) {
				if (this.pile.length > 0) {
					this.pile.pop();
					this.score += 2;
				}
				else {
					console.error('Abandoning a nonexistent card!');
				}
			}
			else {
				console.error('Abandoning a nonexistent card!');
			}
		},
	};
	return player;
}
/**
 * Initialize game data (by initializing two players' data).
 */
function generate_new_game(player0_id, player1_id) {
	var map_id_to_idx = {};
	map_id_to_idx[player0_id] = 0;
	map_id_to_idx[player1_id] = 1;
	var game = {
		slots:              [null,null,null,null,null,null,null,null],
		players:            [generate_player_data(player0_id), generate_player_data(player1_id)],
		map_id_to_idx:      map_id_to_idx,

		get_opponent_id:function(player_id){
			return this.players[1-this.map_id_to_idx[player_id]].id;
		},
		get_player_overview:function(idx){
			return this.players[idx].get_overview();
		},
		request_end:function(idx){
			this.players[idx].requested_end = true;
			return this.players[1-idx].requested_end;
		},
		withdraw_request_end:function(idx){
			this.players[idx].requested_end = false;
		},
		submit_card:function(who, srcz){
			var srcf = 0;
			if (srcz < 4) srcf = this.players[who].zones[srcz].length-1;
			var card = this.players[who].get_card_value(srcz, srcf);
			console.log('submiting ('+srcz+','+srcf+'):'+card);
			var i;
			for (i=0; i<8; i++) {
				if (this.slots[i] != null) {
					if (card % 13 != 0 && this.slots[i]+1 == card) {
						this.slots[i] = card;
						this.players[who].score += 1;
						this.players[who].abandon(srcz);
						return true;
					}
				}
				else if (card % 13 == 0) {
					this.slots[i] = card;
					this.players[who].score += 1;
					this.players[who].abandon(srcz);
					return true;
				}
			}
			return false;
		},
		get_result_for: function(who) {
			var mysc = this.players[who].score;
			var opposc = this.players[1-who].score;
			return {
				result: (mysc == opposc)?0:(mysc > opposc)?1:-1,
				myname: map_id_to_name[this.players[who].id],
				myscore: mysc,
				opponame: map_id_to_name[this.players[1-who].id],
				opposcore: opposc,
			};
		},
	};
	return game;
}


