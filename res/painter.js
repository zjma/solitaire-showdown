painter = {
/* Resources */
colorclass_names: ['spade','heart','club','diamond'],
suits: ['♠','♥','♣','♦'],
values: ['A','2','3','4','5','6','7','8','9','10','J','Q','K'],
htmlcardback:
	'<div class="card cardback">'+
		'<div class="cardbackimg"></div>'+
	'</div>',
htmlcard_template:
	'<div class="card {{colorclass}}">'+
		'<div class="card-top">'+
			'<div class="card-char">{{suit}}</div>'+
			'<div class="card-char">{{value}}</div>'+
		'</div>'+
		'<div class="card-bot">'+
			'<div class="card-char">{{suit}}</div>'+
			'<div class="card-char">{{value}}</div>'+
		'</div>'+
	'</div>',
cardwrapper_template:
	'<div class="{{wrapperclass}}" cardvalue="{{cardvalue}}" cardfloor="{{cardfloor}}" cardsrc="{{cardsrc}}">'+
		'<div class="cardplace"></div>'+
	'</div>',
map_divid: {

},
/* Interfaces */
/**
 * Draw an HTML card in a card container JQobj.
 * Notice that drag/drop functionalities are not involved here.
 */
draw_card: function(JQobj, value) {
	if (value == 52) {
		JQobj.html(this.htmlcardback);
	}
	else {
		var suit_idx = parseInt(value/13);
		var doc = this.htmlcard_template
			.replace(/{{colorclass}}/g, this.colorclass_names[suit_idx])
			.replace(/{{suit}}/g, this.suits[suit_idx])
			.replace(/{{value}}/g, this.values[value%13]);
		JQobj.html(doc);
	}
},

/**
 * Params:
 * card_src(int): 0-3(zones), or 4(homeside), or 5(pile)
 * card_idx(int): 0-12(zones), or 0(homeside or pile)
 * dragable(boolean): ...
 * dropable(boolean): ...
 * drop_handler(function): ....
 * Returns:
 * The JQuery object of the card wrapper just created.
 */
draw_card_wrapper: function(JQobj, value, mat, inner, card_src, card_idx, dragable, dropable, drop_handler, dblclickable, dblclick_handler, startdrag_handler, stopdrag_handler) {
	var wrapper_class = 'card-wrapper';
	if (mat) wrapper_class += ' mat-wrapper';
	else if (inner) wrapper_class += ' inner-wrapper';
	var doc = this.cardwrapper_template
		.replace('{{wrapperclass}}', wrapper_class)
		.replace('{{cardvalue}}', value)
		.replace('{{cardfloor}}', card_idx)
		.replace('{{cardsrc}}', card_src);
	/* Draw the wrapper. */
	JQobj.append(doc);
	
	/* Draw the card. */
	JQobj = JQobj.children().last();
	this.draw_card(JQobj.children().first(), value);
	/* Set hover cursor. */
	if (dragable) JQobj.addClass('interactable-item');
	/* Set draggable. */
	if (dragable) {
		JQobj.draggable({
			revert: true,
			revertDuration: 100,
			zIndex: 99,
			containment: "window",
			cursor: "pointer",
			start: function(event, ui){
				startdrag_handler();
			},
			stop: function(event, ui){
				ui.helper.css('z-index', '1');
				stopdrag_handler();
			},
		});
	}

	/* Set droppable. */
	if (dropable) {
		JQobj.droppable({
			tolerance: "pointer",
			drop: function(event, ui){
				var obj = ui.draggable;
				var srcv = parseInt(obj.attr('cardvalue'));
				var zid_src = parseInt(obj.attr('cardsrc'));
				var flr_src = parseInt(obj.attr('cardfloor'));
				var zid_dst = parseInt($(this).attr('cardsrc'));
				//var zid_dst = parseInt(JQobj.attr('cardsrc'));
				//console.log('srcv='+srcv+' ,srcz='+zid_src+' ,srcf='+flr_src+' ,dstz='+zid_dst);
				drop_handler(obj, srcv, zid_src, flr_src, zid_dst);
			},
		});
	}

	/* Set dbclick listener. */
	if (dblclickable) JQobj.dblclick(function(){
		dblclick_handler(parseInt($(this).attr('cardsrc')), parseInt($(this).attr('cardvalue')));
	});

	return JQobj;
},


/**
 * Draw linked cards in JQobj the container of a zone.
 */
draw_zone: function(itsme, JQobj, zone_idx, arr, drop_handler, dblclick_handler, startdrag_handler, stopdrag_handler) {
	JQobj.empty();
	var dragable = itsme;
	var dblclickable = false;
	var i;
	var doc;
	var inner = false;
	for (i=0; i<arr.length; i++) {
		if (itsme && i+1==arr.length) dblclickable = true;
		JQobj = this.draw_card_wrapper(JQobj, arr[i], false, inner, zone_idx, i, dragable, false, undefined, dblclickable, dblclick_handler, startdrag_handler, stopdrag_handler);
		inner = true;
	}
	if (itsme) {
		JQobj.droppable({
			tolerance: "pointer",
			drop: function(event, ui){
				var obj = ui.draggable;
				var srcv = parseInt(obj.attr('cardvalue'));
				var zid_src = parseInt(obj.attr('cardsrc'));
				var flr_src = parseInt(obj.attr('cardfloor'));
				var zid_dst = parseInt($(this).attr('cardsrc'));
				drop_handler(obj, srcv, zid_src, flr_src, zid_dst);
			},
		});
	}
},

draw_zones: function(itsme, JQobjs, zones, drop_handler, dblclick_handler, startdrag_handler, stopdrag_handler) {
	var i;
	for (i=0; i<JQobjs.length; i++) {
		this.draw_zone(itsme, JQobjs[i], i, zones[i], drop_handler, dblclick_handler, startdrag_handler, stopdrag_handler);
	}
},

/**
 * Draw homeside cards in the homeside container JQobjs.
 * No matter how many homeside cards will be displayed, all 3JQobjs must be given as the argument.
 */
draw_homeside: function(itsme, JQobjs, cards, dblclick_handler, startdrag_handler, stopdrag_handler) {
	var i;
	var dragable = false;
	var dblclickable = false;
	var obj;
	for (i=0; i<3; i++) {
		JQobjs[i].empty();
		JQobjs[i].css('display', 'none');
	}
	for (i=0; i<cards.length; i++) {
		if (itsme && i+1==cards.length) {
			dragable = true;
			dblclickable = true;
		}
		obj = this.draw_card_wrapper(JQobjs[i], cards[i], false, false, 4, 0, dragable, false, undefined, dblclickable, dblclick_handler, startdrag_handler, stopdrag_handler);
		if (itsme && i+1==cards.length) obj.attr('homesidetop','1');
		JQobjs[i].css('display', 'block');
	}

},

draw_my_pile: function(value, count, dblclick_handler, startdrag_handler, stopdrag_handler) {
	$('#mypiletop').empty();
	if (value >= 0 && value <=51)
		this.draw_card_wrapper($('#mypiletop'), value, false, false, 5, 0, true, false, undefined, true, dblclick_handler, startdrag_handler, stopdrag_handler);
	if (count > 1) {
		this.draw_card_wrapper($('#mypiletop'), 52, true, false, 5, 0, false, false, undefined, false, undefined, undefined, undefined);
	}
	$('#mypilecount').html(count);
},

draw_my_home: function(home_count, cards, dblclick_handler, startdrag_handler, stopdrag_handler) {
	var JQobjs = [$('#myhomeside0'),$('#myhomeside1'),$('#myhomeside2')];
	this.draw_homeside(true, JQobjs, cards, dblclick_handler, startdrag_handler, stopdrag_handler);
	$('#myhomecount').html(home_count);
	if (home_count == 0)
		$('#myhomeland').empty();
	else
		this.draw_card($('#myhomeland'), 52);
},

draw_my_zones: function(zones, drop_handler, dblclick_handler, startdrag_handler, stopdrag_handler) {
	var JQobjs = [$('#myzone0'),$('#myzone1'),$('#myzone2'),$('#myzone3')];
	this.draw_zones(true, JQobjs, zones, drop_handler, dblclick_handler, startdrag_handler, stopdrag_handler);
},


draw_my_name: function(name) {
	$('#myname').html(name);
},

draw_my_score: function(score) {
	$('#myscore').html(score);
},

draw_my_rq: function(reqed, enabled) {
	$('#myreqst').prop('checked', reqed);
	if (enabled)
		$('#myreqst').removeAttr('disabled');
	else
		$('#myreqst').attr('disabled', 'disabled');
/*
	if (!reqed)
		$('#myreqst').button('option', 'label', "Ready to end");
	else
		$('#myreqst').button('option', 'label', "Continue");
*/
},

draw_my_all: function(player, drop_handler, dblclick_handler, reqbtn_enabled, startdrag_handler, stopdrag_handler) {
	this.draw_my_pile(player.pile, player.pile_count, dblclick_handler, startdrag_handler, stopdrag_handler);
	this.draw_my_home(player.home_count, player.homeside, dblclick_handler, startdrag_handler, stopdrag_handler);
	this.draw_my_zones(player.zones, drop_handler, dblclick_handler, startdrag_handler, stopdrag_handler);
	this.draw_my_name(player.name);
	this.draw_my_score(player.score);
	this.draw_my_rq(player.requested_end, reqbtn_enabled);
},

draw_oppo_pile: function(value, count) {
	$('#oppopiletop').empty();
	if (value)
		this.draw_card_wrapper($('#oppopiletop'), value, false, false, 5, 0, false, false, undefined, false, undefined, undefined, undefined);
	$('#oppopilecount').html(count);
},

draw_oppo_home: function(home_count, cards) {
	var JQobjs = [$('#oppohomeside0'),$('#oppohomeside1'),$('#oppohomeside2')];
	this.draw_homeside(false, JQobjs, cards, undefined, undefined);
	if (home_count == 0)
		$('#oppohome').empty();
	else
		this.draw_card($('#oppohome'), 52);
},

draw_oppo_zones: function(zones, drop_handler) {
	var JQobjs = [$('#oppozone0'),$('#oppozone1'),$('#oppozone2'),$('#oppozone3')];
	this.draw_zones(false, JQobjs, zones, drop_handler, undefined, undefined);
},

draw_oppo_name: function(name) {
	$('#opponame').html(name);
},

draw_oppo_score: function(score) {
	$('#opposcore').html(score);
},

draw_oppo_rq: function(reqed) {
	if (reqed) {
		$('#opporeqst').prop('checked', true);
		$('#opporq').css('display', 'inline-block');
	}
	else {
		$('#opporq').css('display', 'none');
	}
},

draw_oppo_all: function(player, drop_handler) {
	this.draw_oppo_pile(player.pile, player.pile_count);
	this.draw_oppo_home(player.home_count, player.homeside);
	this.draw_oppo_zones(player.zones, drop_handler);
	this.draw_oppo_name(player.name);
	this.draw_oppo_score(player.score);
	this.draw_oppo_rq(player.requested_end);
},

draw_slots: function(slots) {
	var i;
	var JQobjs = [$('#slot0'),$('#slot1'),$('#slot2'),$('#slot3'),$('#slot4'),$('#slot5'),$('#slot6'),$('#slot7')];
	for (i=0; i<8; i++) {
		JQobjs[i].empty();
		if (slots[i] != null) this.draw_card_wrapper(JQobjs[i], slots[i], false, false, 6, 0, false, false, undefined, false, undefined, undefined, undefined);
	}
},

draw_all: function(game, drop_handler, dblclick_handler, reqbtn_enabled, startdrag_handler, stopdrag_handler) {
	this.draw_my_all(game.players[0], drop_handler, dblclick_handler, reqbtn_enabled, startdrag_handler, stopdrag_handler);
	this.draw_oppo_all(game.players[1], drop_handler, undefined);
	this.draw_slots(game.slots);
},


/**
 * Remove drag/drop features from a zone(so the zone HTML can be rewrite).
 */
clear_zone_dragdrop: function(zidx) {
	var JQstrs = ['#myzone0','#myzone1','#myzone2','#myzone3'];
	var JQobj = $(JQstrs[zidx]);
	var sons;
	var inner = false;
	while (true) {
		sons = JQobj.children();
		if (sons.length > 0 && inner) JQobj.draggable("destroy");
		if (sons.length == 0 || inner && sons.length < 2) break;
		JQobj = sons.last();
		inner = true;
	}
	JQobj.droppable("destroy");
},

clear_homeside_drag: function(homeside_len) {
	$('[homesidetop]').draggable('destroy');
},

clear_my_drdr: function() {
	this.clear_zone_dragdrop(0);
	this.clear_zone_dragdrop(1);
	this.clear_zone_dragdrop(2);
	this.clear_zone_dragdrop(3);
	this.clear_homeside_drag(game.players[0].homeside.length);
},

clear_all_drdr: function() {
	this.clear_my_drdr();
},

isRequestEndButtonEnabled: function() {
	return !($('#myreqst').attr('disabled') == 'disabled');
},
}
