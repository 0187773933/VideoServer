//const RedisManager = require( "./main.js" ).redis_manager;
//const RedisGetLRange = require( "./utils.js" ).redis_get_lrange;

function sleep( ms ) { return new Promise( resolve => setTimeout( resolve , ms ) ); }

// https://github.com/eminmuhammadi/emiga-stream/blob/master/server/server.js

//https://stackoverflow.com/a/46878342
function GetUniqueID() {
	const part1 =  Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
	const part2 =  Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
	const part3 =  Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
	return `${part1}-${part2}-${part3}`;
}

function getter_handler( property ) {
	return new Promise( async ( resolve , reject ) => {
		try {
			const data = await RedisManager.keyGet( `STATE.${ property.toUpperCase() }` );
			resolve( data );
			return;
		}
		catch( error ) { console.log( error ); resolve( "failed" ); return; }
	});
}

function compute_reply_message( message ) {
	return new Promise( async ( resolve , reject )=> {
		let result = { message: "" , broadcast: false };
		try {
			switch( message.type ) {
				case "ping":
					result.message = "pong";
					break;
				case "getter":
					if ( !message.property ) { result.message = "no getter property sent"; break; }
					result.message = "updated lobby";
					result.setter = "updateLobby";
					result.data = await getter_handler( message.property );
					break;
				default:
					break;
			}
			resolve( result );
			return;
		}
		catch( error ) { console.log( error ); result.message = error.stack; resolve( result ); return; }
	});
}

function ON_CONNECTION( socket ) {
	socket.id = GetUniqueID();
	socket.on( "message" , async ( message )=> {
		try {
			if ( !message ) { socket.emit( "reply" , { "socket_origin_id": socket.id , "error": "No Data Sent" } ); return; }
			if ( !message.type ) { socket.emit( "reply" , { "socket_origin_id": socket.id , "error": "No Message Type Sent" } ); return; }
			let result = await compute_reply_message( message );
			result.socket_origin_id = socket.id;
			socket.emit( "reply" , result );
			if ( result.broadcast ) {
				socket.broadcast.emit( "reply" , result );
			}
		}
		catch( error ) {
			console.log( error );
			try {
				socket.emit( "reply" , { "socket_origin_id": socket.id , "error": error.stack } );
			}
			catch( error ) { console.log( "Something Wrong With WebSocket" ); }
		}
	});
}
module.exports.on_connection = ON_CONNECTION;