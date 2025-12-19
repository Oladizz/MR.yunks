import structlog
from telegram import Update
from telegram.ext import CallbackContext
from telegram.constants import ChatAction
from .moderation import _is_user_admin # Assuming _is_user_admin is in moderation.py

logger = structlog.get_logger(__name__)

async def add_filter(update: Update, context: CallbackContext) -> None:
    """Adds a new filter to the chat."""
    chat_id = update.effective_chat.id
    if not await _is_user_admin(update, context):
        await update.message.reply_text("You are not authorized to add filters.")
        return

    if not context.args or len(context.args) < 2:
        await update.message.reply_text("Usage: /filter <trigger> <reply>")
        return

    trigger = context.args[0].lower()
    reply = " ".join(context.args[1:])

    if 'filters' not in context.chat_data:
        context.chat_data['filters'] = {}

    context.chat_data['filters'][trigger] = reply
    await update.message.reply_text(f"✅ Filter '{trigger}' added.")
    logger.info("Filter added", chat_id=chat_id, trigger=trigger)

async def list_filters(update: Update, context: CallbackContext) -> None:
    """Lists all active filters in the chat."""
    chat_id = update.effective_chat.id
    filters_data = context.chat_data.get('filters', {})

    if not filters_data:
        await update.message.reply_text("No active filters in this chat.")
        return

    message = "Active Filters:\n"
    for trigger, reply in filters_data.items():
        message += f"- Trigger: `{trigger}` -> Reply: `{reply}`\n"
    
    await update.message.reply_text(message)
    logger.info("Filters listed", chat_id=chat_id)

async def stop_filter(update: Update, context: CallbackContext) -> None:
    """Stops a specific filter."""
    chat_id = update.effective_chat.id
    if not await _is_user_admin(update, context):
        await update.message.reply_text("You are not authorized to stop filters.")
        return

    if not context.args:
        await update.message.reply_text("Usage: /stop <trigger>")
        return

    trigger = context.args[0].lower()
    filters_data = context.chat_data.get('filters', {})

    if trigger in filters_data:
        del filters_data[trigger]
        await update.message.reply_text(f"✅ Filter '{trigger}' stopped.")
        logger.info("Filter stopped", chat_id=chat_id, trigger=trigger)
    else:
        await update.message.reply_text(f"Filter '{trigger}' not found.")

async def stop_all_filters(update: Update, context: CallbackContext) -> None:
    """Stops all filters in the current chat."""
    chat_id = update.effective_chat.id
    if not await _is_user_admin(update, context):
        await update.message.reply_text("You are not authorized to stop all filters.")
        return

    if 'filters' in context.chat_data:
        del context.chat_data['filters']
        await update.message.reply_text("✅ All filters stopped for this chat.")
        logger.info("All filters stopped", chat_id=chat_id)
    else:
        await update.message.reply_text("No active filters to stop in this chat.")

async def apply_filters(update: Update, context: CallbackContext) -> None:
    """Applies active filters to incoming messages."""
    if not update.message or not update.message.text:
        return

    chat_id = update.effective_chat.id
    message_text = update.message.text.lower()
    filters_data = context.chat_data.get('filters', {})

    for trigger, reply in filters_data.items():
        if trigger in message_text:
            await update.effective_chat.send_action(ChatAction.TYPING)
            await update.message.reply_text(reply)
            logger.info("Filter applied", chat_id=chat_id, trigger=trigger)
            return # Only apply one filter per message
