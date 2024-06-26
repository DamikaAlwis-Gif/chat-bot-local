const {
  TurnContext,
  MessageFactory,
  TeamsActivityHandler,
} = require("botbuilder");

const axios = require("axios");
const { HumanMessage, AIMessage, SystemMessage } = require("@langchain/core/messages");
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
      const temp = await this.history.getMessages(context.activity.conversation.id);
      console.log(temp)
      if(temp.length === 0){
        await this.history.addMessage(
          new SystemMessage(
            "You are an ai assistant that gives answers for questions."
          ),
          context.activity.conversation.id
        );
      }
       

      if (context.activity.text) {
        const regex = /more/i;
        const messageText = context.activity.text;

        if (regex.test(messageText)) {
          
          const messages = await this.history.getMessages(
            context.activity.conversation.id
          );

          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.lc_kwargs["result"]) {
            const summary = this.getMoreInfoImage(
              lastMessage.lc_kwargs["result"]
            );
            await context.sendActivity(summary);
          } else {
            await context.sendActivity(messages.NO_IMAGE_UPLOADED_ERROR);
          }
        } else {
          // await context.sendActivity(messages.INVALID_MESSAGE_ERROR);
          
          await this.history.addMessage(
            new HumanMessage(messageText),
            context.activity.conversation.id
          );
          // console.log(typeof context.activity.conversation.id);
          // console.log(
          //   this.history.fakeDatabase.data[context.activity.conversation.id]
          // );
          // let data1 = 
          //   this.history.fakeDatabase.data[context.activity.conversation.id]
          
          
          // let resultString = "";
          // let dataList =
          //   this.history.fakeDatabase.data[context.activity.conversation.id];
          // dataList.forEach((item) => {
          //   resultString += item.data.content + " ";
          // });
          //console.log(resultString);

          let data = JSON.stringify({
            // messages: [
            //   {
            //     role: "system",
            //     content: [
            //       {
            //         type: "text",
            //         text: "You are an ai assistant that gives answers for questions.",
            //       },
            //     ],
            //     role: "user",
            //     content: [
            //       {
            //         type: "text",

            //         text: `${resultString} ${messageText}`,
            //       },
            //     ],
            //   },
            //],
            messages: this.history.fakeDatabase.data[context.activity.conversation.id],
            
            temperature: 0.7,
            top_p: 0.95,
            max_tokens: 800,
          });
         

          let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: "https://ai-copilotlabs8085049134634.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-02-15-preview",
            headers: {
              "Content-Type": "application/json",
              "api-key": "e8201fcbec7643b2b08966d20e2e3487",
            },
            data: data,
          };

          try {
            const r = await axios.request(config);
            // console.log(r.data.choices[0].message);
            await this.history.addMessage(
              new AIMessage( r.data.choices[0].message.content
              ),
              context.activity.conversation.id
            );
            await context.sendActivity(r.data.choices[0].message.content);
          } catch (error) {
            console.log(error);
          }
        }
      } else if (
        attachments &&
        attachments[0]
        // &&
        // attachments[0].contentType ===
        //   "application/vnd.microsoft.teams.file.download.info" &&
        // imageExtensions.includes(attachments[0].content.fileType)
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
    console.log(this.history);
    if (res) {
      const caption = res.result.caption;
      await context.sendActivity(`This image contains ${caption}`);
    } else {
      await context.sendActivity(messages.IMAGE_PROCESSING_ERROR);
    }
  };

  getImageAnalysisResponce = async (context) => {
    //const url = context.activity.attachments[0].content.downloadUrl;
    const url = context.activity.attachments[0].contentUrl;

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
