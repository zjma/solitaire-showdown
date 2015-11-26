exports.createServerContext = function(){
    var svrrun = {
        name_list       : {},
        map_id_to_name  : {},
        map_id_to_game:{},
        ready_queue :[],

        /**
         * 
         */
        addPlayer:function(sockid){
            this.map_id_to_name[sockid] = 'NoName';
        },
        delPlayer:function(sockid,name){
            /* If the name is being used by others, reject it. */
            if (this.name_list.indexOf(name)>=0
                    && this.map_id_to_name[sockid] != name)
            {
                console.log('But this name has been used by others...');
            }
            else
            {
                var old_name = this.map_id_to_name[sockid];
                this.name_list.remove_if_exists(old_name);
                if (name != 'NoName') this.name_list.push(name);//We allow many 'NoName's.
                this.map_id_to_name[sockid] = name;
            }
        },
        setPlayerName:function(){
        },
        setPlayerReady:function(){
        },
        setPlayerUnready:function(){
        },
        setPlayerStandby:function(){
        },
        actPlayerHome:function(){
        },
        movePlayerCard:function(){
        },
        submitPlayerCard:function(){
        },
        setPlayerRequestEnd:function(){
        },
        setPlayerWantContinue:function(){
        },
    };

};
