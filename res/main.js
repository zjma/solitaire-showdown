$(document).ready(function(){


/* Global variables and widgets */
map_cmd_to_sound = {
	'homenext': 'turn',
	'movecard': 'put',
	'standby': 'shuffle',
	'submitcard': 'submit',
}

socket = io({
	reconnection: false,
});

MyName = "NoName";
OppoName = undefined;


/* User event handlers */
on_startdrag = function() {
	stswitch('dragCard');
}

on_stopdrag = function(){
	stswitch('releaseCard');
}

on_doubleclick = function(srcz, card_value) {
	stswitch('submitCard', {'srcz': srcz, 'card_value': card_value});
}

on_drop = function(dragging_obj, srcv, srcz, srcf, dstz) {
	stswitch('dropCard', {
		'dragging_obj': dragging_obj,
		'srcv': srcv,
		'srcz': srcz,
		'srcf': srcf,
		'dstz': dstz,
	});
}


GlobalStatus = {
	val: null,
	handlers: {
		AwaitingUsrGiveName:{
			clickSetNameButton: function() {
				if (!validate_name()) return 'AwaitingUsrGiveName';
				updateTips("Connecting...", false);
				socket.emit('setname', $('#nameinput').val());
				return 'AwaitingSvrNameResult';
			},
		},
		AwaitingSvrNameResult:{
			msg_setnameok: function(kwargs){
				MyName = kwargs['myname'];
				updateTips("", false);
				$('#setname-button').removeAttr('disabled');
				init_dialog_frame_1();
				$('#searchstatus').html('Click "Auto Match" to play.');
				dlgmngr.show_dialog_frame(1);
				return 'AwaitingUsrStartOppoSearch';
			},
			msg_setnamefailed: function(){
				updateTips('This name is unavailable.', true);
				$('#setname-button').removeAttr('disabled');
				return 'AwaitingSvrNameResult';
			},
		},
		AwaitingUsrStartOppoSearch:{
			clickSearchToggle: function(){
				$('#startsearch-button').button('disable');
				updateTips("Connecting...", false);
				socket.emit('ready', '');
				return 'AwaitingSvrConfirmOppoSearchStart';
			},
		},
		AwaitingSvrConfirmOppoSearchStart:{
			msg_readyok: function(){
				$('#startsearch-button').button('option', 'label', 'Stop');
				$('#startsearch-button').button('enable');
				updateTips("", false);
				$('#searchstatus').html('Waiting for another player...');
				return 'AwaitingSvrOppoSearchResult';
			},
			msg_oppofound: function(kwargs){
				OppoName = kwargs['opponame'];
				init_dialog_frame_2();
				dlgmngr.show_dialog_frame(2);
				return 'CountingDownStandby';
			},
		},
		AwaitingSvrOppoSearchResult:{
			msg_oppofound: function(kwargs){
				OppoName = kwargs['opponame'];
				init_dialog_frame_2();
				dlgmngr.show_dialog_frame(2);
				return 'CountingDownStandby';
			},
			clickSearchToggle: function(){
				$('#startsearch-button').button('disable');
				updateTips("Connecting...", false);
				socket.emit('unready', '');
				return 'AwaitingSvrComfirmOppoSearchCancel';
			},
		},
		AwaitingSvrComfirmOppoSearchCancel:{
			msg_unreadyok: function(){
				$('#startsearch-button').button('option', 'label', 'Auto Match');
				$('#startsearch-button').button('enable');
				updateTips("", false);
				$('#searchstatus').html('Search stopped.');
				return 'AwaitingUsrStartOppoSearch';
			},
			msg_oppofound: function(kwargs){
				OppoName = kwargs['opponame'];
				init_dialog_frame_2();
				dlgmngr.show_dialog_frame(2);
				return 'CountingDownStandby';
			},
		},
		CountingDownStandby:{
			clickStandByButton: function(){
				$('#standby-button').button('disable');
				updateTips("Waiting opponent...", false);
				socket.emit('standby', '');				
				return 'WaitingInitGameData';
			},
			standByCountdownTimeout: function(){
				$('#standby-button').button('disable');
				updateTips("Waiting opponent...", false);
				socket.emit('standby', '');				
				return 'WaitingInitGameData';
			},
		},
		WaitingInitGameData:{
			msg_gamedata: function(kwargs){
				game.players[0] = kwargs['me'];
				game.players[1] = kwargs['oppo'];
				game.slots = kwargs['slots'];
				painter.draw_all(game, on_drop, on_doubleclick, true, on_startdrag, on_stopdrag);
				dlgmngr.hide();
				highlight_oppo_score();
				highlight_my_score();
				return 'InGameIdle';
			},
		},
		InGameIdle:{
			msg_gamedata: function(kwargs){
				if (kwargs['me']) {
					var oldscore = game.players[0].score;
					game.players[0] = kwargs['me'];
					var score_anim = (oldscore < game.players[0].score);
					painter.draw_my_all(game.players[0], on_drop, on_doubleclick, painter.isRequestEndButtonEnabled(), on_startdrag, on_stopdrag);
					if (score_anim) highlight_my_score();
				}
				if (kwargs['oppo']) {
					if (kwargs['oppo']['requested_end'] == true && game.players[1]['requested_end'] == false) player.play('requestend');
					var oldscore = game.players[1].score;
					game.players[1] = kwargs['oppo'];
					painter.draw_oppo_all(game.players[1], on_drop);
					if (oldscore < game.players[1].score) highlight_oppo_score();
				}
				if (kwargs['slots']) {
					game.slots = kwargs['slots'];
					painter.draw_slots(game.slots);
				}
				return 'InGameIdle';
			},
			dragCard: function(){
				return 'InGameDragging';
			},
			submitCard: function(kwargs){
				if (!game.is_valid_submit(kwargs['card_value'])) {
					player.play('revert');
					return "InGameIdle";
				}
				show_busy_cursor();
				painter.clear_all_drdr();
				socket.emit('submitcard', JSON.stringify(kwargs));
				return 'InGameWaitingData';
			},
			clickHome: function(){
				show_busy_cursor();
				painter.clear_all_drdr();
				socket.emit('homenext', '');
				return 'InGameWaitingData';
			},
			msg_gameend: function(kwargs){
				init_dialog_frame_3(kwargs['result'], kwargs['myname'], kwargs['opponame'], kwargs['myscore'], kwargs['opposcore']);
				dlgmngr.show_dialog_frame(3);
				if (kwargs['result'] == -1)
					player.play('lose');
				return 'GameEnd';
			},
		},
		InGameDragging:{
			msg_gamedata: function(kwargs){
				if (kwargs['me']) {
					console.error('Receive own game data update while dragging!');
				}
				if (kwargs['oppo']) {
					if (kwargs['oppo']['requested_end'] == true && game.players[1]['requested_end'] == false) player.play('requestend');
					var oldscore = game.players[1].score;
					game.players[1] = kwargs['oppo'];
					painter.draw_oppo_all(game.players[1], on_drop);
					if (oldscore < game.players[1].score) highlight_oppo_score();
				}
				if (kwargs['slots']) {
					game.slots = kwargs['slots'];
					painter.draw_slots(game.slots);
				}
				return 'InGameDragging';
			},
			releaseCard: function(){
				return 'InGameIdle';
			},
			dropCard: function(kwargs){
				if (!game.is_valid_move(kwargs['srcv'], kwargs['dstz'])) {
					player.play('revert');
					return 'InGameIdle';
				}
				//TODO: change pointer style
				kwargs['dragging_obj'].draggable("option", "revert", "false");
				show_busy_cursor();
				painter.clear_all_drdr();
				socket.emit('movecard', JSON.stringify({
					'srcz': kwargs['srcz'],
					'srcf': kwargs['srcf'],
					'dstz': kwargs['dstz'],
				}));
				return 'InGameWaitingData';
			},
			msg_gameend: function(kwargs){
				init_dialog_frame_3(kwargs['result'], kwargs['myname'], kwargs['opponame'], kwargs['myscore'], kwargs['opposcore']);
				dlgmngr.show_dialog_frame(3);
				return 'GameEnd';
			},
		},
		InGameWaitingData:{
			msg_gamedata: function(kwargs){
				if (kwargs['oppo']) {
					if (kwargs['oppo']['requested_end'] == true && game.players[1]['requested_end'] == false) player.play('requestend');
					var oldscore = game.players[1].score;
					game.players[1] = kwargs['oppo'];
					painter.draw_oppo_all(game.players[1], on_drop);
					if (oldscore < game.players[1].score) highlight_oppo_score();
				}
				if (kwargs['slots']) {
					game.slots = kwargs['slots'];
					painter.draw_slots(game.slots);
				}
				if (kwargs['me']) {
					var oldscore = game.players[0].score;
					game.players[0] = kwargs['me'];
					var score_anim = (oldscore < game.players[0].score);
					painter.draw_my_all(game.players[0], on_drop, on_doubleclick, painter.isRequestEndButtonEnabled(), on_startdrag, on_stopdrag);
					if (score_anim) highlight_my_score();
					restore_cursor();
					return 'InGameIdle';
				}
				else
					return 'InGameWaitingData';
			},
			msg_gameend: function(kwargs){
				init_dialog_frame_3(kwargs['result'], kwargs['myname'], kwargs['opponame'], kwargs['myscore'], kwargs['opposcore']);
				restore_cursor();
				dlgmngr.show_dialog_frame(3);
				return 'GameEnd';
			},
		},
		GameEnd:{
			clickResultOkButton: function(){
				init_dialog_frame_1();
				dlgmngr.show_dialog_frame(1);
				return 'AwaitingUsrStartOppoSearch';
			},
		},
		Disconnected:{},
	},
}

RqstEndStatus = {
	val: 'Normal',
	handlers: {
		Unapplicable:{
			msg_gamedata: function(){
				painter.draw_my_rq(false, true);
				return 'Normal';
			},
			msg_gameend: function(){
				return 'Unapplicable';
			},
		},
		Normal:{
			clickRqstEndButton: function(){
				painter.draw_my_rq(false, false);
				socket.emit('requestend', '');
				return 'AwaitingEndRqstConfirm';
			},
			msg_gameend: function(){
				return 'Unapplicable';
			},
		},
		AwaitingEndRqstConfirm:{
			msg_requestendok: function(){
				painter.draw_my_rq(true, true);
				return 'EndRqstValid';
			},
			msg_gameend: function(){
				return 'Unapplicable';
			},
		},
		EndRqstValid:{
			clickRqstEndButton: function(){
				painter.draw_my_rq(true, false);
				socket.emit('withdrawrequestend', '');
				return 'AwaitingContinueConfirm';
			},
			msg_gameend: function(){
				return 'Unapplicable';
			},
		},
		AwaitingContinueConfirm:{
			msg_withdrawrequestendok: function(){
				painter.draw_my_rq(false, true);
				return 'Normal';
			},
			msg_gameend: function(){
				return 'Unapplicable';
			},
		},
	},
}

Statuses = [GlobalStatus, RqstEndStatus];

stswitch = function(action, kwargs){
	var i;
	var handler;
	var old_st;
	for (i=0; i<Statuses.length; i++) {
		old_st = Statuses[i].val;
		handler = Statuses[i].handlers[old_st][action];
		if (handler) {
			Statuses[i].val = handler(kwargs);
			console.log('[Statues '+i+']: '+old_st+'--( '+action+' )-->'+Statuses[i].val);
		}
		else {
			console.log('[Statues '+i+']: '+old_st+'--( '+action+' )--> unhandled');
		}
		
	}
};


/* Actions */
updateTips = function(txt, e) {
	$('#validateTips').text(txt);
	if (e) {
		$('#validateTips').css('color', 'red');
	}
	else {
		$('#validateTips').css('color', 'black');
	}
}

validate_name = function() {
	var name = $('#nameinput').val();
	var ans = true;
	if (name.length<2 || name.length>16) {
		$('#namerule0').css({'font-weight': 'bold'});
		$('#namerule0st').html('×');
		ans = false;
	}
	else {
		$('#namerule0').css({'font-weight': 'normal'});
		$('#namerule0st').html('√');
	}
	if (name.search(/[^0-9a-zA-Z_]/) >= 0) {
		$('#namerule1').css({'font-weight': 'bold'});
		$('#namerule1st').html('×');
		ans = false;
	}
	else {
		$('#namerule1').css({'font-weight': 'normal'});
		$('#namerule1st').html('√');
	}

	if (ans) {
		$('#setname-button').removeAttr('disabled');
	}
	else
		$('#setname-button').attr('disabled', 'disabled');
	return ans;
}

countdown_standby_button = function(tick) {
	$('#standby-button').button('option', 'label', 'Start('+tick+')');
	if (tick > 0)
		setTimeout(function(){countdown_standby_button(tick-1);}, 1000);
	else {
		stswitch('standByCountdownTimeout');
	}
}

show_busy_cursor = function(){
	$('#gameboard').addClass('busycursor');
	$('.interactable-item').removeClass('interactable-item');
}

restore_cursor = function(){
	$('#gameboard').removeClass('busycursor');
	$('#myhomeland').addClass('interactable-item');
}

highlight_oppo_score = function(){
	$("#opposcore").animate(
		{color:'black'},
		{
			duration: 250,
			queue: false,
			easing: 'easeInExpo',
			complete: function(){
				$("#opposcore").animate({color:'#c0c0c0'},{duration:200, queue:false, easing:'easeInCubic'});
			}
		}
	);
}

highlight_my_score = function(){
	$("#myscore").animate(
		{color:'black'},
		{
			duration: 250,
			queue: false,
			easing: 'easeInExpo',
			complete: function(){
				$("#myscore").animate({color:'#c0c0c0'},{duration:200, queue:false, easing:'easeInCubic'});
			}
		}
	);
}

init_dialog_frame_0 = function() {
	$('#nameinput').val(MyName);
}

init_dialog_frame_1 = function() {
	$('#setnameresult').text('Hi '+MyName+'.');
	$('#startsearch-button').prop('checked', false);
	$('#startsearch-button').button('option', 'label', 'Auto Match');
	$('#startsearch-button').button('enable');
	$('#startsearch-button').button('refresh');
	$('#searchstatus').text('');
}

init_dialog_frame_2 = function() {
	$('#gamebriefopponame').text(OppoName);
	$('#standby-button').button('enable');
	countdown_standby_button(9);
}

init_dialog_frame_3 = function(result, myname, opponame, myscore, opposcore) {
	updateTips('', false);
	var header = 'You win.';
	if (result == 0)
		header = 'Draw.';
	else if (result == -1)
		header = 'You lose.';
	else if (result == 2)
		header = 'Opponent disconnected.';
	$('#result-header').text(header);
	$('#mynameinresult').text(myname);
	$('#opponameinresult').text(opponame);
	$('#myscoreinresult').text(myscore);
	$('#opposcoreinresult').text(opposcore);
}

$('#nameinput').focus(function(){
	$('#nameinput').select();
});

$('#setname-button').click(function(){
	stswitch('clickSetNameButton');
});

$('#nameinput').keyup(function(e){
	if (e.which == 13)
		stswitch('clickSetNameButton');
	else
		validate_name();
});

$('#nameinput').focus(function(){
	validate_name();
});

$('#startsearch-button').button().click(function(){
	stswitch('clickSearchToggle');
});

$('#standby-button').button().click(function(){
	stswitch('clickStandByButton');
});

$('#myhome').click(function(){
	stswitch('clickHome');
});

$('#myreqst').change(function(){
	stswitch('clickRqstEndButton');
});

$('#resultok-button').click(function(){
	stswitch('clickResultOkButton');
});
/* Socket events */
socket.on('unreadyok', function(msg){
	stswitch('msg_unreadyok');
});
socket.on('readyok', function(msg){
	stswitch('msg_readyok');
});
socket.on('setnameok', function(msg){
	stswitch('msg_setnameok', {'myname':msg});
});
socket.on('setnamefailed', function(msg){
	stswitch('msg_setnamefailed');
});
socket.on('oppofound', function(msg){
	stswitch('msg_oppofound', {'opponame':msg});
});
socket.on('gamedata', function(msg){
	console.log('Got gamedata');
	var data = JSON.parse(msg);
	if (data['hint']) player.play(map_cmd_to_sound[data['hint']]);
	stswitch('msg_gamedata', data);
});
socket.on('requestendok', function(msg){
	stswitch('msg_requestendok');
});
socket.on('withdrawrequestendok', function(msg){
	stswitch('msg_withdrawrequestendok');
});
socket.on('gameend', function(msg){
	stswitch('msg_gameend', JSON.parse(msg));
});
socket.on('disconnect', function(){
	updateTips('Connection lost.', true);
	dlgmngr.show_dialog_frame(4);
});
socket.on('connect_error', function(obj){
	console.error("connect_error");
	console.error(obj);
});
socket.on('connect_timeout', function(){
	console.error("connect_timeout");
});


/* Main entrance. */
player.init();
dlgmngr.init();
init_dialog_frame_0();
dlgmngr.show_dialog_frame(0);
painter.draw_all(game, on_drop, on_doubleclick, true, on_startdrag, on_stopdrag);
GlobalStatus.val = 'AwaitingUsrGiveName';

});

