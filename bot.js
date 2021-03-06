//  __   __  ___        ___
// |__) /  \  |  |__/ |  |
// |__) \__/  |  |  \ |  |

// This is the main file for the meetingbot bot.

// Import Botkit's core features
const { Botkit } = require('botkit');
const { BotkitCMSHelper } = require('botkit-plugin-cms');

// Import a platform-specific adapter for slack.

const { SlackAdapter, SlackMessageTypeMiddleware, SlackEventMiddleware } = require('botbuilder-adapter-slack');

const { MongoDbStorage } = require('botbuilder-storage-mongodb');
const { MongoClient } = require('mongodb');

// Load process.env values from .env file
require('dotenv').config();

let storage = null;
if (process.env.MONGO_URI) {
    storage = mongoStorage = new MongoDbStorage({
        url : process.env.MONGO_URI,
    });
}

const adapter = new SlackAdapter({
    // parameters used to secure webhook endpoint
    verificationToken: process.env.VERIFICATION_TOKEN,
    clientSigningSecret: process.env.CLIENT_SIGNING_SECRET,

    // auth token for a single-team app
    botToken: process.env.BOT_TOKEN,

    // credentials used to set up oauth for multi-team apps
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    scopes: ['bot'],
    redirectUri: process.env.REDIRECT_URI,

    // functions required for retrieving team-specific info
    // for use in multi-team apps
    getTokenForTeam: getTokenForTeam,
    getBotUserByTeam: getBotUserByTeam,
});

// Use SlackEventMiddleware to emit events that match their original Slack event types.
adapter.use(new SlackEventMiddleware());

// Use SlackMessageType middleware to further classify messages as direct_message, direct_mention, or mention
adapter.use(new SlackMessageTypeMiddleware());


const controller = new Botkit({
    webhook_uri: '/api/messages',

    adapter: adapter,

    storage
});

controller.webserver.get('/auth/callback', function(req, res) {
    res.send(`<div style="text-align: center; margin-top: 25px; font-family: sans-serif;">
      <h1>Send this to <i>@Ok Zoomer</i> on Slack:</h1>
      <textarea style="width: 70%; margin: auto; height: 150px; padding: 15px; text-align: center; font-size: 1.3em; color: steelblue;">
        /meeting-token ${req.query.code}
      </textarea>
    </div>`);
  });

if (process.env.CMS_URI) {
    controller.usePlugin(new BotkitCMSHelper({
        uri: process.env.CMS_URI,
        token: process.env.CMS_TOKEN,
    }));
}

// Once the bot has booted up its internal services, you can use them to do stuff.
controller.ready(() => {

    // load traditional developer-created local custom feature modules
    controller.loadModules(__dirname + '/features');

    /* catch-all that uses the CMS to trigger dialogs */
    if (controller.plugins.cms) {
        controller.on('message,direct_message', async (bot, message) => {
            let results = false;
            results = await controller.plugins.cms.testTrigger(bot, message);

            if (results !== false) {
                // do not continue middleware!
                return false;
            }
        });
    }

});

async function getTokenForTeam(teamId) {
    if (tokenCache[teamId]) {
        return new Promise((resolve) => {
            setTimeout(function() {
                resolve(tokenCache[teamId]);
            }, 150);
        });
    } else {
        console.error('Team not found in tokenCache: ', teamId);
    }
}

async function getBotUserByTeam(teamId) {
    if (userCache[teamId]) {
        return new Promise((resolve) => {
            setTimeout(function() {
                resolve(userCache[teamId]);
            }, 150);
        });
    } else {
        console.error('Team not found in userCache: ', teamId);
    }
}


// HERE!!!!!!!!!!!!!!
const gcal = require('./gcalstuff').init(controller)

const min_to_end = 3
async function runJob() {
    const users = await gcal._getAllUsers()
    const now = new Date().getTime()
    for (user of users) {
        const {user_id, token, user_name} = user
        console.log(`processing ${user_name}`)
        const events = await getEvents(user_id, token)
        for (eventObj of events) {
            console.log(`processing ${eventObj.title}`)
            if (!eventObj.endTime) {
                continue
            }
            const eventEnd = new Date(eventObj.endTime)
            if (eventEnd > new Date(now - ((5) * 60000)) && eventEnd < new Date(now + ((7) * 60000))) {
                console.log(eventObj)
                send_msg(`Your meeting ${eventObj.title} is about to end - please wrap things up soon :)\nIf you are going to run over, send \`/meeting-notify\` to notify your next meeting's participants!`, user_id)
            }
        }
    }
}

async function send_msg(text, user_id) {
    const bot = await controller.spawn();
    await bot.api.chat.postMessage({text, channel: user_id, token: process.env.BOT_TOKEN})
}

setTimeout(runJob, 10000)
setInterval(runJob, 60000*3)
