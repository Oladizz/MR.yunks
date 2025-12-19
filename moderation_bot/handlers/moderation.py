import os
from telegram import Update
from telegram.ext import CallbackContext
import structlog

logger = structlog.get_logger(__name__)

async def _is_user_admin(update: Update, context: CallbackContext) -> bool:
    """Helper function to check if the user is a chat admin or a bot admin."""
    ADMIN_USER_IDS = [int(i) for i in os.getenv("ADMIN_USER_IDS", "").split(',') if i]
    user_id = update.effective_user.id
    if user_id in ADMIN_USER_IDS:
        return True
    
    chat_admins = await context.bot.get_chat_administrators(update.effective_chat.id)
    return user_id in [admin.user.id for admin in chat_admins]

async def warn_user(update: Update, context: CallbackContext) -> None:
    """Warns a user. Must be a reply to the user's message."""
    # 1. Check if the command user is an admin
    if not await _is_user_admin(update, context):
        await update.message.reply_text("This command can only be used by admins.")
        return

    # 2. Check if the command is a reply
    if not update.message.reply_to_message:
        await update.message.reply_text("Please reply to a user's message to warn them.")
        return
        
    # 3. Get the user to warn and the reason
    warned_user = update.message.reply_to_message.from_user
    reason = " ".join(context.args) if context.args else "No reason specified."

    # 4. Send the warning message
    warning_message = (
        f"⚠️ {warned_user.mention_html()} has been warned.\n"
        f"<b>Reason:</b> {reason}"
    )
    await update.message.reply_html(warning_message)
    logger.info("User warned", admin=update.effective_user.id, warned_user=warned_user.id, reason=reason)

async def kick_user(update: Update, context: CallbackContext) -> None:
    """Kicks a user from the chat. Must be a reply."""
    if not await _is_user_admin(update, context):
        await update.message.reply_text("This command can only be used by admins.")
        return

    if not update.message.reply_to_message:
        await update.message.reply_text("Please reply to a user's message to kick them.")
        return

    kicked_user = update.message.reply_to_message.from_user
    chat_id = update.effective_chat.id

    try:
        await context.bot.kick_chat_member(chat_id, kicked_user.id)
        await update.message.reply_html(f"👢 {kicked_user.mention_html()} has been kicked from the chat.")
        logger.info("User kicked", admin=update.effective_user.id, kicked_user=kicked_user.id)
    except Exception as e:
        logger.error("Failed to kick user", error=e)
        await update.message.reply_text(f"Failed to kick user. Reason: {e}")

async def ban_user(update: Update, context: CallbackContext) -> None:
    """Bans a user from the chat. Must be a reply."""
    if not await _is_user_admin(update, context):
        await update.message.reply_text("This command can only be used by admins.")
        return

    if not update.message.reply_to_message:
        await update.message.reply_text("Please reply to a user's message to ban them.")
        return

    banned_user = update.message.reply_to_message.from_user
    chat_id = update.effective_chat.id

    try:
        await context.bot.ban_chat_member(chat_id, banned_user.id)
        await update.message.reply_html(f"🚫 {banned_user.mention_html()} has been banned from the chat.")
        logger.info("User banned", admin=update.effective_user.id, banned_user=banned_user.id)
    except Exception as e:
        logger.error("Failed to ban user", error=e)
        await update.message.reply_text(f"Failed to ban user. Reason: {e}")

async def unban_user(update: Update, context: CallbackContext) -> None:
    """Unbans a user from the chat. Requires the user's ID."""
    if not await _is_user_admin(update, context):
        await update.message.reply_text("This command can only be used by admins.")
        return

    if not context.args or not context.args[0].isdigit():
        await update.message.reply_text("Please provide a valid user ID to unban. Usage: /unban <user_id>")
        return

    user_id_to_unban = int(context.args[0])
    chat_id = update.effective_chat.id

    try:
        await context.bot.unban_chat_member(chat_id, user_id_to_unban)
        await update.message.reply_text(f"✅ User {user_id_to_unban} has been unbanned.")
        logger.info("User unbanned", admin=update.effective_user.id, unbanned_user_id=user_id_to_unban)
    except Exception as e:
        logger.error("Failed to unban user", error=e)
        await update.message.reply_text(f"Failed to unban user. Reason: {e}")

async def set_welcome_message(update: Update, context: CallbackContext) -> None:
    """Allows admins to set a custom welcome message for the chat."""
    if not await _is_user_admin(update, context):
        await update.message.reply_text("This command can only be used by admins.")
        return

    if not context.args:
        await update.message.reply_text("Please provide the welcome message text. Usage: /setwelcome <message>")
        await update.message.reply_text("Available placeholders: {username} (new member's username/first name)")
        return

    welcome_message = " ".join(context.args)
    chat_id = update.effective_chat.id
    
    context.chat_data['welcome_message'] = welcome_message
    await update.message.reply_html(f"✅ Welcome message for this chat set to:\n<code>{welcome_message}</code>")

async def announce_command(update: Update, context: CallbackContext) -> None:
    """Allows bot admins to send an announcement to the target chat."""
    ADMIN_USER_IDS = [int(i) for i in os.getenv("ADMIN_USER_IDS", "").split(',') if i]
    user_id = update.effective_user.id
    if user_id not in ADMIN_USER_IDS:
        await update.message.reply_text("This command can only be used by bot administrators in a private message.")
        return

    target_chat_id = os.getenv("TARGET_CHAT_ID") # Moved this line inside the function

    if not context.args:
        await update.message.reply_text("Please provide the announcement text. Usage: /announce <message>")
        return

    announcement_text = " ".join(context.args) # Original definition of announcement_text
    
    if not target_chat_id:
        await update.message.reply_text("❌ TARGET_CHAT_ID is not configured. The announcement was not sent.")
        logger.error("Attempted to announce but TARGET_CHAT_ID is not set.")
        return

    try:
        await context.bot.send_message(chat_id=target_chat_id, text=announcement_text)
        await update.message.reply_text(f"✅ Announcement sent to chat ID {target_chat_id}.")
        logger.info("Announcement sent", admin=user_id, chat_id=target_chat_id, message=announcement_text)
    except Exception as e:
        logger.error("Failed to send announcement", error=e, chat_id=target_chat_id)
        await update.message.reply_text(f"❌ Failed to send announcement. Reason: {e}")

async def toggle_cleanlinked(update: Update, context: CallbackContext) -> None:
    """Toggles the 'cleanlinked' feature or shows its status."""
    if not await _is_user_admin(update, context):
        await update.message.reply_text("This command can only be used by admins.")
        return

    chat_id = update.effective_chat.id
    current_state = context.chat_data.get('cleanlinked_enabled', False)

    if context.args:
        arg = context.args[0].lower()
        if arg in ['yes', 'on']:
            new_state = True
        elif arg in ['no', 'off']:
            new_state = False
        else:
            await update.message.reply_text("Invalid argument. Use 'yes', 'no', 'on', or 'off'.")
            return
        
        context.chat_data['cleanlinked_enabled'] = new_state
        status_message = "✅ Deletion of linked channel messages is now **enabled**." if new_state else "❌ Deletion of linked channel messages is now **disabled**."
        await update.message.reply_html(status_message)
        logger.info("Cleanlinked toggled", admin=update.effective_user.id, chat_id=chat_id, enabled=new_state)
    else:
        status_message = "✅ Deletion of linked channel messages is currently **enabled**." if current_state else "❌ Deletion of linked channel messages is currently **disabled**."
        await update.message.reply_html(status_message)




