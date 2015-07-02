game = {
is_valid_submit: function(value){
	if (isNaN(value)) return false;
	var i;
	for (i=0; i<8; i++) {
		if (value%13==0 && this.slots[i]==undefined || this.slots[i]+1==value && value%13!=0)
			return true;
	}
	return false;
},

is_valid_move: function(value, dstz){
	if (isNaN(value)) return false;
	if (this.players[0].zones[dstz].length == 0) return true;
	var dstcard = this.players[0].zones[dstz][this.players[0].zones[dstz].length-1];
	return (value+1+39-dstcard)%26 == 0 && value % 13 != 12;
},

move: function(srcz, srcf, dstz) {
	if (srcz<4) {
		this.players[0].zones[dstz] = this.players[0].zones[dstz].concat(this.players[0].zones[srcz].splice(srcf, this.players[0].zones[srcz].length-srcf));
	}
	else if (srcz==4) {
		this.players[0].zones[dstz].push(this.players[0].homeside.pop());
	}
	else if (srcz==5) {
		this.players[0].zones[dstz].push(this.players[0].pile);
		this.players[0].pile = undefined;
		if (this.players[0].pile_count>0) this.players[0].pile_count--;
	}
},

submit: function(srcz) {
	if (srcz<4) {
		this.players[0].zones[dstz] = this.players[0].zones[dstz].concat(this.players[0].zones[srcz].splice(srcf, this.players[0].zones[srcz].length-srcf));
	}
	else if (srcz==4) {
		this.players[0].zones[dstz].push(this.players[0].homeside.pop());
	}
	else if (srcz==5) {
		this.players[0].zones[dstz].push(this.players[0].pile);
		this.players[0].pile = undefined;
		if (this.players[0].pile_count>0) this.players[0].pile_count--;
	}
},

players: [
	{
		name: 'Alice',
		score: 103,
		requested_end: false,
		pile: 5,
		pile_count: 13,
		home_count: 2,
		homeside: [26,27,28],
		zones: [[0],[2,14],[18,4,16],[22,8,20,6]],
	},
	{
		name: 'Bob',
		score: 103,
		requested_end: false,
		pile: 5,
		pile_count: 13,
		home_count: 2,
		homeside: [25,24,23],
		zones: [[],[],[],[38,50,36,48,34,46,32,44,30,42,28,40,26]],
	},
],

slots: [1,42,0,15,,,,],



}
