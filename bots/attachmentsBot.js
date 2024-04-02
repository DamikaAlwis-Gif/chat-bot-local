// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, ActivityTypes } = require("botbuilder");
const path = require("path");
const axios = require("axios");
const fs = require("fs");

class AttachmentsBot extends ActivityHandler {
    constructor() {
        super();

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (let cnt = 0; cnt < membersAdded.length; cnt++) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    // If the Activity is a ConversationUpdate, send a greeting message to the user.
                    await context.sendActivity(
                        "Welcome to the Attachment Handling sample! Send me an attachment and I will save it."
                    );
                    await context.sendActivity(
                        "Alternatively, I can send you an attachment."
                    );
                    await next();
                }
            }
        });

        this.onMessage(async (context, next) => {
            // Determine how the bot should process the message by checking for attachments.
            if (
                context.activity.attachments &&
                context.activity.attachments.length > 0
            ) {
                // The user sent an attachment and the bot should handle the incoming attachment.
                await this.handleIncomingAttachment(context);
            } else {
                // Since no attachment was received, send a message indicating that only incoming attachments are handled.
                await context.sendActivity(
                    "I only handle incoming attachments. Please upload an image."
                );
                await next();
            }
        });
    }

    /**
     * Saves incoming attachments to disk by calling `this.downloadAttachmentAndWrite()` and
     * responds to the user with information about the saved attachment or an error.
     * @param {Object} turnContext
     */
    async handleIncomingAttachment(turnContext) {
        // Prepare Promises to download each attachment and then execute each Promise.
        const promises = turnContext.activity.attachments.map(
            this.downloadAttachmentAndWrite
        );
        const successfulSaves = await Promise.all(promises);
        console.log(successfulSaves)

        // Replies back to the user with information about where the attachment is stored on the bot's server,
        // and what the name of the saved file is.
        async function replyForReceivedAttachments(localAttachmentData) {
            if (localAttachmentData) {
                // Because the TurnContext was bound to this function, the bot can call
                // `TurnContext.sendActivity` via `this.sendActivity`;
                await turnContext.sendActivity(
                    // `Attachment "${localAttachmentData.fileName}" ` +
                    //     `has been received and saved to "${localAttachmentData.localPath}".`
                    `This is info: ${localAttachmentData.result.text}`
                );
            } else {
                await turnContext.sendActivity(
                    "Attachment was not successfully saved to disk."
                );
            }
        }

        // Prepare Promises to reply to the user with information about saved attachments.
        // The current TurnContext is bound so `replyForReceivedAttachments` can also send replies.
        const replyPromises = successfulSaves.map(replyForReceivedAttachments);
        await Promise.all(replyPromises);
    }

    /**
     * Downloads attachment to the disk.
     * @param {Object} attachment
     */
    async downloadAttachmentAndWrite(attachment) {
        // Retrieve the attachment via the attachment's contentUrl.
        const url = attachment.contentUrl;
        console.log(url)

        try {

            // arraybuffer is necessary for images
            const response = await axios.get(url, {
                responseType: "arraybuffer",
            });
            //console.log(response)

            // If user uploads JSON file, this prevents it from being written as "{"type":"Buffer","data":[123,13,10,32,32,34,108..."
            if (response.headers["content-type"] === "application/json") {
                response.data = JSON.parse(response.data, (key, value) => {
                    return value && value.type === "Buffer"
                        ? Buffer.from(value.data)
                        : value;
                });
            }
            
            console.log(response.data);
            const res = await axios.post(
                "http://localhost:5000/api/imageanalysis/imagebuffer",
                {
                    // imageUrl:
                    //     "https://th.bing.com/th/id/R.3d53a122167671f14955623753d586e8?rik=mHNc3MppvzbHmQ&pid=ImgRaw&r=0",

                    imageBuffer:response.data
                }
            );
            
            return res.data;


        } catch (error) {
            //console.error(error);
            return undefined;
        }
        // If no error was thrown while writing to disk, return the attachment's name
        // and localFilePath for the response back to the user.
        // return {
        //     // fileName: attachment.name,
        //     // localPath: localFileName,
            
        // };
    }
}

module.exports.AttachmentsBot = AttachmentsBot;
