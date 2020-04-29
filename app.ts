import express, {Application} from 'express';
import mongoose from 'mongoose';
import config from 'config';
import * as http from "http";
import * as bodyParser from "body-parser";
import * as WebSocket from "ws";
import morgan from 'morgan';
import eiscp from 'eiscp';

import {InfoController} from "./info/InfoController";
import {onOpen, onWsClose, onWsError, onWsMessage, parseMessage} from "./sockets/WebSocketController";
import {buildEqString, getEqualizer, getStatus, getVolume} from "./sockets/ReceiverController";

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
app.use('/info', InfoController);


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
export declare let DeviceZone2Active: boolean;
export declare let DeviceZoneMainVolume: number;
export declare let DeviceZone2Volume: number;

Device = eiscp
DeviceConnected = false;
DeviceZoneMainActive = false;
DeviceZone2Active = false;
DeviceZoneMainVolume = null;
DeviceZone2Volume = null;

Device.connect(eiscp_config, () => {
    DeviceConnected = true;
});

Device.on('connect', () => {
    console.log('Successfully connected to device');
    // const old_eq = [-6, -3, -1, +1, +3, +4, +5, +6, +7];
    // const new_eq = [-7, -4, -1, +1, +3, +4, +5, +6, +7]
    Device.raw(getStatus(0));
    Device.raw(getStatus(1));

    Device.raw(getVolume(0));
    Device.raw(getVolume(1));

})

Device.on('error', (error) => {
    // console.log(error)
})

Device.on('debug', (dbg) => {
    // console.log(dbg);
})

Device.on('data', (data) => {
    // console.log(data);
    const cmd = data.command;
    const iscp_cmd = data.iscp_command as string;
    const zone = data.zone as string;

    if (cmd == 'power' || cmd == 'system-power') {
        const zone = data.zone;
        if (zone === 'main') {
            DeviceZoneMainActive = data.argument === 'on';
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

    console.log('Device Stats: ');
    console.log(` > Main  : ${DeviceZoneMainActive ? 'on ' : 'off'} -  Volume: ${DeviceZoneMainVolume}`);
    console.log(` > Zone2 : ${DeviceZone2Active ? 'on ' : 'off'} - Volume: ${DeviceZone2Volume}`);
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


export {server};
