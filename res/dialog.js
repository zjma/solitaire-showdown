/* require jquery.ui */

dlgmngr = {

poped: false,
frame_ids: ['setname-frame', 'startsearch-frame', 'standby-frame', 'gameresult-frame', 'disconnectingame-frame'],
frame_objs: [],

init: function(){
	$("#welcome-dialog").dialog({
		autoOpen: false,
		dialogClass: "no-close",
		closeOnEscape: false,
		height: 300,
		width: 350,
		modal: true,
		title: 'Solitaire 1v1!',
	});
	for (var i=0; i<this.frame_ids.length; i++) {
		this.frame_objs.push($('#'+this.frame_ids[i]));
	}
	this.poped = false;
},

show_dialog_frame: function(index){
	$("#welcome-dialog").dialog('open');
	var i;
	for (i=0; i<this.frame_objs.length; i++) {
		this.frame_objs[i].css('display', 'none');
	}
	this.frame_objs[index].css('display', 'block');
	this.poped = true;
},

hide: function(){
	$("#welcome-dialog").dialog('close');
},

set_title: function(title){
	$("#welcome-dialog").dialog('option', 'title', title);
},

}

