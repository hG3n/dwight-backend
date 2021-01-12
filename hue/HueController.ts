import {loadavg} from "os";

const v3 = require('node-hue-api').v3
    , discovery = v3.discovery
    , hueApi = v3.api
    , GroupLightState = v3.lightStates.GroupLightState;


const appName = 'dwight';
const deviceName = 'example-code';

export const discoverBridge = async () => {
    const discoveryResults = await discovery.nupnpSearch();

    if (discoveryResults.length === 0) {
        console.error('Failed to resolve any Hue Bridges');
        return null;
    } else {
        // Ignoring that you could have more than one Hue Bridge on a network as this is unlikely in 99.9% of users situations
        return discoveryResults[0].ipaddress;
    }
}

export const discoverAndCreateUser = async () => {
    const ipAddress = await discoverBridge();

    // Create an unauthenticated instance of the Hue API so that we can create a new user
    const unauthenticatedApi = await hueApi.createLocal(ipAddress).connect();

    let createdUser;
    try {
        createdUser = await unauthenticatedApi.users.createUser(appName, deviceName);
        console.log('*******************************************************************************\n');
        console.log('User has been created on the Hue Bridge. The following username can be used to\n' +
            'authenticate with the Bridge and provide full local access to the Hue Bridge.\n' +
            'YOU SHOULD TREAT THIS LIKE A PASSWORD\n');
        console.log(`Hue Bridge User: ${createdUser.username}`);
        console.log(`Hue Bridge User Client Key: ${createdUser.clientkey}`);
        console.log('*******************************************************************************\n');

        // Create a new API instance that is authenticated with the new user we created
        const authenticatedApi = await hueApi.createLocal(ipAddress).connect(createdUser.username);

        // Do something with the authenticated user/api
        const bridgeConfig = await authenticatedApi.configuration.getConfiguration();
        console.log(`Connected to Hue Bridge: ${bridgeConfig.name} :: ${bridgeConfig.ipaddress}`);

    } catch (err) {
        if (err.getHueErrorType() === 101) {
            console.error('The Link button on the bridge was not pressed. Please press the Link button and try again.');
        } else {
            console.error(`Unexpected Error: ${err.message}`);
        }
    }
}

const SUBWOOFER_PLUG_NAME = 'SubwooferPlug';
const hueCredentials = {
    user: 'Xt64koMaoe4fdzddiZjov3s2uLUOCkRpolrRXB7A',
    key: 'D121EFB75D5968C25C56EBD527B27EBE'
};

let HUE_SESSION = null;

const getSession = () => {
    if (HUE_SESSION === null) {
        return v3.discovery.nupnpSearch()
            .then((searchResults) => {
                const host = searchResults[0].ipaddress;
                const session = v3.api.createLocal(host).connect(hueCredentials.user);
                HUE_SESSION = session;
                return session;
            });
    } else {
        return Promise.resolve(HUE_SESSION);
    }
}

const getAvailableHueDevices = () => {
    return getSession().then(async api =>
        Promise.resolve({api, lights: await api.lights.getAll()})
    );
}

/// Meta calls
const getAllAvailableGroups = () => {
    return getSession().then(async api =>
        Promise.resolve({api, lights: await api.groups.getAll()})
    );
}

const getGroupByName = (name: string) => {
    return getSession().then(async api =>
        Promise.resolve({api, lights: await api.groups.getGroupByName(name)})
    );
}

const getScenesByName = (name: string) => {
    return getSession().then(async api =>
        Promise.resolve({api, lights: await api.scenes.getSceneByName(name)})
    );
};


export const setPlugState = (state: boolean) => {
    return getAvailableHueDevices()
        .then(async (results) => {
            const api = results.api;
            const plug = results.lights.find(el => el.name === SUBWOOFER_PLUG_NAME);
            return Promise.resolve({
                api, plug, prevOperationSuccess: await api.lights.setLightState(plug.id, {on: state})
            });
        })
        .then(async (data) => {
            return data.api.lights.getLightState(data.plug.id);
        })
}

export const setZoneState = (zone: string, state: boolean) => {
    return getAllAvailableGroups()
        .then(async (results) => {
            const api = results.api;
            const scene = results.lights.find(el => el.name === zone);
            return Promise.resolve({
                api, scene, prevOperationSuccess: await api.groups.setGroupState(scene.id, {on: state})
            });
        })
        .then(async (data) => {
            return data.api.groups.getGroupState(data.scene.id);
        })
}

export const setLightState = (name: string, state: boolean) => {
    return getAvailableHueDevices()
        .then(async (results) => {
            const api = results.api;
            const light = results.lights.find(el => el.name === name);
            return Promise.resolve({
                api, light, prevOperationSuccess: await api.lights.setLightState(light.id, {on: state})
            });
        })
        .then(async (data) => {
            return data.api.lights.getLightState(data.light.id);
        })
}

export const setLightStateAsync = async (name: string, state: boolean) => {
    const session = await getSession();
    const devices = await getAvailableHueDevices();
    const light = devices.lights.find(el => el.name === name);
    const success = await session.lights.setLightState(light.id, {on: state});
    if (success) {
        return session.lights.getLightState(light.id);
    }
}

export const turnAllZonesOff = async () => {
    const devices = await getAvailableHueDevices();
    return await devices.lights.map((dev) => {
        return setLightStateAsync(dev.name, false);
    });
}

export const toggleSceneForGroup = async (group: string, scene: string) => {
    const found_scenes = await getScenesByName(scene);
    const found_group = await getGroupByName(group);
    const light_state = new GroupLightState().scene(found_scenes.lights[0].id);
    const api = await getSession();
    await api.groups.setGroupState(found_group.lights[0].id, light_state);
}

// Invoke the discovery and create user code
