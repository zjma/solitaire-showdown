var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http, {
	pingTimeout:60000,
	pingInterval:25000,
	maxHttpBufferSize:10000000,
	//allowRequest:function(){},
	transports:['polling','websocket'],
	allowUpgrades:true,
	cookie:io,
});

app.get('/test', function(req, res){
	res.sendfile('test.html');
});
app.get('/', function(req, res){
	res.sendfile('page.html');
});
app.get('/res/:resfilename', function(req, res){
	res.sendfile('res/'+req.params.resfilename);
});
app.get('/res/images/:resfilename', function(req, res){
	res.sendfile('res/images/'+req.params.resfilename);
});


function createMyArray() {
	var a = [];
	a.remove_if_exists = function(x) {
		var idx = this.indexOf(x);
		if (idx < 0) return false;
		this.splice(idx, 1);
		return true;
	}
	return a;
}


name_list = createMyArray();
map_id_to_name = {};
map_id_to_game = {};
map_id_to_socket = {};
ready_queue = createMyArray();


io.on('connection', function(socket){
	console.log(socket.id+' is connected.');
	
	map_id_to_socket[socket.id] = socket;
	map_id_to_name[socket.id] = 'NoName';

	socket.on('close', function(reason, descobj){
		console.log(socket.id+' is closed, reason='+reason);
	});
	socket.on('error', function(errobj){
		console.log(socket.id+' encountered an error.');
	});
	socket.on('flush', function(buf){
		console.log(socket.id+' is flushing.');
	});
	socket.on('drain', function(){
		console.log(socket.id+"'s buffer is drained.");
	});
	socket.on('packet', function(type, data){
		console.log(socket.id+' just ping me.');
	});
	socket.on('packetCreate', function(type, data){
		console.log(socket.id+' is sending '+data);
	});

	socket.on('disconnect', function(){
		console.log(displayname(socket.id)+" disconnected.");

		/* If the DCer has a game in progress, abort the game and notify his opponent. */
		var game = map_id_to_game[socket.id];
		if (game) {
			var idx = game.map_id_to_idx[socket.id];
			var id_oppo = game.get_opponent_id(socket.id);
			var socket_oppo = map_id_to_socket[id_oppo];
			
			delete map_id_to_game[id_oppo];
			delete map_id_to_game[socket.id];

			var res = game.get_result_for(1-idx);
			res.result = 2;
			socket_oppo.emit('gameend', JSON.stringify(res));
		}

		/* Remove the DCer's name, ready status and socket record. */
		name_list.remove_if_exists(map_id_to_name[socket.id]);
		ready_queue.remove_if_exists(socket.id);
		delete map_id_to_name[socket.id];
		delete map_id_to_socket[socket.id];
	});

	socket.on('setname', function(name){
		console.log(displayname(socket.id)+' set its name: '+name);

		/* If the name is being used by others, reject it. */
		if (name_list.indexOf(name)>=0 && map_id_to_name[socket.id] != name) {
			console.log('But this name has been used by others...');
			socket.emit('setnamefailed', 'Name exists.');
		}
		else {
			var old_name = map_id_to_name[socket.id];
			name_list.remove_if_exists(old_name);
			if (name != 'NoName') name_list.push(name);//We allow many 'NoName's.
			map_id_to_name[socket.id] = name;
			socket.emit('setnameok', name);
		}
	});

	socket.on('ready', function(msg){
		console.log(displayname(socket.id)+' is ready to play.');
		if (ready_queue.length == 0) {
			ready_queue.push(socket.id);
			socket.emit('readyok', '');
		}
		else {
			var opponent_id = ready_queue.pop();
			var socket_oppo = map_id_to_socket[opponent_id];
			var game = generate_new_game(opponent_id, socket.id);
			map_id_to_game[opponent_id] = game;
			map_id_to_game[socket.id] = game;
			socket.emit('oppofound', map_id_to_name[opponent_id]);
			socket_oppo.emit('oppofound', map_id_to_name[socket.id]);
		}
	});
	socket.on('unready', function(msg){
		console.log(displayname(socket.id)+' is unready.');
		if (ready_queue.remove_if_exists(socket.id)) {
			socket.emit('unreadyok', '');
		}
	});
	socket.on('standby', function(msg){
		var game = map_id_to_game[socket.id];
		var idx = game.map_id_to_idx[socket.id];
		game.players[idx].standby = true;
		if (game.players[1-idx].standby) {
			var overview = game.get_player_overview(idx);
			var overview_oppo = game.get_player_overview(1-idx);

			var socket_oppo = map_id_to_socket[game.players[1-idx].id];

			socket_oppo.emit('gamedata', JSON.stringify({
				'me': overview_oppo,
				'oppo': overview,
				'slots': game.slots,
				'hint': 'standby',
			}));
			socket.emit('gamedata', JSON.stringify({
				'me': overview,
				'oppo': overview_oppo,
				'slots': game.slots,
				'hint': 'standby',
			}));
		}
	});
	socket.on('homenext', function(msg){
		var game = map_id_to_game[socket.id];
		var idx = game.map_id_to_idx[socket.id];
		var socket_oppo = map_id_to_socket[game.players[1-idx].id];
		game.players[idx].homenext();
		var playerdata = game.get_player_overview(idx);
		console.log(displayname(socket.id)+' requested homenext.');
		socket.emit('gamedata', JSON.stringify({
			'me': playerdata,
			'hint': 'homenext',
		}));
		socket_oppo.emit('gamedata', JSON.stringify({
			'oppo': playerdata,
		}));
	});
	socket.on('movecard', function(msg){
		var data = JSON.parse(msg);
		var game = map_id_to_game[socket.id];
		var idx = game.map_id_to_idx[socket.id];
		var socket_oppo = map_id_to_socket[game.players[1-idx].id];
		var move_valid = game.players[idx].move(parseInt(data['srcz']), parseInt(data['srcf']), parseInt(data['dstz']));
		var playerdata = game.get_player_overview(idx);
		if (move_valid) {
			console.log(displayname(socket.id)+' made a good move.');
			socket.emit('gamedata', JSON.stringify({
				'me': playerdata,
				'hint': 'movecard',
			}));
			var socket_oppo = map_id_to_socket[game.players[1-idx].id];
			socket_oppo.emit('gamedata', JSON.stringify({
				'oppo': playerdata,
			}));

			if (game.players[idx].pile.length == 0) {
				socket_oppo.emit('gameend', JSON.stringify(game.get_result_for(1-idx)));
				socket.emit('gameend', JSON.stringify(game.get_result_for(idx)));
			}
		}
		else {
			console.log(displayname(socket.id)+' made a bad move.');
			socket.emit('gamedata', JSON.stringify({
				'me': playerdata,
			}));
		}
	});
	socket.on('submitcard', function(msg){
		var data = JSON.parse(msg);
		var srcz = parseInt(data['srcz']);
		var game = map_id_to_game[socket.id];
		var idx = game.map_id_to_idx[socket.id];
		var submit_valid = game.submit_card(idx, srcz);
		var playerdata = game.get_player_overview(idx);
		if (submit_valid) {
			console.log(displayname(socket.id)+' made a good submit.');
			socket.emit('gamedata', JSON.stringify({
				'me': playerdata,
				'slots': game.slots,
				'hint': 'submitcard',
			}));
			var socket_oppo = map_id_to_socket[game.players[1-idx].id];
			socket_oppo.emit('gamedata', JSON.stringify({
				'oppo': playerdata,
				'slots': game.slots,
				'hint': 'submitcard',
			}));

			if (game.players[idx].pile.length == 0) {
				socket_oppo.emit('gameend', JSON.stringify(game.get_result_for(1-idx)));
				socket.emit('gameend', JSON.stringify(game.get_result_for(idx)));
			}
		}
		else {
			console.log(displayname(socket.id)+' made a bad submit.');
			socket.emit('gamedata', JSON.stringify({
				'me': playerdata,
			}));
		}
	});
	socket.on('requestend', function(msg){
		var game = map_id_to_game[socket.id];
		var idx = game.map_id_to_idx[socket.id];
		var both_requested = game.request_end(idx);
		var socket_oppo = map_id_to_socket[game.players[1-idx].id];
		if (both_requested) {
			socket.emit('requestendok', '');
			socket_oppo.emit('gamedata', JSON.stringify({
				'oppo': game.get_player_overview(idx),
			}));
			socket.emit('gameend', JSON.stringify(game.get_result_for(idx)));
			socket_oppo.emit('gameend', JSON.stringify(game.get_result_for(1-idx)));
			delete map_id_to_game[socket.id];
			delete map_id_to_game[game.players[1-idx].id];
			delete game;
		}
		else {
			socket.emit('requestendok', '');
			socket_oppo.emit('gamedata', JSON.stringify({
				'oppo': game.get_player_overview(idx),
			}));
		}
	});
	socket.on('withdrawrequestend', function(msg){
		var game = map_id_to_game[socket.id];
		var idx = game.map_id_to_idx[socket.id];
		game.withdraw_request_end(idx);
		var socket_oppo = map_id_to_socket[game.players[1-idx].id];
		socket.emit('withdrawrequestendok', '');
		socket_oppo.emit('gamedata', JSON.stringify({
			'oppo': game.get_player_overview(idx),
		}));
	});
});


http.listen(18080, function(){});



/**
 * Generate a random integer from [a, b).
 */
function random_int(a, b) {
	return a+Math.floor(Math.random()*(b-a));
}

displayname = function(player_id){
	var name = map_id_to_name[player_id];
	if (name && name != 'NoName') return name;
	return player_id;
};

/**
 * Generate a shuffled suit of 52 cards.
 */
function shuffle() {
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
	var cards = shuffle();
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

