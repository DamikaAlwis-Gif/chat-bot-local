const {
  TurnContext,
  MessageFactory,
  TeamsActivityHandler,
} = require("botbuilder");

const axios = require("axios");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const CustomChatMessageHistory = require("../CustomChatMessageHistory");
const messages = require("../messages.json");

class TeamsBot extends TeamsActivityHandler {
  constructor() {
    super();
    this.history = new CustomChatMessageHistory();

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (let cnt = 0; cnt < membersAdded.length; cnt++) {
        if (membersAdded[cnt].id !== context.activity.recipient.id) {
          await context.sendActivity(messages.WELLCOME_MESSAGE);
          await next();
        }
      }
    });

    this.onMessage(async (context, next) => {
      const imageExtensions = ["jpeg", "jpg", "png"];

      TurnContext.removeRecipientMention(context.activity);
      const attachments = context.activity.attachments;

      if (context.activity.text) {
        const regex = /more/i;
        const messageText = context.activity.text;

        if (regex.test(messageText)) {
          console.log(
            this.history.getMessages(context.activity.conversation.id)
          );
          const messages = await this.history
            .getMessages(context.activity.conversation.id)
            
          const lastMessage = messages[messages.length -1];
          if (lastMessage && lastMessage.lc_kwargs["result"]) {
            const summary = this.getMoreInfoImage(
              lastMessage.lc_kwargs["result"]
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
        attachments[0] 
        &&
        attachments[0].contentType ===
          "application/vnd.microsoft.teams.file.download.info" &&
        imageExtensions.includes(attachments[0].content.fileType)
      ) {
        await this.history.addMessage(
          new HumanMessage(context.activity.attachments),
          context.activity.conversation.id
        );
        await this.handleIncomingAttachment(context);
      } else {
        await context.sendActivity(messages.INVALID_FILE_TYPE_ERROR);
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

  getMoreInfoImage = (result) => {
    const caption = result.caption;
    const denseCaptions = result.denseCaptions;
    const tags = result.tags;
    const objectTags = result.objectTags;
    const textLines = result.textLines;

    const summary = `**Caption:** ${caption}  
    **Dense Captions:** ${
      denseCaptions.length === 0 ? "none" : denseCaptions.join(", ")
    }  
    **Tags:** ${tags.length === 0 ? "none" : tags.join(", ")}  
    **Object Tags:** ${
      objectTags.length === 0 ? "none" : objectTags.join(", ")
    }  
    **Image Text:** ${textLines.length === 0 ? "none" : textLines.join(", ")}`;

    const reply = MessageFactory.text(summary);
    reply.textFormat = "markdown";
    return reply;
  };

  handleIncomingAttachment = async (context) => {
    const res = await this.getImageAnalysisResponce(context);
    await this.history.addMessage(
      new AIMessage(res),
      context.activity.conversation.id
    );
    console.log(this.history)
    if (res) {
      const caption = res.result.caption;
      await context.sendActivity(`This image contains ${caption}`);
    } else {
      await context.sendActivity(messages.IMAGE_PROCESSING_ERROR);
    }
  };

  getImageAnalysisResponce = async (context) => {
    const url = context.activity.attachments[0].content.downloadUrl;
    //const url = context.activity.attachments[0].contentUrl;


    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
      });

      if (response.headers["content-type"] === "application/json") {
        response.data = JSON.parse(response.data, (key, value) => {
          return value && value.type === "Buffer"
            ? Buffer.from(value.data)
            : value;
        });
      }

      const res = await axios.post(
        "https://image-analyze-api.azurewebsites.net/api/imageanalysis/imagebuffer/summarized",
        { imageBuffer: response.data }
      );

      return res.data;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  };
}

module.exports.TeamsBot = TeamsBot;
