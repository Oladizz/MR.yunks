import os
import asyncio
from dotenv import load_dotenv
from telegram.ext import Application, CommandHandler, ChatMemberHandler, MessageHandler, CallbackContext
import telegram
import structlog

# Initialize logging
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

# Import handlers
from moderation_bot.handlers.moderation import warn_user, kick_user, ban_user, unban_user, set_welcome_message, announce_command, toggle_cleanlinked
from moderation_bot.handlers.members import welcome_new_member
from moderation_bot.handlers.help import help_command
from moderation_bot.handlers.activity import track_activity, top_command
from moderation_bot.handlers.spam import block_other_bots, toggle_nobots, clean_linked_channel_messages
from moderation_bot.handlers.filters import add_filter, list_filters, stop_filter, stop_all_filters, apply_filters
from moderation_bot.handlers.pin import get_pinned_message, pin_message, announce_pin, perma_pin, unpin_message, unpin_all_messages, toggle_antichannelpin, prevent_channel_auto_pin
from telegram.ext import filters

async def error_handler(update: object, context: CallbackContext) -> None:
    """Log the error and handle flood control."""
    if isinstance(context.error, telegram.error.RetryAfter):
        logger.warning(
            "Flood control exceeded. Suggested retry in %s seconds. Pausing...",
            context.error.retry_after,
            update=update
        )
        await asyncio.sleep(context.error.retry_after)
        return
    
    logger.error("Exception while handling an update:", exc_info=context.error)

async def start(update, context):
    """Sends a descriptive welcome message in DMs, or a brief one in groups."""
    chat_type = update.effective_chat.type
    if chat_type == "private":
        start_message = (
            "<b>Welcome to the Mr. Yunks Moderation Bot!</b>\n\n"
            "I am here to help you moderate your Telegram groups.\n"
            "To get started, add me to your group and make me an administrator.\n\n"
            "Use the /help command to see a full list of my capabilities and how to use them.\n\n"
            "For bot administrators, you can use commands like /announce directly in this private chat."
        )
        await update.message.reply_html(start_message)
    else:
        await update.message.reply_text("Moderation bot started. Add me to a group to begin.")

def main() -> None:
    """Start the bot."""
    logger.info("Starting moderation bot...")

    # Load environment variables
    script_dir = os.path.dirname(__file__)
    dotenv_path = os.path.join(script_dir, '..', '.env')
    load_dotenv(dotenv_path)
    
    token = os.getenv("TELEGRAM_TOKEN")
    if not token:
        logger.error("TELEGRAM_TOKEN not found in environment variables!")
        return

    # Create the Application
    application = Application.builder().token(token).build()

    # Register the error handler
    application.add_error_handler(error_handler)

    # Register command handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("warn", warn_user))
    application.add_handler(CommandHandler("kick", kick_user))
    application.add_handler(CommandHandler("ban", ban_user))
    application.add_handler(CommandHandler("unban", unban_user))
    application.add_handler(CommandHandler("setwelcome", set_welcome_message))
    application.add_handler(CommandHandler("top", top_command))
    application.add_handler(CommandHandler("announce", announce_command))
    application.add_handler(CommandHandler("nobots", toggle_nobots))
    application.add_handler(CommandHandler("cleanlinked", toggle_cleanlinked))
    application.add_handler(CommandHandler("filter", add_filter))
    application.add_handler(CommandHandler("filters", list_filters))
    application.add_handler(CommandHandler("stop", stop_filter))
    application.add_handler(CommandHandler("stopall", stop_all_filters))
    application.add_handler(CommandHandler("pinned", get_pinned_message))
    application.add_handler(CommandHandler("pin", pin_message))
    application.add_handler(CommandHandler("announcepin", announce_pin))
    application.add_handler(CommandHandler("permapin", perma_pin))
    application.add_handler(CommandHandler("unpin", unpin_message))
    application.add_handler(CommandHandler("unpinall", unpin_all_messages))
    application.add_handler(CommandHandler("antichannelpin", toggle_antichannelpin))

    # Register message handlers
    application.add_handler(MessageHandler(filters.ALL, clean_linked_channel_messages), group=0)
    application.add_handler(MessageHandler(filters.ALL, prevent_channel_auto_pin), group=0)
    application.add_handler(MessageHandler(filters.ALL, block_other_bots), group=1)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, track_activity), group=2)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, apply_filters), group=3)

    # Register member update handler
    application.add_handler(ChatMemberHandler(welcome_new_member, ChatMemberHandler.CHAT_MEMBER))

    # Run the bot
    webhook_url = os.getenv("WEBHOOK_URL")
    port = int(os.getenv("PORT", "8000")) # Default to 8000 if PORT is not set

    if webhook_url:
        application.run_webhook(
            listen="0.0.0.0",
            port=port,
            url_path=token, # Telegram Bot API expects just the token as path
            webhook_url=f"{webhook_url}/{token}" # Full URL for Telegram to send updates
        )
        logger.info(f"Bot is starting with webhook on port {port}...", webhook_url=webhook_url)
    else:
        logger.info("Bot is starting with polling...")
        application.run_polling()

    logger.info("Bot has stopped.")

if __name__ == "__main__":
    main()