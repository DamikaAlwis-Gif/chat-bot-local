// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const {
  TurnContext,
  MessageFactory,
  TeamsActivityHandler,
} = require("botbuilder");

const axios = require("axios");

class AttachmentsBot extends TeamsActivityHandler {
  constructor() {
    super();

    this.imageAnalysisResponce = null;
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (let cnt = 0; cnt < membersAdded.length; cnt++) {
        if (membersAdded[cnt].id !== context.activity.recipient.id) {
          // send a greeting message to the user.
          await context.sendActivity(
            "Welcome to the AI_bot! I'm here to assist you. Please upload an image."
          );

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
        // await context.sendActivity(`Echo: ${context.activity.text}`);
        const regex = /more/i;
        const messageText = context.activity.text;
        if (regex.test(messageText)) {
          // Provide additional details

          if (this.imageAnalysisResponce) {
            const summary = this.summarizeResponse(
              this.imageAnalysisResponce.result
            );
            await context.sendActivity(summary);
          } else {
            await context.sendActivity(
              "Please upload a image first to get more details of a image"
            );
          }
        } else {
          await context.sendActivity(
            "Sorry, I can't assist with that at the moment. Please upload an image."
          );
        }
      } else if (attachments && attachments[0]) {
        // if (
        //     attachments[0].contentType === "application/vnd.microsoft.teams.file.download.info" &&
        //     imageExtensions.includes(attachments[0].content.fileType)
        // ) {

        //     await this.handleIncomingAttachment(context);

        // } else if (imageRegex.test(attachments[0].contentType)) {
        //     await context.sendActivity(
        //         "I'm sorry, I can't process inline images."
        //     );
        // } else {
        //     await context.sendActivity(
        //         "I'm sorry, I can only process incoming images."
        //     );
        // }

        await this.handleIncomingAttachment(context);
      } else {
        await context.sendActivity(
          "I'm sorry, I can only handle incoming attachments or text messages. Please upload an image or send a text message."
        );
      }

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

  summarizeResponse = (result) => {

    // extracting the caption details
    const caption = result.caption;
    //const captionConfidence = result.captionResult.confidence;

    // Extracting dense captions
    const denseCaptions = result.denseCaptions;
    // Extracting tags
    const tags = result.tags;

    // extracting
    // Extracting objects
    const objectTags = result.objectTags;

    const textLines = result.textLines;

    // Summarizing the content
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
      await context.sendActivity(`This image contains: ${caption}`);
    } else {
      await context.sendActivity(
        "An error occurred while processing the image."
      );
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
        // "https://image-analyze-api.azurewebsites.net/api/imageanalysis/imagebuffer",
        "http://localhost:5000/api/imageanalysis/imagebuffer/summarized",

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

module.exports.AttachmentsBot = AttachmentsBot;
