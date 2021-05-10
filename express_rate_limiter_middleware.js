const redis = require( "redis" );
const { RateLimiterRedis } = require( "rate-limiter-flexible" );

const Personal = require( "./main.js" ).personal;

const redisClient = redis.createClient({
	host: Personal.rate_limiter_flexible.redis.host ,
	port: Personal.rate_limiter_flexible.redis.port ,
	db: Personal.rate_limiter_flexible.redis.db_number ,
	enable_offline_queue: false ,
});

const rateLimiter = new RateLimiterRedis({
	storeClient: redisClient ,
	keyPrefix: "middleware" ,
	points: Personal.rate_limiter_flexible.rate.requests , // 10 requests
	duration: Personal.rate_limiter_flexible.rate.per_number_of_seconds , // per 1 second by IP
});

const rateLimiterMiddleware = ( req , res , next ) => {
	rateLimiter.consume( req.ip )
	.then(() => {
		next();
	})
	.catch(() => {
		res.status( 429 ).send( Personal.rate_limiter_flexible.block_message );
	});
};

module.exports = rateLimiterMiddleware;