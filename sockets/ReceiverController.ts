import {
    DeviceListeningMode,
    DeviceZone2Active,
    DeviceZone2Volume,
    DeviceZoneMainActive,
    DeviceZoneMainMuted,
    DeviceZoneMainVolume
} from "../app";
import {ListeningModes} from "./WebSocketController";

export const buildEqString = (numbers: number[]): string => {
    let s = '';
    for (const num of numbers) {
        const sign = num < 0 ? '-' : '+';
        const zero = num < 10 ? '0' : ''
        s += sign + zero + Math.abs(num).toString();
    }
    return s;
}
export const decomposeEqString = (str: string): number[] => {
    const frags = str.match(/.{1,3}/g).slice(1);
    const res = []
    for (const frag of frags) {
        res.push(+frag);
    }
    return res;
}

// ----------------------------------------------------------------
// --- receiver callbacks -----------------------------------------
// ----------------------------------------------------------------
export const power = (zone: number, value: number | string): string => {
    const cmd = zone === 0 ? 'PWR' : 'ZPW';
    const val = value === 0 ? '00' : '01';
    return `${cmd}${val}`;
}

export const listeningMode = (value: ListeningModes = ListeningModes.qstn): string => {
    const cmd = 'LMD';
    let mode = 'QSTN'
    switch (value) {
        case ListeningModes.allChannelStereo:
            mode = '0C'
            break;
        case ListeningModes.auto:
            mode = 'FF'
            break;
        case ListeningModes.stereo:
            mode = '00'
            break
        case ListeningModes.dolby:
            mode = '80'
    }
    return `${cmd}${mode}`
}

export const volume = (zone: number, value: number | string): string => {
    const cmd = zone === 0 ? 'MVL' : 'ZVL';
    return `${cmd}${value}`;
}

export const mute = (zone: number, value: number | string): string => {
    const cmd = zone === 0 ? 'AMT' : 'ZMT'
    return `${cmd}${+value === 1 ? '01' : '00'}`;
}

export const getStatus = (zone: number): string => {
    return zone === 0 ? 'PWRQSTN' : 'ZPWQSTN';
}

export const getVolume = (zone: number): string => {
    return zone === 0 ? 'MVLQSTN' : 'ZVLQSTN';
}

export const increaseVolume = (zone: number, fast: boolean): string => {
    const base_cmd = zone === 0 ? 'MVL' : 'ZVL';
    return `${base_cmd}UP${fast ? '1' : ''}`;
}

export const decreaseVolume = (zone: number, fast: boolean): string => {
    const base_cmd = zone === 0 ? 'MVL' : 'ZVL';
    return `${base_cmd}DOWN${fast ? '1' : ''}`;
}

export const getEqualizer = (): string => {
    return 'ACEQSTN';
}

export const getOverallStatus = (): any => {
    return {
        main: {
            power: DeviceZoneMainActive,
            volume: DeviceZoneMainVolume ? DeviceZoneMainVolume : 0,
            muted: DeviceZoneMainMuted
        },
        zone2: {
            power: DeviceZone2Active,
            volume: DeviceZone2Volume,
        }
    }
    // return {
    //     power: {main: DeviceZoneMainActive, zone2: DeviceZone2Active},
    //     volume: {main: DeviceZoneMainVolume, zone2: DeviceZone2Volume},
    //     mute: {main: DeviceZoneMainMuted},
    //     listeningMode: DeviceListeningMode,
    // }
}


