/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
const { SlackDialog } = require('botbuilder-adapter-slack');
const { BotkitConversation } = require('botkit');


module.exports = function(controller) {
    const gcal = require('../gcalstuff').init(controller)

    controller.ready(async () => {
        if (process.env.MYTEAM) {
            let bot = await controller.spawn(process.env.MYTEAM);
            await bot.startConversationInChannel(process.env.MYCHAN,process.env.MYUSER);
            bot.say('I AM AWOKEN.');
        }
    });

    controller.on('direct_message', async(bot, message) => {
        await bot.reply(message,'I heard a private message');
    });

    controller.hears('dm me', 'message', async(bot, message) => {
        await bot.startPrivateConversation(message.user);
        await bot.say(`Let's talk in private.`);
    });

    controller.on('direct_mention', async(bot, message) => {
        await bot.reply(message, `I heard a direct mention that said "${ message.text }"`);
    });

    controller.on('mention', async(bot, message) => {
        await bot.reply(message, `You mentioned me when you said "${ message.text }"`);
    });

    controller.hears('ephemeral', 'message,direct_message', async(bot, message) => {
        await bot.replyEphemeral(message,'This is an ephemeral reply sent using bot.replyEphemeral()!');
    });

    controller.hears('threaded', 'message,direct_message', async(bot, message) => {
        await bot.replyInThread(message,'This is a reply in a thread!');

        await bot.startConversationInThread(message.channel, message.user, message.incoming_message.channelData.ts);
        await bot.say('And this should also be in that thread!');
    });

    controller.on('block_actions', async (bot, message) => {
        await bot.reply(message, `Sounds like your choice is ${ message.incoming_message.channelData.actions[0].value }`)
    });

    controller.on('slash_command', async(bot, message) => {
        const user_name = message.user_name
        const user_id = message.user_id
      switch (message.command) {
        case "/meeting-auth":
          // get auth url and reply to them :)
          const authURL = gcal.getAuthUrl()
          bot.replyPrivate(message, `Click on this link ${authURL}\nThen copy the token and reply with /meeting-token <token>`)
          break;
        case "/meeting-token":
          const code = message.text
          // do something with auth here :)
          const token = await gcal.getToken(code)
          const user_object = {token, user_id, user_name}
          await gcal.saveUser(user_object)
          bot.replyPrivate(message, "Got your token")
          break;
        case "/meeting-notify":
            const events = await gcal.getCurrentEvents(user_id)
            if (events.length == 0) {
                console.log('skipping')
                return
            }
            const eventToNotify = events[0]
            console.log(`notifying events ${eventToNotify.title}`)
            const attendeesToNotify = gcal.getAttendees(user_name, eventToNotify)
            for (attendee of attendeesToNotify) {
                const attendee_id = await gcal.getIDFromName(attendee)
                await send_msg(`${user_name} is running late for a meeting and will be late for ${eventToNotify.title} - please be understanding :D`, attendee_id)
            }
        default:
          bot.replyAcknowledge(()=>{})
          return
      }
    });
}


async function send_msg(text, user_id) {
    const bot = await controller.spawn();
    await bot.api.chat.postMessage({text, channel: user_id, token: process.env.BOT_TOKEN})
}

// async function authenticate(controller, user_id){
//   const bot = await controller.spawn()

//   await bot.startPrivateConversation(user_id)
//   // now in dms
//   console.info("Started authenticate conversation with ", user);

//   await bot.ask(test)

//   message.ask(text, function(res, convo) {
//     console.log("received answer ", res.text)
//     userLib.getFirstTimeToken(user, response.text, function(success, error){
//       if (error) {
//         console.log("Google OAuth API Token could not be generated.")
//         convo.say(error)
//         convo.next()
//       } else if (success) {
//         convo.next()
//         console.log("success")
//         convo.say("Thanks for signing up! I'll start sending you notifications :)")
//       } else {
//         convo.say("Sorry it wasn't the ")
//       }
//     })
//   })
// }
