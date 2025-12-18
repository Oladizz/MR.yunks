from telegram import Update
from telegram.ext import CallbackContext
import structlog

logger = structlog.get_logger(__name__)

async def help_command(update: Update, context: CallbackContext) -> None:
    """Sends a help message with command explanations and examples."""
    help_text = (
        "<b>📜 Mr. Yunks Bot - Help Guide 📜</b>\n\n"
        "Welcome, initiate! This bot assists in moderating your chat.\n\n"
        "<b>Available Commands:</b>\n"
        "/start - Start the bot and get a welcome message.\n"
        "/help - Display this help guide.\n"
        "/warn - Reply to a user's message to warn them. "
            "Example: <code>/warn spamming links</code>\n"
        "/kick - Reply to a user's message to kick them from the chat.\n"
        "/ban - Reply to a user's message to ban them from the chat.\n"
        "/unban - Unban a user by their Telegram User ID. "
            "Example: <code>/unban 123456789</code>\n"
        "/setwelcome - Set a custom welcome message for new members. "
            "Use <code>{username}</code> as a placeholder for the new member's name. "
            "Example: <code>/setwelcome Welcome, {username}! Read the rules!</code>\n"
        "/top - Display the top 5 most active users in the chat.\n"
        "/announce - Send a message as an announcement to the configured group chat. "
            "Only available to bot administrators in a private chat with the bot. "
            "Example: <code>/announce Important: Meeting at 3 PM!</code>\n"
        "/nobots - Toggle the anti-bot protection. When enabled, messages from other bots will be deleted.\n\n"
        "<b>Note:</b> Moderation commands (/warn, /kick, /ban, /unban, /setwelcome, /nobots) "
        "can only be used by chat administrators or bot administrators configured in the server."
    )
    await update.message.reply_html(help_text)
    logger.info("Help command issued", user_id=update.effective_user.id)

