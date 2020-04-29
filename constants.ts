export const constants = {
    sources: [],
    commands: {
        volume: {
            get: 'amixer get Speaker',
            set: 'amixer set Speaker',
            toggle: 'amixer set Speaker toggle'
        },
        equalizer: {
            get: 'sudo -u raspotify amixer -D equal sget',
            set: 'sudo -u raspotify amixer -D equal sset'
        },
        system: {
            restart: 'sudo service raspotify restart',
            status: 'sudo service raspotify status'
        }
    },
    equalizer: {
        frequencies: [
            {
                name: "31 Hz",
                property: "00. 31 Hz",
                position: 0
            },
            {
                name: "63 Hz",
                property: "01. 63 Hz",
                position: 1
            },
            {
                name: "125 Hz",
                property: "02. 125 Hz",
                position: 2
            },
            {
                name: "250 Hz",
                property: "03. 250 Hz",
                position: 3
            },
            {
                name: "500 Hz",
                property: "04. 500 Hz",
                position: 4
            },
            {
                name: "1 kHz",
                property: "05. 1 kHz",
                position: 5
            },
            {
                name: "2 kHz",
                property: "06. 2 kHz",
                position: 6
            },
            {
                name: "4 kHz",
                property: "07. 4 kHz",
                position: 7
            },
            {
                name: "8 kHz",
                property: "08. 8 kHz",
                position: 8
            },
            {
                name: "16 kHz",
                property: "09. 16 kHz",
                position: 9
            },
        ]
    }
};

