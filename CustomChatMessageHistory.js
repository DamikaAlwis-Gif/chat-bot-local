// Your custom chat message history class

const FakeDatabase  = require("./FakeDatabase");
const { BaseListChatMessageHistory } = require("@langchain/core/chat_history");
const {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} = require("@langchain/core/messages");

class CustomChatMessageHistory extends BaseListChatMessageHistory {
  constructor() {
    super();
    this.lc_namespace = ["langchain", "stores", "message"];
    // this.sessionId = fields.sessionId;
    this.fakeDatabase = new FakeDatabase();
  }

  async getMessages(sessionId) {
    const messages = this.fakeDatabase.getMessages(sessionId) || [];
    return mapStoredMessagesToChatMessages(messages);
  }

  async addMessage(message, sessionId) {
    const serializedMessage = mapChatMessagesToStoredMessages([message])[0];
    this.fakeDatabase.addMessage(sessionId, serializedMessage);
  }

  async addMessages(messages, sessionId) {
    const serializedMessages = mapChatMessagesToStoredMessages(messages);
    this.fakeDatabase.addMessages(sessionId, serializedMessages);
  }

  async clear() {
    this.fakeDatabase.clear(sessionId);
  }
}

module.exports = CustomChatMessageHistory;


