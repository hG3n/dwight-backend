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
import {setLightState, setPlugState, setZoneState} from "./hue/HueController";
import * as dgram from "dgram";
import {SocketOptions} from "dgram";
import * as net from "net";


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
 * Remote Socket
 */
const BLE_UDP_SERVER_PORT = 42002;
const UDP_SERVER_ADDR = '0.0.0.0'
const bluetoothRemoteSocket = dgram.createSocket('udp4');
let last_received = '';
const light_mapping = [
    {
        id: 1,
        type: 'scene',
        name: 'Lights'
    },
    {
        id: 2,
        type: 'light',
        name: 'Desk Corner'
    },
    {
        id: 3,
        type: 'light',
        name: 'Bed R'
    },
    {
        id: 4,
        type: 'light',
        name: 'Door'
    },
]

bluetoothRemoteSocket.on('listening', () => {
    const address = bluetoothRemoteSocket.address() as any;
    console.log(`UDP server listening on: ${address.address}:${address.port}`);
});

bluetoothRemoteSocket.on("connect", () => {
    console.log('A client has connected');
})

bluetoothRemoteSocket.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});

bluetoothRemoteSocket.on('message', (msg, rinfo) => {
    const msg_str = msg.toString('utf-8');
    if (msg_str.length > 1) {
        if (msg_str !== last_received) {
            const id = +msg_str[0];
            const state = +msg_str[1];
            const light = light_mapping.find((el) => el.id === id)
            last_received = msg_str;
            switch (light.type) {
                case 'light':
                    setLightState(light.name, state === 1);
                    break;
                case 'scene':
                    setZoneState(light.name, state === 1);
                    break;
            }
        }
    }
});

bluetoothRemoteSocket.bind(BLE_UDP_SERVER_PORT, UDP_SERVER_ADDR);

/**
 * IR REMOTE SOCKET
 */
const irRemoteSocket = dgram.createSocket('udp4');
let last = '';
bluetoothRemoteSocket.on('listening', () => {
    const address = bluetoothRemoteSocket.address() as any;
    console.log(`UDP server listening on: ${address.address}:${address.port}`);
});

bluetoothRemoteSocket.on("connect", () => {
    console.log('A client has connected');
})

bluetoothRemoteSocket.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});

bluetoothRemoteSocket.on('message', (msg, rinfo) => {
    console.log('message received', msg);
});

bluetoothRemoteSocket.bind(42003, UDP_SERVER_ADDR);

export {server};
