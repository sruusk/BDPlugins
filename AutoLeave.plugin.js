/**
 * @name AutoLeave
 * @author sruusk
 * @authorLink https://github.com/sruusk
 * @description Automatically leaves server after voice channel disconnect
 * @website https://github.com/sruusk/BDPlugins
 * @source https://raw.githubusercontent.com/sruusk/BDPlugins/main/AutoLeave.plugin.js
 * @version 0.0.1
 */

const settings = BdApi.Data.load("AutoLeave", "settings") || {
    defaultLeave: true,
    debug: false
};


let guild;
let awaitingLeave;
let close;

//const dirtyDispatch = BdApi.findModuleByProps("dispatch", "subscribe");
const dirtyDispatch = BdApi.Webpack.getModule((e) => e.dispatch && e.subscribe);
if (!dirtyDispatch) console.error("[PLUGIN] AutoLeave : Dispatch Module not found");

const leaveGuild = BdApi.Webpack.getModule((e) => e.leaveGuild)?.leaveGuild;
if(!leaveGuild) console.error("[PLUGIN] AutoLeave : leaveGuild not found");

const currentUserId = BdApi.Webpack.getModule(e => e.getCurrentUser)?.getCurrentUser()?.id;
if(!currentUserId) console.error("[PLUGIN] AutoLeave : Current User ID not found");

const setSetting = (id, value) => {
    settings[id] = value;
    BdApi.Data.save("AutoLeave", "settings", settings);
}

const ON_GUILD_JOINED = data => {
    if(settings.debug) console.log("Joined new guild", data);
    const joined = new Date(data.guild.joined_at);
    if(joined.getTime() < Date.now() - 30000) return; // Ignore guilds joined more than 30 seconds ago
    if(close) close(); // Close any open notices
    if(settings.defaultLeave){
        if(settings.debug) console.log("Leaving Guild when user disconnects from voice channel", data.guild.id);
        guild = data.guild.id;
        close = BdApi.UI.showNotice(
            "Leaving server after voice disconnect!",
            {
                type: "warning",
                buttons: [
                    {
                        label: "Cancel",
                        onClick: () => {
                            guild = undefined;
                            clearTimeout(awaitingLeave);
                            awaitingLeave = undefined;
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
                            if(settings.debug) console.log("Leaving Guild when user disconnects from voice channel", data.guild.id);
                            guild = data.guild.id;
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
    if(settings.debug) console.log("VOICE_STATE_UPDATE", data);
    if(!data?.voiceStates?.length) return;
    const { userId, channelId, guildId } = data?.voiceStates[0];
    if(!channelId && userId === currentUserId) { // User left voice channel
        if(settings.debug) console.log("User left voice channel", guildId);
        if(guild === guildId){
            if(settings.debug) console.log("User left voice channel in watched guild - leaving guild in 5 seconds");
            BdApi.UI.showToast("Leaving server in 5 seconds", {type: "success"});
            awaitingLeave = setTimeout(() => {
                if(settings.debug) console.log("Leaving guild", guildId);
                //BdApi.findModuleByProps("leaveGuild").leaveGuild(guildId);
                leaveGuild(guildId);
                guild = undefined;
                awaitingLeave = undefined;
                if(close) close();
            }, 5000);
        }
    } else { // User joined voice channel
        if(awaitingLeave){
            if(settings.debug) console.log("User joined voice channel in watched guild before leaving guild. Cancelling leave.");
            clearTimeout(awaitingLeave);
            awaitingLeave = undefined;
        }
    }
}

const createSwitch = (settingId, labelText) => {
    // Create a container for the switch and label
    const container = document.createElement("div");
    container.style = "display: flex; align-items: center; justify-content: space-between;" +
        " margin-bottom: 10px; border-bottom: 1px solid #2f3136; padding-bottom: 10px;";

    // Create the label for the switch
    const label = document.createElement("label");
    label.innerText = labelText;
    label.style = "margin-left: 10px; color: white; font-size: 16px; font-weight: 500;";
    container.appendChild(label);

    // Clone the switch element from BetterDiscord
    const switchElement = document.querySelector(".bd-switch").cloneNode(true);
    switchElement.classList.remove("bd-switch-checked");
    switchElement.querySelector("input").checked = settings[settingId];
    switchElement.querySelector("input").addEventListener("change", () => {
        setSetting(settingId, switchElement.querySelector("input").checked);
    });
    container.appendChild(switchElement);

    return container;
}

module.exports = meta => ({
    start() {
        if(settings.debug) console.log("AutoLeave started", meta);
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
        container.appendChild(createSwitch("debug", "Print debug logs to console"));
        return container;
    }
});
