// Define a class to represent the in-memory database
class FakeDatabase {
  constructor() {
    this.data = {};
  }

  // Method to get messages for a specific session
  getMessages(sessionId) {
    return this.data[sessionId] ?? [];
  }

  // Method to add a message for a specific session
  addMessage(sessionId, message) {
    if (!this.data[sessionId]) {
      this.data[sessionId] = [];
    }
    this.data[sessionId].push(message);
  }

  // Method to add multiple messages for a specific session
  addMessages(sessionId, messages) {
    if (!this.data[sessionId]) {
      this.data[sessionId] = [];
    }
    this.data[sessionId].push(...messages);
  }

  // Method to clear messages for a specific session
  clear(sessionId) {
    delete this.data[sessionId];
  }
}


module.exports = FakeDatabase;

