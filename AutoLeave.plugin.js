/**
 * @name AutoLeave
 * @author sruusk
 * @authorLink https://github.com/sruusk
 * @description Automatically leaves server after voice channel disconnect
 * @website https://github.com/sruusk/BDPlugins
 * @source https://raw.githubusercontent.com/sruusk/BDPlugins/main/AutoLeave.plugin.js
 * @version 0.0.1
 */

const config = {
    info: {
        name: "AutoLeave",
        authors: [{
            name: "sruusk",
            github_username: "sruusk"
        }],
        version: "0.0.1",
        description: "Automatically leaves server after voice channel disconnect",
        github: "https://github.com/sruusk/BDPlugins",
        github_raw: "https://raw.githubusercontent.com/sruusk/BDPlugins/main/AutoLeave.plugin.js"
    },
    changelog: [

    ],
    main: "index.js",
    defaultConfig: [
        {
            type: "switch",
            id: "defaultLeave",
            name: "Leave as default",
            note: "Leave all new servers as default. If disabled you will be asked every time you join a new server.",
            value: true
        }
    ]
};

class Dummy {
    constructor(meta) {
        this.meta = meta;
        this._config = config;
    }
    start() {}
    stop() {}
}

if (!global.ZeresPluginLibrary) {
    BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${ config.info.name } is missing. Please click Download Now to install it.`, {
        confirmText: "Download Now",
        cancelText: "Cancel",
        onConfirm: () => {
            require("request").get("https://betterdiscord.app/gh-redirect?id=9", async (err, resp, body) => {
                if (err) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                if (resp.statusCode === 302) {
                    require("request").get(resp.headers.location, async (error, response, content) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), content, r));
                    });
                }
                else {
                    await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                }
            });
        }
    });
}

module.exports = !global.ZeresPluginLibrary ? Dummy : (([Plugin, Api]) => {
    const guilds = [];
    const awaitingLeave = {};

    const plugin = (Plugin, Library) => {
        const {PluginUtilities} = Library;
        let dirtyDispatch = BdApi.findModuleByProps("dispatch", "subscribe");
        if (!dirtyDispatch) console.error("[PLUGIN] AutoLeave : Dispatch Module not found")

        function ON_GUILD_JOINED(data){
            //console.log("Joined new guild", data);

            let settings = PluginUtilities.loadSettings(config.info.name);
            if(settings.defaultLeave){
                //console.log("Leaving Guild when user disconnects from voice channel", data.guild.id);
                guilds.push(data.guild.id);
                const close = BdApi.showNotice(
                    "Leaving server after voice disconnect!",
                    {
                        type: "error",
                        buttons: [
                            {
                                label: "Cancel",
                                onClick: () => {
                                    guilds.splice(guilds.indexOf(data.guild.id), 1);
                                    clearTimeout(awaitingLeave[data.guild.id]);
                                    delete awaitingLeave[data.guild.id];
                                    close();
                                }
                            }
                        ]
                    }
                );
            } else {
                const close = BdApi.showNotice(
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
                                    //console.log("Leaving Guild when user disconnects from voice channel", data.guild.id);
                                    guilds.push(data.guild.id);
                                    close();
                                }
                            }
                        ],
                        timeout: 10000
                    }
                );
            }
        }
        function ON_VOICE_STATE_UPDATE(data){
            //console.log("VOICE_STATE_UPDATE", data);
            if(!data?.voiceStates?.length) return;
            const { channelId, guildId } = data?.voiceStates[0];
            if(!channelId) { // User left voice channel
                if(guilds.includes(guildId)){
                    //console.log("User left voice channel in watched guild - leaving guild in 5 seconds");
                    awaitingLeave[guildId] = setTimeout(() => {
                        //console.log("Leaving guild", guildId);
                        BdApi.findModuleByProps("leaveGuild").leaveGuild(guildId);
                        guilds.splice(guilds.indexOf(guildId), 1);
                        delete awaitingLeave[guildId];
                    }, 5000);
                }
            } else { // User joined voice channel
                if(awaitingLeave[guildId]){
                    //console.log("User joined voice channel in watched guild before leaving guild. Cancelling leave.");
                    clearTimeout(awaitingLeave[guildId]);
                    delete awaitingLeave[guildId];
                }
            }
        }

        return class AutoLeave extends Plugin {
            onStart() {
                dirtyDispatch.subscribe("GUILD_CREATE", ON_GUILD_JOINED);
                dirtyDispatch.subscribe("VOICE_STATE_UPDATES", ON_VOICE_STATE_UPDATE);
            }

            onStop() {
                dirtyDispatch.unsubscribe("GUILD_CREATE", ON_GUILD_JOINED);
                dirtyDispatch.unsubscribe("VOICE_STATE_UPDATES", ON_VOICE_STATE_UPDATE);
            }

            getSettingsPanel() {
                const panel = this.buildSettingsPanel();
                return panel.getElement();
            }
        };

    };
    return plugin(Plugin, Api);
})(global.ZeresPluginLibrary.buildPlugin(config));
