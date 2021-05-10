const path = require( "path" );
const PersonalFilePath = path.join( process.env.HOME , ".config" , "personal" , "raspi_motion_alarm_rewrite.json" );
const Personal = require( PersonalFilePath );
const RedisUtils = require( "redis-manager-utils" );
const EventEmitter = require( "./main.js" ).event_emitter;
let redis_manager;
let redis_subscriber;
( async ()=> {
    redis_manager = new RedisUtils( Personal.redis.database_number , Personal.redis.host , Personal.redis.port );
    await redis_manager.init();
    redis_subscriber = new RedisUtils( Personal.redis.database_number , Personal.redis.host , Personal.redis.port );
    await redis_subscriber.init();
    redis_subscriber.redis.on( "message" , ( channel , message )=> {
        //console.log( "sub channel " + channel + ": " + message );
        console.log( "new message from: " + channel );
        console.log( message );
        if ( channel === "new_info" ) {
            EventEmitter.emit( "new_info" , message );
        }
    });
    redis_subscriber.redis.subscribe( "new_info" );
})();

function sleep( ms ) { return new Promise( resolve => setTimeout( resolve , ms ) ); }

function get_eastern_time_key_suffix() {
    const now = new Date( new Date().toLocaleString( "en-US" , { timeZone: "America/New_York" } ) );
    const now_hours = now.getHours();
    const now_minutes = now.getMinutes();
    const dd = String( now.getDate() ).padStart( 2 , '0' );
    const mm = String( now.getMonth() + 1 ).padStart( 2 , '0' );
    const yyyy = now.getFullYear();
    const hours = String( now.getHours() ).padStart( 2 , '0' );
    const minutes = String( now.getMinutes() ).padStart( 2 , '0' );
    const seconds = String( now.getSeconds() ).padStart( 2 , '0' );
    const key_suffix = `${ yyyy }.${ mm }.${ dd }`;
    return key_suffix;
}

function pluralize( noun , suffix = "s" ) {
    if ( !noun ) { return; }
    if ( noun.length < 2 ) { return noun; }
    if ( noun.charAt( noun.length - 1 ) === "s" ) { return noun; }
    return noun + "s";
}

function redis_get_lrange( key , start , end ) {
    return new Promise( async ( resolve , reject )=> {
        try {
            const current_length = await redis_manager.listGetLength( key );
            redis_manager.redis.lrange( key , start , end , ( error , results )=> {
                resolve( { current_length: current_length , data: results } );
                return;
            });
        }
        catch( error ) { console.log( error ); resolve( error ); return; }
    });
}

function redis_publish( key , message_object ) {
    return new Promise( function( resolve , reject ) {
        try {
            redis_manager.redis.publish( key , JSON.stringify( message_object ) , ( error , results )=> {
                resolve( results );
                return;
            });
        }
        catch( error ) { console.log( error ); resolve( error ); return; }
    });
}

function ON_CONNECTION( socket , req ) {
    EventEmitter.on( "new_info" , ( info )=> {
        console.log( info );
        socket.send( JSON.stringify( { message: "new_info" , data: info } ) );
    });
    socket.on( "message" , async ( message )=> {
        try { message = JSON.parse( message ); }
        catch( e ) { console.log( e ); return; }
        console.log( message );
        if ( message.type === "pong" ) {
            console.log( "inside pong()" );
        }
        else if ( message.type === "ionic-controller" ) {
            return new Promise( async ( resolve , reject )=> {
                try {
                    if ( !message.command ) { resolve(); return; }
                    if ( message.command === "redis_get_lrange" ) {
                        if ( !messsage.key ) { resolve(); return; }
                        message.starting_position = message.starting_position || 0;
                        message.ending_position = message.ending_position || -1;
                        const result = await get_redis_lrange( message.key , message.starting_position , message );
                        socket.send( JSON.stringify( { message: `new_${ pluralize( message.channel ) }` , data: result } ) );
                    }
                    else if ( message.command === "frame" ) {
                        await redis_publish( "ionic-controller" , {
                            command: "publish_new_frame" ,
                        });
                        //await sleep( 1000 );
                        //const result = await redis_get_lrange( `sleep.images.frames.${ get_eastern_time_key_suffix() }` , 0 , 0 );
                        //socket.send( JSON.stringify( { message: "new_frame" , data: result } ) );
                    }
                    else if ( message.command === "call" ) {
                        if ( !messsage.number ) { resolve(); return; }
                        await redis_publish( "ionic-controller" , message );

                    }
                    else if ( message.command === "message" ) {
                        if ( !messsage.number ) { resolve(); return; }
                        if ( !messsage.message ) { resolve(); return; }
                        await redis_publish( "ionic-controller" , message );
                    }
                    resolve();
                    return;
                }
                catch( error ) { console.log( error ); resolve( error ); return; }
            });
        }
        else if ( message.type === "redis_get_lrange" ) {
            return new Promise( async ( resolve , reject )=> {
                try {
                    if ( !message.list_key ) { resolve(); return; }
                    if ( !message.channel ) { resolve(); return; }
                    const starting_position = message.starting_position || 0;
                    const ending_position = message.ending_position || -1;
                    const result = await redis_get_lrange( message.list_key , starting_position , ending_position );
                    //console.log( result );
                    socket.send( JSON.stringify( { message: `new_${ pluralize( message.channel ) }` , current_length: result.current_length , data: result.data } ) );
                    resolve( result );
                    return;

                }
                catch( error ) { console.log( error ); resolve( error ); return; }
            });
        }

    });

}
module.exports.on_connection = ON_CONNECTION;