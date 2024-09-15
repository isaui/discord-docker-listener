import DiscordLogger from "isaui-discord-logger";
import { DockerEvent } from "./interface";

export async function sendContainerDiscordLog(event: DockerEvent, logger: DiscordLogger): Promise<void> {
    const title = `Docker Event: ${event.Type} ${event.Action}`;
    const description = `Event details for ${event.Actor.ID}`;
    const fields = [
      { name: 'Type', value: event.Type, inline: true },
      { name: 'Action', value: event.Action, inline: true },
      { name: 'Actor ID', value: event.Actor.ID, inline: false },
      { name: 'Container Image', value: event.Actor.Attributes.image, inline: false },
      { name: 'Container Name', value: event.Actor.Attributes.name, inline: false },
      { name: 'Scope', value: event.scope, inline: true },
      { name: 'Time', value: new Date(event.time * 1000).toISOString(), inline: true },
    ];
  
    if (event.Type === 'image' && event.Action === 'build') {
      fields.push({ name: 'Image Name', value: event.Actor.Attributes.name || 'N/A', inline: false });
    }
  
    if (event.Type === 'image' && event.Action === 'build') {
      await logger.success(title, description, fields);
    } else if (event.Type === 'container' && ['start', 'stop', 'die'].includes(event.Action)) {
      await logger.info(title, description, fields);
    } else if (event.Type === 'network' || event.Type === 'volume') {
      await logger.info(title, description, fields);
    } else {
      await logger.log({ title, description, fields, color: 10181046 });
    }
  }