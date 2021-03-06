import express, {Application, Request, Response} from 'express';
import config from 'config';
import * as http from "http";
import * as bodyParser from "body-parser";
import * as WebSocket from "ws";
import morgan from 'morgan';
import eiscp from 'eiscp';

import {InfoController} from "./info/InfoController";
import {ListeningModes, onOpen, onWsClose, onWsError, onWsMessage} from "./sockets/WebSocketController";
import {getStatus, getVolume, listeningMode} from "./sockets/ReceiverController";
import compression from "compression";
import {
    cycleLights,
    dimCurrentLight,
    setPlugState,
    toggleCurrentLight,
    toggleSceneForGroup,
    turnAllZonesOff
} from "./hue/HueController";
import * as dgram from "dgram";


// /**
//  * db
//  */
// mongoose.connect(
//     'mongodb://localhost/' + config.get('database.name'),
//     {
//         useNewUrlParser: true,
//         useUnifiedTopology: true
//     }
// );

/**
 * App
 */
const app: Application = express();
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(compression())

// create server and socket
const server: http.Server = http.createServer(app);
const wss: WebSocket.Server = new WebSocket.Server(
    {
        server,
        path: '/socket'
    }
);

/**
 * define routes
 */
// further routes
app.use('/info', InfoController);


/**
 * HUE
 */
export var SubwooferPlugState: boolean;
SubwooferPlugState = false;
// setPlugState(false).then(result => SubwooferPlugState = result);
setPlugState(false).then(result => SubwooferPlugState = result);

/**
 * Receiver control
 */
const eiscp_config = {
    host: config.get('receiver.ip'),
    reconnect: true,
    reconnect_sleep: 2
}

export declare let Device;
export declare let DeviceConnected: boolean;
export declare let DeviceZoneMainActive: boolean;
export declare let DeviceZoneMainVolume: number;
export declare let DeviceZoneMainMuted: boolean;
export declare let DeviceZone2Active: boolean;
export declare let DeviceZone2Volume: number;
export declare let DeviceListeningMode: ListeningModes;

Device = eiscp
DeviceConnected = false;
DeviceZoneMainActive = false;
DeviceZoneMainVolume = 0;
DeviceZoneMainMuted = false;
DeviceZone2Active = false;
DeviceZone2Volume = 0;

const device_verbose_error = false;
const device_verbose_dbg = false;

Device.connect(eiscp_config, () => {
    DeviceConnected = true;
});

Device.on('connect', (ip) => {
    Device.raw(getStatus(0));
    Device.raw(getStatus(1));
    Device.raw(getVolume(0));
    Device.raw(getVolume(1));
    Device.raw(listeningMode())
})

Device.on('error', (error) => {
    if (device_verbose_error) {
        console.log('\n### Receiver Error')
        console.log('------------------')
        console.log('\t');
        console.log(error)
        console.log('')
    }
})

Device.on('debug', (dbg) => {
    if (device_verbose_dbg) {
        console.log('\n### Receiver Debug')
        console.log('------------------')
        console.log('\t', dbg);
        console.log('')
    }
})

Device.on('data', (data) => {
    const cmd = data.command;
    const iscp_cmd = data.iscp_command as string;
    const zone = data.zone as string;

    console.log('cmd', cmd);
    if (cmd === 'power' || cmd === 'system-power') {
        const zone = data.zone;
        if (zone === 'main') {
            const on = data.argument === 'on';
            DeviceZoneMainActive = on;
            console.log('subwoofer state', SubwooferPlugState);
            if (on) {
                if (!SubwooferPlugState) {
                    setPlugState(true).then(result => SubwooferPlugState = result.on)
                }
            } else {
                if (SubwooferPlugState) {
                    setPlugState(false).then(result => SubwooferPlugState = result.on)
                }
            }
        } else if (zone === 'zone2') {
            DeviceZone2Active = data.argument === 'on';
        }
    }


    if (iscp_cmd.startsWith('MVL') || iscp_cmd.startsWith('ZVL')) {
        if (zone == 'main') {
            DeviceZoneMainVolume = +data.argument;
        } else if (zone == 'zone2') {
            DeviceZone2Volume = +data.argument;
        }
    }

    if (cmd === 'listening-mode') {
        if (data.argument === 'all-ch-stereo') {
            DeviceListeningMode = ListeningModes.allChannelStereo;
        } else if (data.argument === 'stereo') {
            DeviceListeningMode = ListeningModes.stereo;
        } else if (iscp_cmd === 'LMDFF') {
            DeviceListeningMode = ListeningModes.auto;
        } else if (iscp_cmd === 'LMD80') {
            DeviceListeningMode = ListeningModes.dolby;
        }
    }

    if (cmd === 'audio-muting') {
        if (data.argument === 'on') {
            DeviceZoneMainMuted = true;
        } else {
            DeviceZoneMainMuted = false;
        }
    }
})

Device.on('close', (data) => {
    console.log('connection closed', data, '\n\n')
})


/**
 * WebSocket
 */
wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (message_str: string) => onWsMessage(ws, message_str));
    ws.on('open', () => onOpen());
    ws.on('error', (error: Error) => onWsError(error));
    ws.on('close', (code, reason: string) => onWsClose(code, reason));
});


/**
 * IR REMOTE SOCKET
 */
const irRemoteSocket = dgram.createSocket('udp4');
let last = '';
irRemoteSocket.on('listening', () => {
    const address = irRemoteSocket.address() as any;
    console.log(`UDP server listening on: ${address.address}:${address.port}`);
});

irRemoteSocket.on("connect", () => {
    console.log('A client has connected');
})

irRemoteSocket.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});

irRemoteSocket.on('message', (msg, rinfo) => {
    const data = JSON.parse(msg.toString('utf-8'));
    console.log('IR Key Event: ', data);
    if (data.evt === 'single') {
        if (data.key === 'KEY_POWER') {
            turnAllZonesOff();
        }
        if (data.key === 'KEY_1') {
            toggleSceneForGroup('Home', 'BrightHOME');
        }
        if (data.key === 'KEY_2') {
            toggleSceneForGroup('Home', 'MovietimeHOME');
        }
        if (data.key === 'KEY_3') {
            toggleSceneForGroup('Home', 'FoodHOME');
        }

        // cycling
        if (data.key === 'KEY_LEFT') {
            cycleLights('left');
        }
        if (data.key === 'KEY_RIGHT') {
            cycleLights('right');
        }
        if (data.key === 'KEY_UP') {
            dimCurrentLight('up');
        }
        if (data.key === 'KEY_DOWN') {
            dimCurrentLight('down');
        }

        // toggle selected
        if (data.key === 'KEY_OK') {
            toggleCurrentLight();
        }
    }
});

const UDP_SERVER_ADDR = '0.0.0.0'
irRemoteSocket.bind(42002, UDP_SERVER_ADDR);

export {server};
