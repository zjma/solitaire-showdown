var BattleMgr = require('./lib/battle');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http, {
	pingTimeout:10000,
	pingInterval:5000,
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
			var game = BattleMgr.generate_new_game(opponent_id, socket.id);
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




displayname = function(player_id){
	var name = map_id_to_name[player_id];
	if (name && name != 'NoName') return name;
	return player_id;
};



