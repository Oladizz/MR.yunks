// Commands for all users
const defaultCommands = [
    { command: 'start', description: 'Welcome message' },
    { command: 'help', description: 'Show help information' },
    { command: 'prophecy', description: 'Ask the spirits a question' },
    { command: 'leaderboard', description: 'Show top XP earners' },
    { command: 'profile', description: 'Show your user profile' }, // Added profile command
    { command: 'js', description: 'Start a Shadow Game' },
    { command: 'cultclash', description: 'Start a Cult Clash game' },
    { command: 'join_clash', description: 'Join an active Cult Clash game' },
    // Add other general commands here
];

// Commands for chat administrators
const adminCommands = [
    { command: 'tagall', description: 'Tag all known members' },
    { command: 'announce', description: 'Post an announcement' },
    { command: 'announcetop', description: 'Announce top active members' },
    { command: 'settings', description: 'Open bot settings' },
    { command: 'setwelcome', description: 'Set a custom welcome message' },
    { command: 'showconfig', description: 'Show the current bot configuration' },
    { command: 'banword', description: 'Add a word to the banned list' },
    { command: 'unbanword', description: 'Remove a word from the banned list' },
    { command: 'bannedwords', description: 'List all banned words' },
    { command: 'kick', description: 'Kick a user' },
    { command: 'ban', description: 'Ban a user' },
    { command: 'unban', description: 'Unban a user by ID' },
    { command: 'mute', description: 'Mute a user' },
    { command: 'unmute', description: 'Unmute a user' },
    { command: 'warn', description: 'Warn a user' },
    { command: 'warnings', description: 'Check a user\'s warnings' },
    { command: 'add_user_to_db', description: 'Manually add user to DB' },
    { command: 'countdown', description: 'Start a countdown' },
    { command: 'awardxp', description: 'Award XP to a user' },
    { command: 'status', description: 'Show Protectron status' },
    { command: 'antispam', description: 'Toggle anti-spam filter' },
    { command: 'antispam_mode', description: 'Set anti-spam mode' },
    { command: 'noevents', description: 'Toggle join/leave msg filter' },
    { command: 'nobots', description: 'Toggle spam bot protection' },
    { command: 'nolinks', description: 'Toggle link/mention/forward filter' },
    { command: 'noforwards', description: 'Toggle forwarded msg filter' },
    { command: 'nocontacts', description: 'Toggle contact number filter' },
    { command: 'nolocations', description: 'Toggle location filter' },
    { command: 'nocommands', description: 'Toggle command filter' },
    { command: 'nohashtags', description: 'Toggle hashtag filter' },
    { command: 'antiflood', description: 'Toggle anti-flood protection' },
    { command: 'imagefilter', description: 'Toggle image filter' },
    { command: 'profanity', description: 'Toggle profanity filter' },
    { command: 'blacklist_add', description: 'Add blacklisted word' },
    { command: 'blacklist_remove', description: 'Remove blacklisted word' },
    { command: 'blacklist_clear', description: 'Clear blacklisted words' },
    { command: 'blacklist', description: 'List blacklisted words' },
    { command: 'whitelist_add', description: 'Add whitelisted domain' },
    { command: 'whitelist_remove', description: 'Remove whitelisted domain' },
    { command: 'whitelist_clear', description: 'Clear whitelisted domains' },
    { command: 'whitelist', description: 'List whitelisted domains' },
];

async function setBotCommands(bot) {

}

module.exports = { setBotCommands, defaultCommands, adminCommands };
