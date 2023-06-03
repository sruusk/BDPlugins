/**
 * @name AutoLeave
 * @author sruusk
 * @authorLink https://github.com/sruusk
 * @description Automatically leaves server after voice channel disconnect
 * @website https://github.com/sruusk/BDPlugins
 * @source https://raw.githubusercontent.com/sruusk/BDPlugins/main/AutoLeave.plugin.js
 * @version 0.0.1
 */

const defaultSettings = {
    defaultLeave: true
}

const guilds = [];
const awaitingLeave = {};
let close;
//const dirtyDispatch = BdApi.findModuleByProps("dispatch", "subscribe");
const dirtyDispatch = BdApi.Webpack.getModule((e) => e.dispatch && e.subscribe);
if (!dirtyDispatch) console.error("[PLUGIN] AutoLeave : Dispatch Module not found");
const leaveGuild = BdApi.Webpack.getModule((e) => e.leaveGuild)?.leaveGuild;
if(!leaveGuild) console.error("[PLUGIN] AutoLeave : leaveGuild not found");

const setSetting = (id, value) => {
    const settings = BdApi.Data.load("AutoLeave", "settings") || defaultSettings;
    settings[id] = value;
    BdApi.Data.save("AutoLeave", "settings", settings);
}

const getSetting = (id) => {
    const settings = BdApi.Data.load("AutoLeave", "settings") || defaultSettings;
    return settings[id];
}

const ON_GUILD_JOINED = data => {
    console.log("Joined new guild", data);
    if(getSetting("defaultLeave")){
        console.log("Leaving Guild when user disconnects from voice channel", data.guild.id);
        guilds.push(data.guild.id);
        close = BdApi.UI.showNotice(
            "Leaving server after voice disconnect!",
            {
                type: "warning",
                buttons: [
                    {
                        label: "Cancel",
                        onClick: () => {
                            guilds.splice(guilds.indexOf(data.guild.id), 1);
                            clearTimeout(awaitingLeave[data.guild.id]);
                            delete awaitingLeave[data.guild.id];
                            BdApi.UI.showToast("Cancelled auto leave", {type: "success"});
                            close();
                        }
                    }
                ]
            }
        );
    } else {
        close = BdApi.UI.showNotice(
            "Leave server after voice disconnect?",
            {
                type: "info",
                buttons: [
                    {
                        label: "No",
                        onClick: () => {
                            close();
                        }
                    },
                    {
                        label: "Yes",
                        onClick: () => {
                            console.log("Leaving Guild when user disconnects from voice channel", data.guild.id);
                            guilds.push(data.guild.id);
                            BdApi.UI.showToast("Leaving server after voice disconnect", {type: "success"});
                            close();
                        }
                    }
                ],
                timeout: 10000
            }
        );
    }
}

const ON_VOICE_STATE_UPDATE = data => {
    console.log("VOICE_STATE_UPDATE", data);
    if(!data?.voiceStates?.length) return;
    const { channelId, guildId } = data?.voiceStates[0];
    if(!channelId) { // User left voice channel
        if(guilds.includes(guildId)){
            console.log("User left voice channel in watched guild - leaving guild in 5 seconds");
            awaitingLeave[guildId] = setTimeout(() => {
                console.log("Leaving guild", guildId);
                //BdApi.findModuleByProps("leaveGuild").leaveGuild(guildId);
                leaveGuild(guildId);
                guilds.splice(guilds.indexOf(guildId), 1);
                delete awaitingLeave[guildId];
                if(close) close();
            }, 5000);
        }
    } else { // User joined voice channel
        if(awaitingLeave[guildId]){
            console.log("User joined voice channel in watched guild before leaving guild. Cancelling leave.");
            clearTimeout(awaitingLeave[guildId]);
            delete awaitingLeave[guildId];
        }
    }
}

const createSwitch = (settingId, labelText) => {
    // Create a container for the switch and label
    const container = document.createElement("div");
    container.style = "display: flex; align-items: center; justify-content: space-between;";

    // Create the label for the switch
    const label = document.createElement("label");
    label.innerText = labelText;
    label.style = "margin-left: 10px; color: white; font-size: 16px; font-weight: 500;";
    container.appendChild(label);

    // Clone the switch element from BetterDiscord
    const switchElement = document.querySelector(".bd-switch").cloneNode(true);
    switchElement.classList.remove("bd-switch-checked");
    switchElement.querySelector("input").checked = getSetting(settingId);
    switchElement.querySelector("input").addEventListener("change", () => {
        setSetting(settingId, switchElement.querySelector("input").checked);
    });
    container.appendChild(switchElement);

    return container;
}

module.exports = meta => ({
    start() {
        console.log("AutoLeave started", meta);
        dirtyDispatch.subscribe("GUILD_CREATE", ON_GUILD_JOINED);
        dirtyDispatch.subscribe("VOICE_STATE_UPDATES", ON_VOICE_STATE_UPDATE);
    },
    stop() {
        dirtyDispatch.unsubscribe("GUILD_CREATE", ON_GUILD_JOINED);
        dirtyDispatch.unsubscribe("VOICE_STATE_UPDATES", ON_VOICE_STATE_UPDATE);
    },
    getSettingsPanel() {
        // Create a container for the settings
        const container = document.createElement("div");
        container.style = "display: flex; flex-direction: column; width: 100%;";
        container.appendChild(createSwitch("defaultLeave", "Leave as default"));
        return container;
    }
});
