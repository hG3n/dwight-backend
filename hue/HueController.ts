const v3 = require('node-hue-api').v3
    , discovery = v3.discovery
    , hueApi = v3.api
    , GroupLightState = v3.lightStates.GroupLightState
    , LightState = v3.lightStates.LightState;

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

const getAllDevicesAsync = async () => {
    const s = await getSession();
    return await s.lights.getAll();
}

const getAllGroups = async () => {
    const s = await getSession();
    return s.groups.getAll();
}

const getGroupsByName = async (name: string) => {
    const s = await getSession();
    return s.groups.getGroupByName(name);
}

const getScenesByName = async (name: string) => {
    const s = await getSession();
    return s.scenes.getSceneByName(name);
};

export const setPlugState = async (state: boolean) => {
    const s = await getSession();
    const devices = await getAllDevicesAsync();
    const plug = devices.find(el => el.name === SUBWOOFER_PLUG_NAME);
    await s.lights.setLightState(plug.id, {on: state});
    return s.lights.getLightState(plug.id);
}

export const setLightState = async (name: string, state: boolean) => {
    const s = await getSession();
    const devices = await getAllDevicesAsync();
    const light = devices.find(el => el.name === name);
    const success = await s.lights.setLightState(light.id, {on: state});
    if (success) {
        return s.lights.getLightState(light.id);
    }
}

export const turnAllZonesOff = async () => {
    const devices = await getAllDevicesAsync();
    return await devices.map((dev) => {
        return setLightState(dev.name, false);
    });
}

export const toggleSceneForGroup = async (group: string, scene: string) => {
    const found_scenes = await getScenesByName(scene);
    const found_group = await getGroupsByName(group);
    const light_state = new GroupLightState().scene(found_scenes[0].id);
    const api = await getSession();
    await api.groups.setGroupState(found_group[0].id, light_state);
}


/// CYCLING
const LIGHTS = [4, 5, 8];
let CURRENT_LIGHT_IDX = 0;

const tapLight = async (id) => {
    const s = await getSession();
    await s.lights.setLightState(id, new LightState().alertShort());
}

export const cycleLights = async (direction: 'left' | 'right') => {
    let new_idx = CURRENT_LIGHT_IDX;
    if (CURRENT_LIGHT_IDX === 0) {
        if (direction === "right") {
            new_idx++;
        } else {
            new_idx = LIGHTS.length - 1;
        }
    } else if (CURRENT_LIGHT_IDX === LIGHTS.length - 1) {
        if (direction === "right") {
            new_idx = 0;
        } else {
            new_idx--;
        }
    } else {
        if (direction === "right") {
            new_idx++
        } else {
            new_idx--
        }
    }
    CURRENT_LIGHT_IDX = new_idx;
    tapLight(LIGHTS[CURRENT_LIGHT_IDX]);
}

export const dimCurrentLight = async (brightness: 'up' | 'down') => {
    const s = await getSession();
    const light_id = LIGHTS[CURRENT_LIGHT_IDX]
    await s.lights.setLightState(light_id, new LightState().bri_inc(brightness === 'up' ? 30 : -30))
}

export const toggleCurrentLight = async () => {
    const s = await getSession();
    const current_light_id = LIGHTS[CURRENT_LIGHT_IDX]
    const light = await s.lights.getLight(current_light_id);
    await s.lights.setLightState(current_light_id, {on: !light.state.on});
}
