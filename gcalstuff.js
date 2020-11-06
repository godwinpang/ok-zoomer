const {google} = require('googleapis');
const { MongoClient } = require('mongodb');
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

const { subHours, addHours, addMinutes, subMinutes } = require('date-fns')

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
            const users= await db.collection('users').find().toArray()

            return users;
        }

        getEvents = async function(user_id, oauth_token) {
            oauth2Client.setCredentials(oauth_token.tokens)

            const args = {
                auth: oauth2Client,
                calendarId: 'primary',
                maxResults: 10,
                singleEvents: true,
                orderBy: 'startTime',
                timeZone: "utc",
                timeMin: subMinutes(new Date(), 10),
                timeMax: addMinutes(new Date(), 10)
            }

            const result = await google.calendar('v3').events.list(args)
            const meetings = []
            for (meeting of result.items) {
                const meetingObj = {
                    startTime: meeting.start.dateTime,
                    endTime: meeting.end.dateTime,
                    title: meeting.summary,
                    attendees: meeting.attendees,
                }
                meetings.push(meetingObj)
            }

            return meetings
        }

        getToken = async function(code) {
            return await oauth2Client.getToken(code)
        }

        return {
            getAuthUrl,
            saveUser,
            _getAllUsers,
            getEvents,
            getToken
        }
    }
}