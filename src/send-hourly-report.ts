import Dockerode from "dockerode";
import DiscordLogger from "isaui-discord-logger";
import { getSystemStorageInfo } from "./storage";
import { parseDockerSystemDf } from "./docker-df";

export async function sendHourlyReport(docker: Dockerode, logger: DiscordLogger): Promise<void> {
    try {
      const storageInfoRaw = await getSystemStorageInfo();
      const dockerInfo = await docker.info();
      const runningContainers = dockerInfo.ContainersRunning;
      const unusedContainers = dockerInfo.ContainersStopped;

      const { images, containers, volumes, cache } = await parseDockerSystemDf();
  
      const title = 'Docker Hourly Report';
      const description = 'Current Docker system status';
      const fields = [
        { name: 'Storage Usage', value: storageInfoRaw, inline: false },
        { name: 'Running Containers', value: runningContainers.toString(), inline: true },
        { name: 'Unused Containers', value: unusedContainers.toString(), inline: true },
        { name: 'Images', value: images, inline: false },
        { name: 'Containers', value: containers, inline: false },
        { name: 'Volumes', value: volumes, inline: false },
        { name: 'Build Cache', value: cache, inline: false }
      ];
  
      await logger.info(title, description, fields);
      console.log('Hourly report sent successfully');
    } catch (error) {
      console.error('Error sending hourly report:', error);
    }
  }