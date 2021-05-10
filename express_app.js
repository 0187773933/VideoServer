const express = require( "express" );
//const basicAuth = require( "express-basic-auth" );
const fs = require( "fs" );
const path = require( "path" );
const bodyParser = require( "body-parser" );
//const helmet = require( "helmet" );
const helmet = require( "helmet-csp" );
const crypto = require( "crypto" );
const cookieParser = require( "cookie-parser" );
const jwt = require( "jsonwebtoken" );

// Generate Random Stuff
// pwgen -1 34 | shasum -a 256 | awk '{ print $1; }' | while read x ; do echo "${x:0:32}" ; echo "${x:32:64}" ; done && pwgen -1 34 | shasum -a 256 | awk '{ print $1; }' && pwgen -1 34 | shasum -a 256 | awk '{ print $1; }'

const rateLimiterRedisMiddleware = require( "./express_rate_limiter_middleware.js" );

// https://github.com/helmetjs/helmet/issues/57
//const cors = require( "cors" );
const PORT = require( "./main.js" ).port;
const Personal = require( "./main.js" ).personal;

const app = express();

app.use( cookieParser( Personal.cookie_secret ) );
app.use( rateLimiterRedisMiddleware );

// app.use( basicAuth({
// 	users: Personal.websocket_server.http_auth.users ,
// 	challenge: true
// }));

const HTTPS_DOMAIN_URL = "https://5a56c671a310.ngrok.io";

// app.use( helmet() );
// Bcoz of Webkit/Safari
// https://www.npmjs.com/package/helmet-csp
app.use(
	helmet({
		directives: {
		defaultSrc: [ "'self'" , HTTPS_DOMAIN_URL ] ,
		scriptSrc: ["'self'", "'unsafe-inline'"] ,
		objectSrc: ["'none'"] ,
		upgradeInsecureRequests: [] ,
	} ,
		reportOnly: false ,
	})
);


// app.use( ( req , res , next ) => {
// 	const latest_nonce = crypto.randomBytes( 16 ).toString( "hex" );
// 	console.log( `Latest Nonce === ${latest_nonce}` );
// 	res.locals.nonce = "latest_nonce";
// 	//res.locals.nonce = "asdfasdfasdfasdfasdfasdfasdf"
// 	next();
// });

// app.use( ( req , res , next ) => {
// 	helmet({
// 	directives: {
// 		defaultSrc: [ "'self'" ] ,
// 		scriptSrc: [ "'self'" , `'nonce-${ res.locals.nonce }'` ],
// 		//scriptSrc: ["'self'", "'unsafe-inline'"]
// 	} ,
// 	})( req , res , next );
// });

// app.use( ( req , res ) => {
// 	res.end( `<script nonce="${res.locals.nonce}">console.log("${res.locals.nonce}");</script>`);
// });

app.use( express.static( path.join( __dirname , "client" ) ) );
app.use( express.static( "/Users/morpheous/TMP2/TestSource/" ) );

//app.use( express.static( Personal.websocket_server.ionic_build_static_path ) );
//app.use( cors( { origin: "http://localhost:" + PORT.toString() } ) );
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended: true } ) );

//const HTMLPath = path.join( Personal.websocket_server.ionic_build_static_path , "index.html" );
const index_html_path = path.join( __dirname , "./client/views" , "index.html" );
app.get( "/" , ( req , res ) => {
	res.sendFile( index_html_path );
});

const login_html_path = path.join( __dirname , "./client/views" , "login.html" );
app.get( "/login" , ( req , res ) => {
	res.sendFile( login_html_path );
});

function AuthorizedUser( username , password ) {
	try {
		for ( let i = 0; i < Personal.users.length; ++i ) {
			if ( Personal.users[ i ]["username"] === username  ) {
				if ( Personal.users[ i ]["password"] === password ) {
					return true;
				}
			}
		}
		return false;
	}
	catch( error ) { console.log( error ); return false; }
}

function AuthorizedJWT( jwt_token ) {
	try {
		return jwt.verify( jwt_token , Personal.jwt_secret , ( err , decoded ) => {
			if ( err !== null ) { return false; }
			console.log( decoded );
			return true;
		});
	}
	catch( error ) { console.log( error ); return false; }
}

// https://stackoverflow.com/a/32882427
function urlencode( str ) {
	str = ( str + '' ).toString();
	return encodeURIComponent( str )
	.replace('!', '%21')
	.replace('\'', '%27')
	.replace('(', '%28')
	.replace(')', '%29')
	.replace('*', '%2A')
	.replace('%20', '+');
}

app.post( "/login" , ( req , res ) => {
	if ( !req ) { res.redirect( "/login" ); return; }
	if ( !req.body ) { res.redirect( "/login" ); return; }
	if ( !req.body.username ) { res.redirect( "/login" ); return; }
	if ( !req.body.password ) { res.redirect( "/login" ); return; }
	if ( !AuthorizedUser( req.body.username , req.body.password ) ) { res.redirect( "/login" ); return; }
	console.log( "Username and Password Sent in Form Data Match with Some Username and Password Stored in ~/.config/personal/media_website.json" );
	console.log( "Generating New JWT Token" );
	const token = jwt.sign( { data: `${req.body.username}===${req.body.password}`  } , Personal.jwt_secret );
	console.log( token );
	res.cookie( "mediawebsite-jwt" , token , Personal.jwt_cookie_options ); // 900000 = 15 Minutes
	res.redirect( "/video" );
});

const video_path = path.join( __dirname , "./client/views" , "local_video_test.html" );
app.get( "/video" , ( req , res ) => {
	if ( !req ) { res.redirect( "/login" ); return; }
	if ( !req.signedCookies ) { res.redirect( "/login" ); return; }
	if ( !req.signedCookies["mediawebsite-jwt"] ) { res.redirect( "/login" ); return; }
	if ( !AuthorizedJWT( req.signedCookies["mediawebsite-jwt"] ) ) { res.redirect( "/login" ); return; }
	//console.log( "Supposed Valid User, Password, JWT" );

	if ( !req.query ) { res.redirect( "/login" ); return; }
	if ( !req.query.path ) { res.redirect( "/login" ); return; }
	const video_path = req.query.path;
	const stat = fs.statSync( video_path );
	if ( !stat.isFile()) { res.redirect( "/login" ); return; }
	//if ( path.extname( video_path ).split( '.' ).reverse()[ 0 ] !== "mp4" ) { res.redirect( "/login" ); return; }
	//console.log( "Supposed Valid MP4 Path Was Sent" );
	const url_encoded_path = urlencode( video_path );
	const video_html = `
	<html>
		<video controls playsInline preload="no" width="auto" height="auto" >
			<!-- <source src="IAmTheWalrus.mp4" type="video/mp4"> -->
			<source src="${HTTPS_DOMAIN_URL}/video-source?path=${url_encoded_path}" type="video/mp4">
			Your browser does not support the video tag.
		</video>
	</html>
	`;
	// fs.unlinkSync( video_path );
	// fs.writeFileSync( video_path , video_html , { encoding: "utf8" } );
	// res.sendFile( video_path );
	res.set( "Content-Type" , "text/html" );
	res.send( video_html );
});

// https://github.com/meloncholy/vid-streamer
// https://medium.com/better-programming/video-stream-with-node-js-and-html5-320b3191a6b6
app.get( "/video-source" , ( req , res )=> {
	if ( !req ) { res.redirect( "/login" ); return; }
	if ( !req.signedCookies ) { res.redirect( "/login" ); return; }
	if ( !req.signedCookies["mediawebsite-jwt"] ) { res.redirect( "/login" ); return; }
	if ( !AuthorizedJWT( req.signedCookies["mediawebsite-jwt"] ) ) { res.redirect( "/login" ); return; }
	console.log( "Supposed Valid User, Password, JWT" );
	const video_path = req.query.path;


	// Options 1
	// ===============================
	// const stat = fs.statSync( video_path );
	// const fileSize = stat.size;
	// const range = req.headers.range;
	// if ( range ) {
	// 	const parts = range.replace( /bytes=/ , "" ).split( "-" );
	// 	const start = parseInt( parts[ 0 ] , 10 );
	// 	const end = parts[ 1 ] ? parseInt( parts[ 1 ] , 10 ) : ( fileSize - 1 );
	// 	const chunksize = ( ( end - start ) + 1 ) ;
	// 	const file = fs.createReadStream( video_path , { start , end } );
	// 	const head = {
	// 		'Content-Range': `bytes ${start}-${end}/${fileSize}` ,
	// 		'Accept-Ranges': 'bytes' ,
	// 		'Content-Length': chunksize ,
	// 		'Content-Type': 'video/mp4' ,
	// 	};
	// 	res.writeHead( 200 , head );
	// 	file.pipe( res );
	// }
	// else {
	// 	const head = {
	// 		'Content-Length': fileSize ,
	// 		'Content-Type': 'video/mp4',
	// 	};
	// 	res.writeHead( 200 , head );
	// 	fs.createReadStream( video_path ).pipe( res );
	// }

	// Options 2
	// ===============================
	const stat = fs.statSync( video_path );
	if ( stat.isFile()) {
		const extension = path.extname( video_path ).split( '.' ).reverse()[ 0 ];
		if ( extension === 'mp4' ) {
			const range = req.headers.range;
			const parts = range.replace( /bytes=/ , "" ).split( "-" );
			const partialstart = parts[ 0 ];
			const partialend = parts[ 1 ];
			const total = stat.size;
			const start = parseInt( partialstart , 10 );
			const end = partialend ? parseInt( partialend , 10 ) : total - 1;
			const chunksize = ( end - start ) + 1;
			//const mimeType = mimeTypes[ extension ] || 'text/plain; charset=utf-8';
			const mimeType = "video/mp4";
			res.writeHead( 206 , {
				'Content-Range': 'bytes ' + start + '-' + end + '/' + total ,
				'Accept-Ranges': 'bytes' ,
				'Content-Length': chunksize ,
				'Content-Type': mimeType
			});
			const fileStream = fs.createReadStream( video_path , {
				start: start ,
				end: end
			});
			fileStream.pipe( res );
			res.on( 'close' , () => {
				//console.log( 'response closed' );
				if ( res.fileStream ) {
					res.fileStream.unpipe( this );
					if ( this.fileStream.fd ) {
						fs.close( this.fileStream.fd );
					}
				}
			});
		}
		else {
			const mimeType = `video/${extension}`;
			res.writeHead( 200 , { 'Content-Type': mimeType } );
			const fileStream = fs.createReadStream( video_path );
			fileStream.pipe( res );
		}
		return;
  	}

	// Options 3
	// ===============================
	// const stat = fs.statSync( video_path );
	// const fileSize = stat.size;
	// const head = {
	// 	'Content-Length': fileSize ,
	// 	'Content-Type': 'video/mp4',
	// };
	// res.writeHead( 200 , head );
	// fs.createReadStream( video_path ).pipe( res );

});

module.exports = app;