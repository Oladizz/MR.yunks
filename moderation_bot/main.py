import os
import asyncio
from dotenv import load_dotenv
from telegram.ext import Application, CommandHandler, ChatMemberHandler
import structlog

# ... (logging configuration) ...
logger = structlog.get_logger()

from .handlers.moderation import warn_user, kick_user, ban_user, unban_user
from .handlers.members import welcome_new_member

# ... (start function) ...

def main() -> None:
    """Start the bot."""
    logger.info("Starting moderation bot...")

    # Load environment variables
    # Explicitly define the path to the .env file
    script_dir = os.path.dirname(__file__)
    dotenv_path = os.path.join(script_dir, '..', '.env')
    load_dotenv(dotenv_path)
    
    token = os.getenv("TELEGRAM_TOKEN")
    if not token:
        logger.error("TELEGRAM_TOKEN not found in environment variables!")
        return
    # Create the Application
    application = Application.builder().token(token).build()

    # Register command handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("warn", warn_user))
    application.add_handler(CommandHandler("kick", kick_user))
    application.add_handler(CommandHandler("ban", ban_user))
    application.add_handler(CommandHandler("unban", unban_user))

    # Register member update handler
    application.add_handler(ChatMemberHandler(welcome_new_member, ChatMemberHandler.CHAT_MEMBER))

    # Run the bot
    logger.info("Bot is starting with polling...")
    application.run_polling()

    logger.info("Bot has stopped.")

if __name__ == "__main__":
    main()
