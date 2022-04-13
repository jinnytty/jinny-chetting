/**
  Simple(ish) example of discord gateway
  This code will get to ready, and then remain connected with heartbeats
  see https://discordapi.com/topics/gateway for more info
  zlib compression is implemented as it will be required in gateway v7 (so get used to it now)
*/

import WebSocket from 'ws';
import zlib from 'zlib-sync'; // npmjs.org/zlib-sync
import erlpack from 'erlpack'; // github.com/discordapp/erlpack
import fs from 'fs';
import tmi from 'tmi.js';
import { format } from './message.mjs';

let configFilename = 'config.json';

if (process.argv.length >= 3) {
  configFilename = process.argv[2];
}
const config = JSON.parse( await fs.promises.readFile(configFilename));

const chat = new tmi.Client({
  options: { debug: true, messagesLogLevel: "info" },
	connection: {
		reconnect: true,
		secure: true
	},
	identity: {
		username: config.username,
		password: 'oauth:'+config.oauth_token,
	},
	channels: [ config.chat ]
});

await chat.connect();


// https://discordapi.com/topics/gateway#gateway-opcodespayloads
const OPCodes = {
  HEARTBEAT: 1,
  IDENTIFY: 2,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
};

// zlib inflate context for zlib-stream
let inflate = null;


// sequence used for sessions and heartbeats
let sequence = 0;
let session_id = '';
let heartBeatInterval = undefined;
let ws = undefined;

function send(op, d) {
  if (!ws) return;
  ws.send(erlpack.pack({ op, d }));
}

let last_create_message = 0;
async function message_create(packet) {
  if ( Date.now() - last_create_message > config.message_wait) {
    last_create_message = Date.now();
    const msg = format(packet.d.content, config.max_message_length?config.max_message_length:300);
    await chat.say(config.chat, msg);
  }
}

let last_update_message = 0;
async function message_update(packet) {
 if ( Date.now() - last_update_message > config.message_wait) {
   last_update_message = Date.now();
   await chat.say(config.chat, config.update_message);
 }
}

let last_typing_message = 0;
async function typing_start(packet) {
  if ( Date.now() - last_typing_message > config.message_wait ) {
    last_typing_message = Date.now();
    await chat.say(config.chat, config.typing_message);
  }
}

async function  onMessage({ data }) {
  const l = data.length;
  // if data.length >= 4 and data ends with Z_SYNC_FLUSH constant
  const flush = l >= 4 &&
    data[l - 4] === 0x00 &&
    data[l - 3] === 0x00 &&
    data[l - 2] === 0xFF &&
    data[l - 1] === 0xFF;

  inflate.push(data, flush && zlib.Z_SYNC_FLUSH);

  if (!flush) return;

  // parse packet with erlpack after its inflated
  const packet = erlpack.unpack(inflate.result);

  // keep track of sequence for heartbeats
  if (packet.s) sequence = packet.s;

  console.log(packet);

  // handle gateway ops
  switch (packet.op) {
    case OPCodes.HELLO:
      console.log('Got op 10 HELLO');
      // set heartbeat interval
      heartBeatInterval = setInterval(() => send(OPCodes.HEARTBEAT, sequence), packet.d.heartbeat_interval);
      // https://discordapi.com/topics/gateway#gateway-identify
      const opt = {
        // you should put your token here _without_ the "Bot" prefix
        token: config.token,
        properties: {
          os: 'Linux',
          browser: 'Chrome',
          browser_user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36',
          browser_version: '99.0.4844.51',
          device: '',
        },
        compress: false,
      };
      if (session_id.length > 0) {
        opt.session_id = session_id;
        opt.seq = sequence;
      }
      send(OPCodes.IDENTIFY,opt);

    case 0:
      const data = packet.d;
      if (data == undefined) break;
      const topic = packet.t;
      if (topic == 'MESSAGE_CREATE') {
        if (data.guild_id == config.guild_id && data.channel_id == config.channel_id && data.author.id == config.user_id) {
          message_create(packet);
        }
      }
      if (topic == 'TYPING_START') {
        if (data.guild_id == config.guild_id && data.channel_id == config.channel_id && data.user_id == config.user_id) {
          typing_start(packet);
        }
      }
      if (topic == 'MESSAGE_UPDATE') {
        if (data.guild_id == config.guild_id && data.channel_id == config.channel_id && data.author && data.author.id == config.user_id) {
          message_update(packet);
        }
      }
      if (topic == 'READY') {
        session_id = data.session_id
      }

  }

 

  // handle gateway packet types
  if (!packet.t) return;
  switch (packet.t) {
    // we should get this after we send identify
    case 'READY':
      console.log('ready as', packet.d.user);
      
      
      const channels = {};
      channels[ config.channel_id ] = [[0,99]];
      send(14,{
        activities: true,
        channels,
        guild_id: config.guild_id,
        members: [],
        thread_member_list: [],
        threads: true,
        typing: true
      });
      break;
  }
};

function onOpen() {
  console.log('websocket opened!');
}

function onClose(e) {
  console.log(e);
  if (heartBeatInterval) {
    clearInterval(heartBeatInterval);
    heartBeatInterval = undefined;
  }
  ws = undefined;
  console.log('closed reconnecting');
  open();
}

function onError(e) {
  console.log(e);
};

function open() {
  inflate = new zlib.Inflate({
    chunkSize: 65535,
    flush: zlib.Z_SYNC_FLUSH,
  });
  // create websocket (technically you should perform a GET to /api/gateway and use the response)
  ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=etf&compress=zlib-stream');
  ws.onclose = onClose;
  ws.onerror = onError;
  ws.onopen = onOpen;
  ws.onmessage = onMessage;
}

open();