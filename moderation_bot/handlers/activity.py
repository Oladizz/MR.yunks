import structlog
from telegram import Update
from telegram.ext import CallbackContext

logger = structlog.get_logger(__name__)

async def track_activity(update: Update, context: CallbackContext) -> None:
    """Tracks user activity by counting messages."""
    user_id = update.effective_user.id
    if 'user_activity' not in context.chat_data:
        context.chat_data['user_activity'] = {}
    
    context.chat_data['user_activity'][user_id] = context.chat_data['user_activity'].get(user_id, 0) + 1
    logger.debug("Tracked activity", user_id=user_id, chat_id=update.effective_chat.id)

async def top_command(update: Update, context: CallbackContext) -> None:
    """Displays the top N most active users in the chat."""
    chat_id = update.effective_chat.id
    if 'user_activity' not in context.chat_data or not context.chat_data['user_activity']:
        await update.message.reply_text("No activity has been recorded in this chat yet.")
        return

    # Sort users by message count in descending order
    sorted_activity = sorted(
        context.chat_data['user_activity'].items(),
        key=lambda item: item[1],
        reverse=True
    )

    # Determine how many top users to show (e.g., top 5 or less)
    top_n = min(len(sorted_activity), 5)
    top_users = sorted_activity[:top_n]

    message = "<b>🏆 Top Active Users 🏆</b>\n\n"
    for i, (user_id, count) in enumerate(top_users):
        try:
            member = await context.bot.get_chat_member(chat_id, user_id)
            user_name = member.user.mention_html()
            message += f"{i + 1}. {user_name} - {count} messages\n"
        except Exception:
            # This can happen if the user has left the chat
            message += f"{i + 1}. User ID {user_id} - {count} messages (user not found)\n"
            logger.warning("Could not find user for top list", user_id=user_id, chat_id=chat_id)
            
    await update.message.reply_html(message)
