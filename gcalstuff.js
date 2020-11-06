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

        getCurrentEvents = async function(user_id) {
            const users = await db.collection('users').find({user_id}).toArray()
            const user = users[0]

            oauth2Client.setCredentials(user.token)

            const args = {
                auth: oauth2Client,
                calendarId: 'primary',
                maxResults: 10,
                singleEvents: true,
                orderBy: 'startTime',
                timeZone: "utc",
                timeMin: new Date(),
                timeMax: new Date()
            }

            const result = await google.calendar('v3').events.list(args)
            const meetings = []
            for (meeting of result.data.items) {
                if (!meeting.start.startTime) {
                    continue
                }

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
            for (meeting of result.data.items) {
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

        getAttendees = function(person, meeting) {
            const attendees = []
            for (x of meeting.attendees) {
                const id = x.email.split('@')[0]
                const attending = x.responseStatus == 'accepted'
                if (id == person || !attending) {
                    continue
                }

                attendees.push(id)
            }
            return attendees
        }

        getIDFromName = async function(name) {
            const user = await db.collection('users').find({user_name: name}).toArray()[0]
            return user.user_id
        }

        return {
            getAuthUrl,
            saveUser,
            _getAllUsers,
            getEvents,
            getToken,
            getAttendees,
            getCurrentEvents,
            getIDFromName
        }
    }
}