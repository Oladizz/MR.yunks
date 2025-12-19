import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from telegram import Chat, Message

# Add the parent directory to the path to allow imports
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from moderation_bot.handlers.pin import (
    get_pinned_message, pin_message, announce_pin, perma_pin,
    unpin_message, unpin_all_messages, toggle_antichannelpin,
    prevent_channel_auto_pin
)

# Mock _is_user_admin for all tests in this module
@pytest.fixture(autouse=True)
def mock_is_admin():
    with patch('moderation_bot.handlers.pin._is_user_admin', new=AsyncMock(return_value=True)) as mock_admin:
        yield mock_admin

@pytest.fixture
def mock_update_context():
    update = AsyncMock()
    update.effective_chat.id = 123
    update.message.reply_text = AsyncMock()
    update.message.message_id = 456
    update.message.text = "Some message text" # Default for apply_filters
    update.message.reply_to_message = None # Explicitly set to None to prevent truthy mock behavior
    update.message.sender_chat = None # Default for channel checks
    update.message.is_automatic_forward = False # Default for channel checks
    update.effective_user.id = 789 # Default user id
    update.effective_user.mention_html.return_value = "TestUser"

    context = AsyncMock()
    context.chat_data = {}
    context.args = []
    
    # Mock bot object and its methods
    context.bot = AsyncMock()
    context.bot.send_message = AsyncMock()
    context.bot.pin_chat_message = AsyncMock()
    context.bot.unpin_chat_message = AsyncMock()
    context.bot.unpin_all_chat_messages = AsyncMock()
    context.bot.get_chat = AsyncMock()

    return update, context

@pytest.mark.asyncio
async def test_get_pinned_message_exists(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    mock_chat = AsyncMock()
    mock_chat.pinned_message = MagicMock(spec=Message, text="Pinned message content")
    context.bot.get_chat.return_value = mock_chat

    await get_pinned_message(update, context)
    context.bot.get_chat.assert_awaited_once_with(update.effective_chat.id)
    update.message.reply_text.assert_awaited_once_with("📌 Current Pinned Message:\n\nPinned message content", quote=True)

@pytest.mark.asyncio
async def test_get_pinned_message_none(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    mock_chat = AsyncMock()
    mock_chat.pinned_message = None
    context.bot.get_chat.return_value = mock_chat

    await get_pinned_message(update, context)
    context.bot.get_chat.assert_awaited_once_with(update.effective_chat.id)
    update.message.reply_text.assert_awaited_once_with("There is no message currently pinned in this chat.")

@pytest.mark.asyncio
async def test_pin_message_reply(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    update.message.reply_to_message = MagicMock(message_id=999)
    await pin_message(update, context)
    context.bot.pin_chat_message.assert_awaited_once_with(update.effective_chat.id, 999, disable_notification=True)
    update.message.reply_text.assert_awaited_once_with("✅ Message pinned!", quote=True)

@pytest.mark.asyncio
async def test_pin_message_reply_loud(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    update.message.reply_to_message = MagicMock(message_id=999)
    context.args = ['loud']
    await pin_message(update, context)
    context.bot.pin_chat_message.assert_awaited_once_with(update.effective_chat.id, 999, disable_notification=False)
    update.message.reply_text.assert_awaited_once_with("✅ Message pinned!", quote=True)

@pytest.mark.asyncio
async def test_pin_message_custom_text(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    context.args = ["Custom message to pin"]
    context.bot.send_message.return_value = AsyncMock(message_id=1000)
    await pin_message(update, context)
    context.bot.send_message.assert_awaited_once_with(update.effective_chat.id, "Custom message to pin", parse_mode='HTML')
    context.bot.pin_chat_message.assert_awaited_once_with(update.effective_chat.id, 1000, disable_notification=True)
    update.message.reply_text.assert_awaited_once_with("✅ Custom message pinned!", quote=True)

@pytest.mark.asyncio
async def test_announce_pin(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    context.args = ["📢 Important Announcement"]
    context.bot.send_message.return_value = AsyncMock(message_id=1001)
    await announce_pin(update, context)
    context.bot.send_message.assert_awaited_once_with(update.effective_chat.id, "📢 Important Announcement", parse_mode='HTML')
    context.bot.pin_chat_message.assert_awaited_once_with(update.effective_chat.id, 1001, disable_notification=False)
    update.message.reply_text.assert_awaited_once_with("✅ Announcement sent and pinned!", quote=True)

@pytest.mark.asyncio
async def test_perma_pin(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    context.args = ["Forever pinned text"]
    context.bot.send_message.return_value = AsyncMock(message_id=1002)
    await perma_pin(update, context)
    context.bot.send_message.assert_awaited_once_with(update.effective_chat.id, "Forever pinned text", parse_mode='HTML', disable_web_page_preview=True)
    context.bot.pin_chat_message.assert_awaited_once_with(update.effective_chat.id, 1002, disable_notification=True)
    update.message.reply_text.assert_awaited_once_with("✅ Custom message perma-pinned!", quote=True)

@pytest.mark.asyncio
async def test_unpin_message_reply(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    update.message.reply_to_message = MagicMock(message_id=999)
    await unpin_message(update, context)
    context.bot.unpin_chat_message.assert_awaited_once_with(update.effective_chat.id, 999)
    update.message.reply_text.assert_awaited_once_with("✅ Message unpinned!", quote=True)

@pytest.mark.asyncio
async def test_unpin_message_last_pinned(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    await unpin_message(update, context)
    context.bot.unpin_chat_message.assert_awaited_once_with(update.effective_chat.id)
    update.message.reply_text.assert_awaited_once_with("✅ Last pinned message unpinned!", quote=True)

@pytest.mark.asyncio
async def test_unpin_all_messages(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    await unpin_all_messages(update, context)
    context.bot.unpin_all_chat_messages.assert_awaited_once_with(update.effective_chat.id)
    update.message.reply_text.assert_awaited_once_with("✅ All messages unpinned!", quote=True)

@pytest.mark.asyncio
async def test_toggle_antichannelpin_on(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    context.args = ['on']
    await toggle_antichannelpin(update, context)
    assert context.chat_data['antichannelpin_enabled'] is True
    update.message.reply_html.assert_awaited_once_with("✅ Anti-channel pin is now **enabled**.")

@pytest.mark.asyncio
async def test_toggle_antichannelpin_show_status(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    context.chat_data['antichannelpin_enabled'] = False
    await toggle_antichannelpin(update, context)
    update.message.reply_html.assert_awaited_once_with("❌ Anti-channel pin is currently **disabled**.")

@pytest.mark.asyncio
async def test_prevent_channel_auto_pin_enabled(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    context.chat_data['antichannelpin_enabled'] = True
    update.message.is_automatic_forward = True
    update.message.from_chat = MagicMock(type=Chat.CHANNEL)
    await prevent_channel_auto_pin(update, context)
    context.bot.unpin_chat_message.assert_awaited_once_with(update.effective_chat.id, update.message.message_id)

@pytest.mark.asyncio
async def test_prevent_channel_auto_pin_disabled(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    context.chat_data['antichannelpin_enabled'] = False
    update.message.is_automatic_forward = True
    update.message.from_chat = MagicMock(type=Chat.CHANNEL)
    await prevent_channel_auto_pin(update, context)
    context.bot.unpin_chat_message.assert_not_awaited()

@pytest.mark.asyncio
async def test_prevent_channel_auto_pin_not_from_channel(mock_is_admin, mock_update_context):
    update, context = mock_update_context
    context.chat_data['antichannelpin_enabled'] = True
    update.message.is_automatic_forward = True
    update.message.from_chat = MagicMock(type=Chat.GROUP) # Not a channel
    await prevent_channel_auto_pin(update, context)
    context.bot.unpin_chat_message.assert_not_awaited()
