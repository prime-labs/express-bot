import mongoose from "mongoose";
import { WebSocketManager, WebSocketShardEvents } from "@discordjs/ws";
import { REST } from "@discordjs/rest";
import { createClient } from "smtpexpress";
import { IntentsBitField, Routes } from "discord.js";
import { string } from "yup";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const SMTP_EXPRESS_SECRET = process.env.PROJECT_SECRET;
const HTML_CONVERTER_API_KEY = process.env.HTML_CONVERTER_API_KEY;
const MONGODB_DATABASE_CONN = process.env.MONGODB_DATABASE_CONN;

if (!DISCORD_TOKEN) {
  throw new Error(
    "Cannot initialize bot without discord token. Set your Environment variable"
  );
}

if (!SMTP_EXPRESS_SECRET) {
  throw new Error(
    "Cannot initialize bot without project secret. Set your Environment variable"
  );
}

if (!HTML_CONVERTER_API_KEY) {
  throw new Error(
    "Cannot initialize bot without converter API. Set your Environment variable"
  );
}

if (!MONGODB_DATABASE_CONN) {
  throw new Error(
    "Cannot initialize bot without mongo db connection string. Set your Environment variable"
  );
}

console.log("Connecting to mongodb...");
const connection = mongoose.createConnection(MONGODB_DATABASE_CONN);
console.log("Connection established");

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    default: function () {
      return (Math.random() * 1000).toFixed();
    },
  },
  ticketLink: String,
  emailAddress: String,
  name: String,
  username: String,
  discordUserId: String,
  discordDMChannelId: String,
  createdAt: {
    type: String,
    default: () => new Date(),
  },
  isPresent: Boolean,
});

const Ticket = connection.model("Ticket", ticketSchema);

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
const smtpexpressClient = createClient({
  projectId: "sm0pid-MPdonhpAAaCW5wbZyMACYAzWY",
  projectSecret: SMTP_EXPRESS_SECRET,
});

const intents = new IntentsBitField();
intents.add(
  IntentsBitField.Flags.DirectMessages,
  IntentsBitField.Flags.GuildMembers
);

const manager = new WebSocketManager({
  rest,
  token: DISCORD_TOKEN,
  intents: intents.bitfield,
});

manager.on(WebSocketShardEvents.Dispatch, async (event) => {
  console.log(event.data.t);
  if (event.data.t === "GUILD_MEMBER_ADD") {
    console.log("Member joined, Checking if new");
    const user = event.data.d.user;
    const existingMember = await Ticket.findOne({
      discordUserId: user?.id,
    }).exec();

    const response = { id: "" };
    let userTicket: typeof existingMember = null;

    if (existingMember) {
      console.log("Member is not new, using already existing data");
      response.id = existingMember.discordDMChannelId!;
      userTicket = existingMember;
    } else {
      console.log("Member is new, creating record...");
      response.id = (
        (await rest.post(Routes.userChannels(), {
          body: {
            recipient_id: user?.id,
          },
        })) as { id: string }
      ).id;
      const ticketInstance = new Ticket({
        discordDMChannelId: response.id,
        discordUserId: user?.id,
        username: user?.username,
        name: user?.global_name || user?.username,
      });
      userTicket = await ticketInstance.save();
      console.log("Record saved.");
    }
    console.log(userTicket);

    await rest.post(Routes.channelMessages(response.id), {
      body: {
        embeds: [
          {
            image: {
              url: "https://res.cloudinary.com/devtenotea/image/upload/v1704800450/smtp-express-launch-party.png",
            },
            width: 500,
            height: 700,
          },
        ],
        content: `
        Hey ${userTicket.name}!

Welcome to the SMTP Express Discord Server, where the elite hangout 😌. 

I am the Express bot and I am officially inviting you, on behalf of the entire SMTP Express team, 
to join us for our product launch happening on the 27th of January, 2024.
        
As a member of our discord server, you are eligible for a free ticket to the launch party.
     
To claim your ticket, respond to this message with your email address and your ticket will be sent to your mailbox.
        
See you there!!`,
      },
    });
  }

  if (event.data.t === "MESSAGE_CREATE") {
    if (event.data.d.author.bot) return;
    try {
      const userEmail = await string()
        .required()
        .email()
        .validate(event.data.d.content);
      console.log("User Email", userEmail);
      try {
        console.log("Checking if user exists...");
        const existingTicket = await Ticket.findOne({
          discordUserId: event.data.d.author.id,
        }).exec();

        let ticket = { url: "" };

        if (!existingTicket) {
          throw new Error("mishap");
        }

        console.log("User found", existingTicket);

        if (existingTicket?.ticketLink) {
          console.log("Ticket exists, omitting api call");
          ticket = { url: existingTicket.ticketLink };
        } else {
          console.log("Generating new ticket..");
          ticket = (await (
            await fetch("https://hcti.io/v1/image", {
              method: "POST",
              body: JSON.stringify({
                html: `<!DOCTYPE html>
              <html lang="en">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <link rel="preconnect" href="https://fonts.googleapis.com">
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
                  <title>Launch Party Ticket</title>
                  <style>
                    html {
                      height: 400px;
                    }
                    * {
                      margin: 0;
                      padding: 0;
                      box-sizing: border-box;
                      color: white;
                      font-family: "Inter", system-ui, -apple-system,
                        BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell,
                        "Open Sans", "Helvetica Neue", sans-serifs;
                    }
              
                    body {
                      height: 400px;
                    }
              
                    .ticket-container {
                      background-color: black;
                      height: 400px;
                      position: relative;
                      width: 100%;
                      z-index: 1;
                      /* padding: 30px 60px; */
                      overflow: hidden;
                      border-left: 8px solid #f2b311;
                      /* display: grid; */
                      display: flex;
                      grid-template-columns: repeat(12, 1fr);
                    }
              
                    .ticket-container::before {
                      position: absolute;
                      left: 1px;
                      top: 0;
                      height: 100%;
                      width: 100%;
                      content: "";
                      border-left: 7px dashed #60126c;
                    }
              
                    .event-body {
                      flex-grow: 1;
                      padding: 30px 80px;
                      /* grid-column: 1 / 9; */
                    }
              
                    .specifics {
                      margin-top: 70px;
                      color: #f2b311;
                    }
              
                    .specifics div {
                      display: flex;
                      justify-content: space-between;
                      max-width: 800px;
                      color: inherit;
                    }
              
                    .specifics p {
                      color: inherit;
                      display: flex;
                      align-items: center;
                      gap: 8px;
                    }
              
                    .ticket-bg {
                      width: 100%;
                      height: 100%;
                      top: 0;
                      left: 0;
                      object-fit: cover;
                      position: absolute;
                      z-index: -1;
                    }
              
                    .logos-partners {
                      display: flex;
                      align-items: center;
                      gap: 20px;
                    }
              
                    .logos-partners img:first-child {
                      height: 24px;
                    }
                    .logos-partners img:last-child {
                      height: 56px;
                    }
              
                    .title {
                      font-size: 64px;
                      margin-top: 54px;
                      white-space: nowrap;
                      color: #f2b311;
                    }
              
                    .tag {
                      border: 2px solid #60126c;
                      border-radius: 1000px;
                      color: #f2b311;
                      font-weight: 700;
                      text-transform: uppercase;
                      padding: 10px 25px;
                      font-size: 14px;
                      background-color: #1d0221;
                      margin-top: 20px;
                      max-width: max-content;
                    }
              
                    .attendee {
                      padding: 40px 60px;
                      width: 400px;
                      flex-shrink: 0;
                      border-left: 2px dashed rgba(255, 255, 255, 0.17);
                    }
              
                    .attendee img {
                      border: 6px solid #f2b311;
                      border-radius: 10000px;
                      object-fit: cover;
                      width: 160px;
                      height: 160px;
                    }
              
                    .attendee h2 {
                      font-size: 32px;
                      margin-top: 24px;
                    }
              
                    .attendee p {
                      font-style: oblique;
                      color: #398f96;
                      font-size: 18px;
                      margin-top: 2px;
                    }
              
                    .attendee a {
                      color: #f2b311;
                      display: block;
                      max-width: max-content;
                      margin-top: 60px;
                    }
              
                    .ticket-number {
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      background-color: black;
                      width: 100px;
                    }
              
                    .ticket-number .code {
                      font-weight: 700;
                      font-size: 50px;
                      white-space: nowrap;
                      transform: rotate(90deg);
                    }
                  </style>
                </head>
                <body>
                  <section class="ticket-container">
                    <img
                      src="https://res.cloudinary.com/devtenotea/image/upload/v1704844290/w1iauqry6je7y0mdpt2j.png"
                      class="ticket-bg"
                    />
              
                    <div class="event-body">
                      <div class="logos-partners">
                        <img
                          src="https://res.cloudinary.com/devtenotea/image/upload/v1704803542/i9wf4gyqocpdisekdv62.png"
                        />
              
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 6 6"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M4.82026 4.55495C4.83768 4.57237 4.8515 4.59305 4.86093 4.61581C4.87036 4.63857 4.87521 4.66297 4.87521 4.6876C4.87521 4.71224 4.87036 4.73664 4.86093 4.7594C4.8515 4.78216 4.83768 4.80284 4.82026 4.82026C4.80284 4.83768 4.78216 4.8515 4.7594 4.86093C4.73664 4.87036 4.71224 4.87521 4.6876 4.87521C4.66297 4.87521 4.63857 4.87036 4.61581 4.86093C4.59305 4.8515 4.57237 4.83768 4.55495 4.82026L3.0001 3.26518L1.44526 4.82026C1.41008 4.85544 1.36236 4.87521 1.3126 4.87521C1.26285 4.87521 1.21513 4.85544 1.17995 4.82026C1.14477 4.78508 1.125 4.73736 1.125 4.6876C1.125 4.63785 1.14477 4.59013 1.17995 4.55495L2.73503 3.0001L1.17995 1.44526C1.14477 1.41008 1.125 1.36236 1.125 1.3126C1.125 1.26285 1.14477 1.21513 1.17995 1.17995C1.21513 1.14477 1.26285 1.125 1.3126 1.125C1.36236 1.125 1.41008 1.14477 1.44526 1.17995L3.0001 2.73503L4.55495 1.17995C4.59013 1.14477 4.63785 1.125 4.6876 1.125C4.73736 1.125 4.78508 1.14477 4.82026 1.17995C4.85544 1.21513 4.87521 1.26285 4.87521 1.3126C4.87521 1.36236 4.85544 1.41008 4.82026 1.44526L3.26518 3.0001L4.82026 4.55495Z"
                            fill="#787878"
                          />
                        </svg>
              
                        <img
                          src="https://res.cloudinary.com/devtenotea/image/upload/v1704839313/ahamzdchjddvimjormus.png"
                          alt=""
                        />
                      </div>
              
                      <h1 class="title">The Express Hangout</h1>
                      <p class="tag">A Launch party</p>
              
                      <div class="specifics">
                        <div>
                          <p>
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 7 7"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <g clip-path="url(#clip0_2605_224)">
                                <path
                                  d="M0.582031 5.54134C0.582031 6.03718 0.961198 6.41634 1.45703 6.41634H5.54037C6.0362 6.41634 6.41537 6.03718 6.41537 5.54134V3.20801H0.582031V5.54134ZM5.54037 1.16634H4.95703V0.874675C4.95703 0.699674 4.84037 0.583008 4.66537 0.583008C4.49037 0.583008 4.3737 0.699674 4.3737 0.874675V1.16634H2.6237V0.874675C2.6237 0.699674 2.50703 0.583008 2.33203 0.583008C2.15703 0.583008 2.04036 0.699674 2.04036 0.874675V1.16634H1.45703C0.961198 1.16634 0.582031 1.54551 0.582031 2.04134V2.62467H6.41537V2.04134C6.41537 1.54551 6.0362 1.16634 5.54037 1.16634Z"
                                  fill="#F2B311"
                                />
                              </g>
                              <defs>
                                <clipPath id="clip0_2605_224">
                                  <rect width="7" height="7" fill="white" />
                                </clipPath>
                              </defs>
                            </svg>
              
                            12 Noon Saturday, 27th January 2024
                          </p>
              
                          <p>
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 8 8"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M4.00056 0.642578C4.73938 0.642578 5.44793 0.936072 5.97036 1.4585C6.49278 1.98092 6.78627 2.68948 6.78627 3.42829C6.78627 4.60544 5.95913 5.88829 4.32627 7.29058C4.23548 7.36857 4.11972 7.41141 4.00002 7.41131C3.88033 7.4112 3.76464 7.36816 3.67399 7.29001L3.56599 7.19629C2.00542 5.83058 1.21484 4.57915 1.21484 3.42829C1.21484 2.68948 1.50834 1.98092 2.03076 1.4585C2.55318 0.936072 3.26174 0.642578 4.00056 0.642578ZM4.00056 2.35686C3.7164 2.35686 3.44388 2.46975 3.24294 2.67068C3.04201 2.87161 2.92913 3.14413 2.92913 3.42829C2.92913 3.71245 3.04201 3.98498 3.24294 4.18591C3.44388 4.38684 3.7164 4.49972 4.00056 4.49972C4.28472 4.49972 4.55724 4.38684 4.75817 4.18591C4.9591 3.98498 5.07199 3.71245 5.07199 3.42829C5.07199 3.14413 4.9591 2.87161 4.75817 2.67068C4.55724 2.46975 4.28472 2.35686 4.00056 2.35686Z"
                                fill="#F2B311"
                              />
                            </svg>
                            Opolo Innovation Hub, OAU Campus, Ile-Ife
                          </p>
                        </div>
                      </div>
                    </div>
                    <div class="attendee">
                      <img
                        src="${
                          event.data.d.author.avatar
                            ? `https://cdn.discordapp.com/avatars/${event.data.d.author.id}/${event.data.d.author.avatar}.png`
                            : "https://unsplash.com/photos/0zQTksqA_Ws/download?ixid=M3wxMjA3fDB8MXxhbGx8M3x8fHx8fDJ8fDE3MDQ4NDg0NTR8&force=true&w=640"
                        }"
                        alt=""
                      />
                      <h2>
                        ${existingTicket.name}
              
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 8 8"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M3.15804 0.0576199C2.89184 -0.0284813 2.60367 -0.0169346 2.3452 0.0901896C2.08674 0.197314 1.87489 0.393008 1.74764 0.642182L1.43143 1.26048C1.39385 1.3341 1.33399 1.39396 1.26038 1.43154L0.641681 1.74775C0.392507 1.875 0.196813 2.08685 0.0896883 2.34531C-0.0174359 2.60377 -0.0289827 2.89195 0.0571186 3.15815L0.271327 3.81922C0.296757 3.89777 0.296757 3.98234 0.271327 4.06089L0.057511 4.72196C-0.0285903 4.98816 -0.0170436 5.27633 0.0900806 5.5348C0.197205 5.79326 0.3929 6.00511 0.642073 6.13236L1.26038 6.44857C1.33399 6.48615 1.39385 6.54601 1.43143 6.61962L1.74764 7.23832C1.87489 7.48749 2.08674 7.68319 2.3452 7.79031C2.60367 7.89744 2.89184 7.90898 3.15804 7.82288L3.81911 7.60867C3.89766 7.58324 3.98223 7.58324 4.06078 7.60867L4.72185 7.82249C4.98801 7.90862 5.27615 7.89713 5.5346 7.79008C5.79306 7.68303 6.00494 7.48742 6.13225 7.23832L6.44846 6.61962C6.48604 6.54601 6.5459 6.48615 6.61952 6.44857L7.23821 6.13275C7.48747 6.00549 7.68323 5.79358 7.79036 5.53503C7.89749 5.27648 7.90898 4.98821 7.82277 4.72196L7.60856 4.06089C7.58313 3.98234 7.58313 3.89777 7.60856 3.81922L7.82238 3.15815C7.90851 2.89199 7.89702 2.60386 7.78997 2.3454C7.68292 2.08694 7.48731 1.87506 7.23821 1.74775L6.61952 1.43154C6.5459 1.39396 6.48604 1.3341 6.44846 1.26048L6.13264 0.64179C6.00538 0.39253 5.79347 0.196774 5.53492 0.089644C5.27637 -0.0174861 4.98811 -0.028979 4.72185 0.0572275L4.06078 0.271436C3.98223 0.296866 3.89766 0.296866 3.81911 0.271436L3.15804 0.0576199ZM1.88417 3.84472L2.43892 3.28997L3.54841 4.39986L5.76778 2.18048L6.32292 2.73523L3.54841 5.50896L1.88417 3.84472Z"
                            fill="#F2B311"
                          />
                        </svg>
                      </h2>
                      <p>@${existingTicket.username}</p>
              
                      <a href="https://smtpexpress.com">https://smtpexpress.com</a>
                    </div>
                    <div class="ticket-number">
                      <p class="code">#2701-${existingTicket.ticketNumber}</p>
                    </div>
                  </section>
                </body>
              </html>
              `,
                css: "",
                google_fonts: "Inter",
                viewport_width: 1600,
                viewport_height: 400,
              }),
              headers: {
                "Content-Type": "application/json",
                Authorization:
                  "Basic " +
                  Buffer.from(HTML_CONVERTER_API_KEY).toString("base64"),
              },
            })
          ).json()) as { url: string };
          console.log("Ticket generated, updating user...");
        }

        const ticketInstance = await Ticket.findOneAndUpdate(
          { discordUserId: event.data.d.author.id },
          {
            emailAddress: userEmail,
            ticketLink: (ticket as any).url,
          },
          {
            returnOriginal: false,
          }
        ).exec();

        console.log("User updated", ticketInstance);

        // store email, ticketLink, ticketNumber
        const startDate = new Date();
        startDate.setFullYear(2024, 0, 27);
        startDate.setHours(12, 0, 0, 0);
        const endDate = new Date();
        endDate.setFullYear(2024, 0, 27);
        endDate.setHours(14, 0, 0, 0);

        await smtpexpressClient.sendApi.sendMail({
          sender: {
            email: "tenotea@smtpexpress.com",
            name: "Tenotea from SMTP Express",
          },
          recipients: {
            name: ticketInstance!.name! || ticketInstance?.username!,
            email: ticketInstance!.emailAddress!,
          },
          calendarEvent: {
            startDate,
            endDate,
            title: "SMTP Express Launch Party!",
            location: "Opolo Innovation Hub, OAU Campus, Ile-ife",
            url: "https://maps.app.goo.gl/fYRvgJZ6FV1XAPJc8",
            organizer: "thesmtpexpress@gmail.com",
          },
          subject: "Join us for our Launch Party!",
          template: {
            id: "uJInmhVtnG9rthHcuDdvq",
            variables: {
              username: ticketInstance?.name! || ticketInstance?.username!,
            },
          },
          attachments: [
            (ticket as any)?.url + ".png",
            "https://res.cloudinary.com/devtenotea/image/upload/v1704800450/smtp-express-launch-party.png",
          ],
        });
        await rest.post(Routes.channelMessages(event.data.d.channel_id), {
          body: {
            content: `Kindly check your mail, your ticket has been sent!
            `,
          },
        });
      } catch (error: any) {
        await rest.post(Routes.channelMessages(event.data.d.channel_id), {
          body: {
            content: `Looks like that mail did not get sent. Please try again.
              
To claim your ticket, respond to this message with your email address and your ticket will be sent to your mailbox.
              `,
          },
        });
      }
    } catch (error: any) {
      await rest.post(Routes.channelMessages(event.data.d.channel_id), {
        body: {
          content: `That doesn\'t seem look like a valid email address.
          
To claim your ticket, respond to this message with your email address and your ticket will be sent to your mailbox.
          `,
        },
      });
    }
  }
});

await manager.connect();
