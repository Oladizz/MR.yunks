import pytest
from unittest.mock import AsyncMock

# Add the parent directory to the path to allow imports
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from moderation_bot.handlers.help import help_command

@pytest.mark.asyncio
async def test_help_command():
    """Test that the help command sends the correct message."""
    update = AsyncMock()
    context = AsyncMock()

    await help_command(update, context)

    expected_help_text = (
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
    update.message.reply_html.assert_called_once_with(expected_help_text)
