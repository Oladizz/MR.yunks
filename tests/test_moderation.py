import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import os

# Add the parent directory to the path to allow imports
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from moderation_bot.handlers.moderation import warn_user, kick_user, ban_user, unban_user, set_welcome_message, announce_command


# --- Tests for /warn ---

@pytest.mark.asyncio
async def test_warn_user_as_admin():
    update = AsyncMock()
    context = AsyncMock()
    warned_user = MagicMock()
    warned_user.mention_html.return_value = "WarnedUser"
    update.message.reply_to_message.from_user = warned_user
    context.args = ["for", "spamming"]

    # Directly mock _is_user_admin to return True, simplifying the test setup
    with patch('moderation_bot.handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await warn_user(update, context)
        update.message.reply_html.assert_called_once()
        call_args, _ = update.message.reply_html.call_args
        assert "<b>Reason:</b> for spamming" in call_args[0]

@pytest.mark.asyncio
async def test_warn_user_as_non_admin():
    update = AsyncMock()
    context = AsyncMock()
    with patch('moderation_bot.handlers.moderation._is_user_admin', new=AsyncMock(return_value=False)):
        await warn_user(update, context)
        update.message.reply_text.assert_called_once_with("This command can only be used by admins.")

# --- Tests for /kick ---

@pytest.mark.asyncio
async def test_kick_user_as_admin():
    update = AsyncMock()
    context = AsyncMock()
    kicked_user = MagicMock()
    kicked_user.mention_html.return_value = "KickedUser"
    update.message.reply_to_message.from_user = kicked_user

    with patch('moderation_bot.handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await kick_user(update, context)
        context.bot.kick_chat_member.assert_called_once_with(update.effective_chat.id, kicked_user.id)

# --- Tests for /ban ---

@pytest.mark.asyncio
async def test_ban_user_as_admin():
    update = AsyncMock()
    context = AsyncMock()
    banned_user = MagicMock()
    banned_user.mention_html.return_value = "BannedUser"
    update.message.reply_to_message.from_user = banned_user

    with patch('moderation_bot.handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await ban_user(update, context)
        context.bot.ban_chat_member.assert_called_once_with(update.effective_chat.id, banned_user.id)

# --- Tests for /unban ---

@pytest.mark.asyncio
async def test_unban_user_as_admin():
    update = AsyncMock()
    context = AsyncMock()
    context.args = ["12345"]

    with patch('moderation_bot.handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await unban_user(update, context)
        context.bot.unban_chat_member.assert_called_once_with(update.effective_chat.id, 12345)
        update.message.reply_text.assert_called_once_with("✅ User 12345 has been unbanned.")

@pytest.mark.asyncio
async def test_unban_user_without_id():
    update = AsyncMock()
    context = AsyncMock()
    context.args = []

    with patch('moderation_bot.handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await unban_user(update, context)
        update.message.reply_text.assert_called_once_with("Please provide a valid user ID to unban. Usage: /unban <user_id>")

# --- Tests for /setwelcome ---

@pytest.mark.asyncio
async def test_set_welcome_message_as_admin():
    update = AsyncMock()
    context = AsyncMock()
    context.chat_data = {}
    context.args = ["Welcome,", "new", "member!"]

    with patch('moderation_bot.handlers.moderation._is_user_admin', new=AsyncMock(return_value=True)):
        await set_welcome_message(update, context)
        assert context.chat_data['welcome_message'] == "Welcome, new member!"
        update.message.reply_html.assert_called_once()

@pytest.mark.asyncio
async def test_set_welcome_message_as_non_admin():
    update = AsyncMock()
    context = AsyncMock()
    update.effective_user.id = 9999  # Not an admin
    context.args = ["Welcome, new member!"]

    with patch('moderation_bot.handlers.moderation._is_user_admin', new=AsyncMock(return_value=False)):
        await set_welcome_message(update, context)
        update.message.reply_text.assert_called_once_with("This command can only be used by admins.")

# --- Tests for /announce ---

@pytest.mark.asyncio
async def test_announce_command_as_admin():
    """Test the /announce command as an admin."""
    update = AsyncMock()
    context = AsyncMock()
    
    # Set a specific user ID for the effective user
    test_admin_user_id = 123
    update.effective_user.id = test_admin_user_id
    context.args = ["This", "is", "an", "announcement"]
    
    # Patch ADMIN_USER_IDS and TARGET_CHAT_ID for the test
    with patch.dict(os.environ, {"ADMIN_USER_IDS": str(test_admin_user_id), "TARGET_CHAT_ID": "test_chat_id"}):
        await announce_command(update, context)

    context.bot.send_message.assert_called_once_with(
        chat_id="test_chat_id", text="This is an announcement"
    )
    update.message.reply_text.assert_called_once_with("✅ Announcement sent to chat ID test_chat_id.")

@pytest.mark.asyncio
async def test_announce_command_as_non_admin():
    """Test the /announce command as a non-admin."""
    update = AsyncMock()
    context = AsyncMock()
    update.effective_user.id = 9999  # Not an admin

    with patch.dict(os.environ, {"ADMIN_USER_IDS": ""}):
        await announce_command(update, context)

    update.message.reply_text.assert_called_once_with(
        "This command can only be used by bot administrators in a private message."
    )

