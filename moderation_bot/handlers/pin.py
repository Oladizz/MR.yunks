import structlog
from telegram import Update, MessageEntity, Chat
from telegram.ext import CallbackContext
from telegram.constants import ChatAction
from .moderation import _is_user_admin # Assuming _is_user_admin is in moderation.py

logger = structlog.get_logger(__name__)

async def get_pinned_message(update: Update, context: CallbackContext) -> None:
    """Fetches and displays the current pinned message."""
    chat_id = update.effective_chat.id
    try:
        chat = await context.bot.get_chat(chat_id)
        if chat.pinned_message:
            await update.message.reply_text(f"📌 Current Pinned Message:\n\n{chat.pinned_message.text}", quote=True)
        else:
            await update.message.reply_text("There is no message currently pinned in this chat.")
    except Exception as e:
        logger.error("Error getting pinned message", chat_id=chat_id, error=e)
        await update.message.reply_text("An error occurred while fetching the pinned message.")

async def pin_message(update: Update, context: CallbackContext) -> None:
    """Pins a replied-to message or a custom message."""
    chat_id = update.effective_chat.id
    if not await _is_user_admin(update, context):
        await update.message.reply_text("You are not authorized to pin messages.")
        return

    if not update.message.reply_to_message and not context.args:
        await update.message.reply_text("Usage: Reply to a message with /pin, or use /pin <text> to pin a new message.")
        return

    message_to_pin_id = None
    text_to_pin = None
    disable_notification = True

    if update.message.reply_to_message:
        message_to_pin_id = update.message.reply_to_message.message_id
        if context.args:
            # Check for notification options
            for arg in context.args:
                if arg.lower() in ['loud', 'notify']:
                    disable_notification = False
                    break
    elif context.args:
        text_to_pin = " ".join(context.args)
        # Check for notification options in args
        if 'loud' in [arg.lower() for arg in context.args] or 'notify' in [arg.lower() for arg in context.args]:
            disable_notification = False
            # Remove loud/notify from text if it was meant as an option
            text_to_pin = " ".join([arg for arg in context.args if arg.lower() not in ['loud', 'notify']])

    try:
        if message_to_pin_id:
            await context.bot.pin_chat_message(chat_id, message_to_pin_id, disable_notification=disable_notification)
            await update.message.reply_text("✅ Message pinned!", quote=True)
            logger.info("Message pinned", chat_id=chat_id, message_id=message_to_pin_id)
        elif text_to_pin:
            sent_message = await context.bot.send_message(chat_id, text_to_pin, parse_mode='HTML')
            await context.bot.pin_chat_message(chat_id, sent_message.message_id, disable_notification=disable_notification)
            await update.message.reply_text("✅ Custom message pinned!", quote=True)
            logger.info("Custom message pinned", chat_id=chat_id, message_id=sent_message.message_id)
    except Exception as e:
        logger.error("Error pinning message", chat_id=chat_id, error=e)
        await update.message.reply_text(f"An error occurred while pinning the message. Make sure I have pin permissions. Error: {e}")

async def announce_pin(update: Update, context: CallbackContext) -> None:
    """Admin command to send an announcement and pin it."""
    chat_id = update.effective_chat.id
    if not await _is_user_admin(update, context):
        await update.message.reply_text("You are not authorized to make announcements and pin them.")
        return

    if not context.args:
        await update.message.reply_text("Usage: /announcepin <text>")
        return

    announcement_text = " ".join(context.args)
    try:
        sent_message = await context.bot.send_message(chat_id, announcement_text, parse_mode='HTML')
        await context.bot.pin_chat_message(chat_id, sent_message.message_id, disable_notification=False) # Announce implies notification
        await update.message.reply_text("✅ Announcement sent and pinned!", quote=True)
        logger.info("Announcement pinned", chat_id=chat_id, message_id=sent_message.message_id)
    except Exception as e:
        logger.error("Error announcing and pinning message", chat_id=chat_id, error=e)
        await update.message.reply_text(f"An error occurred while announcing and pinning the message. Make sure I have pin permissions. Error: {e}")

async def perma_pin(update: Update, context: CallbackContext) -> None:
    """Pins a custom message through the bot. This message can contain markdown, buttons, etc."""
    chat_id = update.effective_chat.id
    if not await _is_user_admin(update, context):
        await update.message.reply_text("You are not authorized to perma-pin messages.")
        return

    if not context.args:
        await update.message.reply_text("Usage: /permapin <text>. Message can contain HTML for formatting.")
        return

    custom_text = " ".join(context.args)
    try:
        sent_message = await context.bot.send_message(chat_id, custom_text, parse_mode='HTML', disable_web_page_preview=True)
        await context.bot.pin_chat_message(chat_id, sent_message.message_id, disable_notification=True)
        await update.message.reply_text("✅ Custom message perma-pinned!", quote=True)
        logger.info("Custom message perma-pinned", chat_id=chat_id, message_id=sent_message.message_id)
    except Exception as e:
        logger.error("Error perma-pinning message", chat_id=chat_id, error=e)
        await update.message.reply_text(f"An error occurred while perma-pinning the message. Make sure I have pin permissions. Error: {e}")

async def unpin_message(update: Update, context: CallbackContext) -> None:
    """Unpins the current pinned message or a replied-to message."""
    chat_id = update.effective_chat.id
    if not await _is_user_admin(update, context):
        await update.message.reply_text("You are not authorized to unpin messages.")
        return

    message_to_unpin_id = None
    if update.message.reply_to_message:
        message_to_unpin_id = update.message.reply_to_message.message_id
    
    try:
        if message_to_unpin_id:
            await context.bot.unpin_chat_message(chat_id, message_to_unpin_id)
            await update.message.reply_text("✅ Message unpinned!", quote=True)
            logger.info("Specific message unpinned", chat_id=chat_id, message_id=message_to_unpin_id)
        else:
            await context.bot.unpin_chat_message(chat_id) # Unpins the last pinned message
            await update.message.reply_text("✅ Last pinned message unpinned!", quote=True)
            logger.info("Last pinned message unpinned", chat_id=chat_id)
    except Exception as e:
        logger.error("Error unpinning message", chat_id=chat_id, error=e)
        await update.message.reply_text(f"An error occurred while unpinning the message. Error: {e}")

async def unpin_all_messages(update: Update, context: CallbackContext) -> None:
    """Unpins all pinned messages in the chat."""
    chat_id = update.effective_chat.id
    if not await _is_user_admin(update, context):
        await update.message.reply_text("You are not authorized to unpin all messages.")
        return

    try:
        await context.bot.unpin_all_chat_messages(chat_id)
        await update.message.reply_text("✅ All messages unpinned!", quote=True)
        logger.info("All messages unpinned", chat_id=chat_id)
    except Exception as e:
        logger.error("Error unpinning all messages", chat_id=chat_id, error=e)
        await update.message.reply_text(f"An error occurred while unpinning all messages. Error: {e}")

async def toggle_antichannelpin(update: Update, context: CallbackContext) -> None:
    """Toggles the 'antichannelpin' feature or shows its status."""
    if not await _is_user_admin(update, context):
        await update.message.reply_text("You are not authorized to manage anti-channel pin settings.")
        return

    chat_id = update.effective_chat.id
    current_state = context.chat_data.get('antichannelpin_enabled', False)

    if context.args:
        arg = context.args[0].lower()
        if arg in ['yes', 'on']:
            new_state = True
        elif arg in ['no', 'off']:
            new_state = False
        else:
            await update.message.reply_text("Invalid argument. Use 'yes', 'no', 'on', or 'off'.")
            return
        
        context.chat_data['antichannelpin_enabled'] = new_state
        status_message = "✅ Anti-channel pin is now **enabled**." if new_state else "❌ Anti-channel pin is now **disabled**."
        await update.message.reply_html(status_message)
        logger.info("Antichannelpin toggled", admin=update.effective_user.id, chat_id=chat_id, enabled=new_state)
    else:
        status_message = "✅ Anti-channel pin is currently **enabled**." if current_state else "❌ Anti-channel pin is currently **disabled**."
        await update.message.reply_html(status_message)

async def prevent_channel_auto_pin(update: Update, context: CallbackContext) -> None:
    """Prevents automatic pinning of messages from linked channels if 'antichannelpin' is enabled."""
    if not update.message:
        return

    chat_id = update.effective_chat.id
    
    # Check if antichannelpin is enabled for this chat
    if not context.chat_data.get('antichannelpin_enabled', False):
        return

    # Check if the message is an automatic forward from a channel and it's pinned
    if update.message.is_automatic_forward and update.message.from_chat and update.message.from_chat.type == Chat.CHANNEL:
        try:
            # Telegram Bot API does not provide a direct way to check if a specific message
            # was auto-pinned. The common strategy is to simply unpin it if it's new
            # and from a linked channel, assuming it was auto-pinned.
            await context.bot.unpin_chat_message(chat_id, update.message.message_id)
            logger.info(
                "Unpinned automatically forwarded message from linked channel",
                chat_id=chat_id,
                message_id=update.message.message_id
            )
        except Exception as e:
            logger.error(
                "Failed to unpin automatically forwarded message from linked channel",
                error=e,
                chat_id=chat_id,
                message_id=update.message.message_id
            )
