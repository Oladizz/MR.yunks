import os
import structlog
from telegram import Update
from telegram.ext import CallbackContext

from .moderation import _is_user_admin

logger = structlog.get_logger(__name__)

async def block_other_bots(update: Update, context: CallbackContext) -> None:
    """Deletes messages sent by other bots if the /nobots feature is enabled."""
    if not context.chat_data.get('nobots_enabled', False):
        return

    if update.effective_user and update.effective_user.is_bot:
        if update.effective_user.id != context.bot.id:
            try:
                await update.message.delete()
                logger.info(
                    "Deleted a message from another bot",
                    bot_id=update.effective_user.id,
                    chat_id=update.effective_chat.id
                )
            except Exception as e:
                logger.error("Failed to delete bot message", error=e)

async def toggle_nobots(update: Update, context: CallbackContext) -> None:
    """Toggles the anti-bot message feature for the chat."""
    if not await _is_user_admin(update, context):
        await update.message.reply_text("This command can only be used by admins.")
        return

    # Get the current state, default to False if not set
    current_state = context.chat_data.get('nobots_enabled', False)
    
    # Toggle the state
    new_state = not current_state
    context.chat_data['nobots_enabled'] = new_state

    status_message = "✅ Anti-bot protection is now **enabled**." if new_state else "❌ Anti-bot protection is now **disabled**."
    await update.message.reply_html(status_message)
    logger.info("Anti-bot protection toggled", admin=update.effective_user.id, chat_id=update.effective_chat.id, enabled=new_state)
