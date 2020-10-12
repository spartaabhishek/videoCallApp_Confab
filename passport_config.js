const LocalStrategy = require('passport-local').Strategy 


 function initialize(passport,getUserByUsername,getUserById){


	const authenticateUser= async (username,password,done)=>{
		const user=await getUserByUsername(username)
		console.log("hola")
		console.log(user)
		if(user==null){
			return done(null,false,{message:"No user found.."})
		}
		try{
			if(password===user.password){
				console.log("passwd correct")
				return done(null,user)
            }
			else{
				console.log("passwd invalid")
				return done(null,false,{message:"error passwd invalid"})
			}
		}
		catch(e){
			return done(e,false)
		}
	}

	passport.use(new LocalStrategy(authenticateUser))

	passport.serializeUser((user,done)=>{
		done(null,user.userid)
	})

	passport.deserializeUser(async (id,done)=>{
		done(null,await getUserById(id))
	})
}

module.exports=initialize