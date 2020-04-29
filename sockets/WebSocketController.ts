import * as WebSocket from "ws";
import {Device, DeviceZone2Active, DeviceZoneMainActive} from "../app";
import {decreaseVolume, getEqualizer, getStatus, getVolume, increaseVolume, power} from "./ReceiverController";


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
    switch (msg.method) {
        case Methods.get:
            handleGet(socket, msg);
            break;
        case Methods.set:
            handleSet(msg);
            break;
    }
};

// -------------------------------------------------------------
// Functions
// -------------------------------------------------------------
const handleGet = (socket, msg: WsMessage): void => {
    switch (msg.fct) {
        case Functions.power:
            Device.raw(getStatus(msg.zone));
            break;
        case Functions.volume:
            Device.raw(getVolume(msg.zone));
            break;
        case Functions.equalizer:
            console.log(getEqualizer());
            Device.raw('ACEQSTN');
            break;
        case Functions.stats:
            socket.send(JSON.stringify({main: DeviceZoneMainActive, zone2: DeviceZone2Active}))
            break;
        default:
            console.log('unhandled function');
    }
}

const handleSet = (msg: WsMessage): void => {
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
            break;
        case Functions.volume:
            if (msg.value > 0) {
                Device.raw(increaseVolume(msg.zone, msg.value === 2))
            } else {
                Device.raw(decreaseVolume(msg.zone, msg.value === -2))
            }
            break;
        case Functions.equalizer:
            if (DeviceZoneMainActive)
                Device.raw()
            break;

    }
}

enum Methods {
    get = 'g',
    set = 's',
}

enum Functions {
    power = 'pwr',
    volume = 'vol',
    equalizer = 'eq',
    stats = 'st'
}

export interface WsMessage {
    method: Methods
    zone: 0 | 1;
    fct: Functions;
    value: number | string
}
