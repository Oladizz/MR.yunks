import pytest
from unittest.mock import AsyncMock, MagicMock

# Add the parent directory to the path to allow imports
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from moderation_bot.handlers.activity import track_activity, top_command

@pytest.mark.asyncio
async def test_track_activity():
    """Test that activity tracking correctly counts messages."""
    update = AsyncMock()
    context = AsyncMock()
    context.chat_data = {}
    update.effective_user.id = 123
    
    await track_activity(update, context)
    
    assert context.chat_data['user_activity'][123] == 1
    
    await track_activity(update, context)
    assert context.chat_data['user_activity'][123] == 2

@pytest.mark.asyncio
async def test_top_command_no_activity():
    """Test the /top command when there is no activity."""
    update = AsyncMock()
    context = AsyncMock()
    context.chat_data = {}
    
    await top_command(update, context)
    
    update.message.reply_text.assert_called_once_with("No activity has been recorded in this chat yet.")

@pytest.mark.asyncio
async def test_top_command_with_activity():
    """Test the /top command with some activity."""
    update = AsyncMock()
    context = AsyncMock()
    context.chat_data = {
        'user_activity': {
            123: 10,
            456: 5,
            789: 15
        }
    }

    # Mock get_chat_member
    async def mock_get_chat_member(chat_id, user_id):
        user = MagicMock()
        user.mention_html.return_value = f"User{user_id}"
        return MagicMock(user=user)

    context.bot.get_chat_member = mock_get_chat_member
    
    await top_command(update, context)
    
    expected_message = (
        "<b>🏆 Top Active Users 🏆</b>\n\n"
        "1. User789 - 15 messages\n"
        "2. User123 - 10 messages\n"
        "3. User456 - 5 messages\n"
    )
    update.message.reply_html.assert_called_once_with(expected_message)
