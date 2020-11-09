import * as WebSocket from "ws";
import {Device, DeviceZone2Active, DeviceZone2Volume, DeviceZoneMainActive, DeviceZoneMainMuted, DeviceZoneMainVolume} from "../app";
import {
    buildEqString,
    decreaseVolume,
    getEqualizer,
    getOverallStatus,
    getStatus,
    getVolume,
    increaseVolume, listeningMode, mute,
    power, volume
} from "./ReceiverController";
import {getMsg} from "../lib/Util";


export const parseMessage = (msg_string: string): WsMessage => {
    return JSON.parse(msg_string) as WsMessage;
}

export const onOpen = () => {
    console.log('Connection opened');
};

export const onWsError = (error) => {
    console.log('error', error);
};

export const onWsClose = (code: number, reason: string) => {
    console.log(`Closed with code: ${code}: \n ${reason}`);
};

export const onWsMessage = async (socket: WebSocket, message: string) => {
    const msg = parseMessage(message);
    // console.log('Message received: ', msg);
    switch (msg.method) {
        case Methods.get:
            handleGet(socket, msg);
            break;
        case Methods.set:
            handleSet(socket, msg);
            break;
    }
    socket.send(JSON.stringify(getMsg(true, 'status', getOverallStatus())))
};

// -------------------------------------------------------------
// Functions
// -------------------------------------------------------------
const handleGet = (socket: WebSocket, msg: WsMessage): void => {
    switch (msg.fct) {
        case Functions.equalizer:
            // console.log(getEqualizer());
            Device.raw('ACEQSTN');
            break;
        case Functions.stats:
            socket.send(JSON.stringify(getMsg(true, 'status', getOverallStatus())))
            break;
        default:
            console.log('unhandled function');
    }
}

const handleSet = (socket: WebSocket, msg: WsMessage): void => {
    switch (msg.fct) {
        case Functions.power:
            if (msg.value === 2) {
                if (msg.zone == 0)
                    Device.raw(power(msg.zone, DeviceZoneMainActive ? 0 : 1))
                else {
                    Device.raw(power(msg.zone, DeviceZone2Active ? 0 : 1))
                }
            } else {
                Device.raw(power(msg.zone, msg.value));
            }
            socket.send(JSON.stringify(getMsg(true, 'status', getOverallStatus())))
            break;
        case Functions.volume:
            if (msg.value > 0) {
                Device.raw(increaseVolume(msg.zone, msg.value === 2))
            } else {
                Device.raw(decreaseVolume(msg.zone, msg.value === -2))
            }
            break;
        case Functions.equalizer:
            if (DeviceZoneMainActive) {
                const old_eq = [-6, -3, -1, +1, +3, +4, +5, +6, +7];
                // const new_eq = [-7, -4, -1, +1, +3, +4, +5, +6, +7]
                const eqstr = buildEqString(old_eq)
                Device.raw(`ACE${eqstr}`)
            }
            break;
        case Functions.listeningMode:
            if (DeviceZoneMainActive) {
                if (msg.value === 'auto')
                    Device.raw(listeningMode(ListeningModes.auto))
                else if (msg.value === 'achst')
                    Device.raw(listeningMode(ListeningModes.allChannelStereo))
                else if (msg.value === 'stereo')
                    Device.raw(listeningMode(ListeningModes.stereo))
                else if (msg.value === 'dolby')
                    Device.raw(listeningMode(ListeningModes.dolby))
            }
            break;
        case Functions.directVolume:
            // convert decimal to hex first
            const value = +msg.value;
            const converted = value.toString(16);
            Device.raw(volume(msg.zone, converted));
            break;
        case Functions.mute:
            if (DeviceZoneMainMuted) {
                Device.raw(mute(msg.zone, 0));
            } else {
                Device.raw(mute(msg.zone, 1));
            }
    }
}

enum Methods {
    get = 'g',
    set = 's',
}

enum Functions {
    power = 'pwr',
    volume = 'vol',
    directVolume = 'dvl',
    equalizer = 'eq',
    stats = 'st',
    listeningMode = 'lm',
    mute = 'mute',
}

export interface WsMessage {
    method: Methods
    zone: 0 | 1;
    fct: Functions;
    value: number | string
}

export enum ListeningModes {
    qstn = 'QSTN',
    auto = 'auto',
    stereo = 'stereo',
    dolby = 'dolby',
    allChannelStereo = 'achst'
}
