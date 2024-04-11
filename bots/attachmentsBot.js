// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const {
  TurnContext,
  MessageFactory,
  TeamsActivityHandler,
} = require("botbuilder");

const axios = require("axios");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { ChatMessageHistory } = require("langchain/stores/message/in_memory");
const history = new ChatMessageHistory();

const messages = require("../messages.json")
class TeamsBot extends TeamsActivityHandler {
  constructor() {
    super();

    this.imageAnalysisResponce = null;
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (let cnt = 0; cnt < membersAdded.length; cnt++) {
        if (membersAdded[cnt].id !== context.activity.recipient.id) {
          // send a greeting message to the user.
          await context.sendActivity(messages.WELLCOME_MESSAGE);

          await next();
        }
      }
    });

    this.onMessage(async (context, next) => {
      // Determine how the bot should process the message by checking for attachments.
      const imageExtensions = ["jpeg", "jpg", "png"];

      TurnContext.removeRecipientMention(context.activity);
      const attachments = context.activity.attachments;

      if (context.activity.text) {
        // regex for handeling more keyword
        const regex = /more/i;
        const messageText = context.activity.text;
        history.addMessage(new HumanMessage(messageText));

        if (regex.test(messageText)) {
          // Provide additional details
          if (this.imageAnalysisResponce) {
            const summary = this.getMoreInfoImage(
              this.imageAnalysisResponce.result
            );
            await context.sendActivity(summary);
          } else {
            await context.sendActivity(messages.NO_IMAGE_UPLOADED_ERROR);
          }
        } else {
          await context.sendActivity(messages.INVALID_MESSAGE_ERROR);
        }
      } else if (
        attachments &&
        attachments[0] &&
        attachments[0].contentType ===
          "application/vnd.microsoft.teams.file.download.info" &&
        imageExtensions.includes(attachments[0].content.fileType)
      ) {
        history.addMessage(new HumanMessage(context.activity.attachments));
        await this.handleIncomingAttachment(context);
      } else {
        await context.sendActivity(messages.INVALID_FILE_TYPE_ERROR);
      }
      console.log(history.getMessages());

      await next();
    });
  }

  returnItemsAsList = (arr) => {
    let string = "";
    for (let i = 0; i < arr.length; i++) {
      string += `\n${i + 1}.${arr[i]}`;
    }
    return string;
  };

  getMoreInfoImage = (result) => {
    const caption = result.caption;
    const denseCaptions = result.denseCaptions;
    const tags = result.tags;
    const objectTags = result.objectTags;

    const textLines = result.textLines;
    const summary =
      `Caption: ${caption}` +
      "\n" +
      "Dense Captions:" +
      this.returnItemsAsList(denseCaptions) +
      "\n" +
      `Tags: ${tags.join(", ")}` +
      "\n" +
      `Object Tags: ${objectTags.join(", ")}` +
      "\n" +
      `Image Text: ${this.returnItemsAsList(textLines)}`;

    return summary;
  };

  handleIncomingAttachment = async (context) => {
    const res = await this.getImageAnalysisResponce(context);
    if (res) {
      this.imageAnalysisResponce = res;
      const caption = res.result.caption;
      await context.sendActivity(`This image contains ${caption}`);
    } else {
      await context.sendActivity(messages.IMAGE_PROCESSING_ERROR);
    }
  };

  getImageAnalysisResponce = async (context) => {
    // Retrieve the attachment via the attachment's contentUrl.
    const url = context.activity.attachments[0].contentUrl;
    // const url = context.activity.attachments[0].content.downloadUrl;

    try {
      // arraybuffer is necessary for images
      const response = await axios.get(url, {
        responseType: "arraybuffer",
      });

      // If user uploads JSON file, this prevents it from being written as "{"type":"Buffer","data":[123,13,10,32,32,34,108..."
      if (response.headers["content-type"] === "application/json") {
        response.data = JSON.parse(response.data, (key, value) => {
          return value && value.type === "Buffer"
            ? Buffer.from(value.data)
            : value;
        });
      }

      const res = await axios.post(
        "https://image-analyze-api.azurewebsites.net/api/imageanalysis/imagebuffer/summarized",
        {
          imageBuffer: response.data,
        }
      );

      return res.data;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  };
}

module.exports.TeamsBot = TeamsBot;
