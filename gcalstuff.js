const {google} = require('googleapis');
const { MongoClient } = require('mongodb');
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

module.exports = {
    init: function(controller) {
        const storage = controller.storage
        const client = new MongoClient(process.env.MONGO_URI)
        var db = null
        client.connect(function(err, client) {
            db = client.db('ok-zoomer')
        })
        getAuthUrl = function(){
            return oauth2Client.generateAuthUrl({
                access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token),
                approval_prompt: 'force', // this will force the sending of a refresh_token. shouldnt be necessary the first time..
                scope: [ 'https://www.googleapis.com/auth/calendar.readonly' ]
            });
        }

        saveUser = async function(userObj){
            await db.collection('users').insertOne(userObj)
        }

        _getAllUsers = async function() {
            const usersCursor = await db.collection('users').find()
            const users = []
            while(usersCursor.hasNext()) {
                users.append(usersCursor.next())
            }

            return users;
        }

        return {
            getAuthUrl,
            saveUser
        }
    }
}