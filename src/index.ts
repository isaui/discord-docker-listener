import express from 'express';
import Docker from 'dockerode';
import DiscordLogger from 'isaui-discord-logger';
import os from 'os';
import dotenv from 'dotenv';
import fs from 'fs';
import { exec } from 'child_process';

dotenv.config();

const PORT = parseInt(process.env.PORT || '54321', 10);
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const NAME = process.env.NAME || 'Docker Event Monitor';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const fullNotif = process.env.FULL_NOTIFICATION == 'true';

if (!DISCORD_WEBHOOK_URL) {
  console.error('DISCORD_WEBHOOK_URL is not set. Exiting...');
  process.exit(1);
}

const app = express();
let docker: Docker

function initializeDocker(): Docker {
    const platform = os.platform();
    console.log(`Detected platform: ${platform}`);
  
    if (platform === 'win32') {
      // Try named pipe first
      const namedPipePath = '//./pipe/docker_engine';
      if (fs.existsSync(namedPipePath)) {
        console.log('Connecting to Docker via named pipe');
        return new Docker({ socketPath: namedPipePath });
      }
  
      // If named pipe doesn't work, try TCP
      console.log('Named pipe not found. Attempting to connect to Docker via TCP...');
      return new Docker({ host: 'localhost', port: 2375 });
    } else {
      // For non-Windows platforms, use the default socket
      console.log('Connecting to Docker via default socket');
      return new Docker({ socketPath: '/var/run/docker.sock' });
    }
  }
  
  try {
    docker = initializeDocker();
    console.log('Docker connection initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Docker connection:', error);
    process.exit(1);
  }

const logger = new DiscordLogger(DISCORD_WEBHOOK_URL, NAME, IS_PRODUCTION);

app.use(express.json());

interface DockerEvent {
  Type: string;
  Action: string;
  Actor: {
    ID: string;
    Attributes: {
      [key: string]: string;
    };
  };
  scope: string;
  time: number;
  timeNano: number;
}

async function getDockerSystemDf(): Promise<string> {
    return new Promise((resolve, reject) => {
      exec('docker system df', (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing command: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`Error in output: ${stderr}`);
          return reject(stderr);
        }
        resolve(stdout);
      });
    });
  }

  async function parseDockerSystemDf(): Promise<{
    images: string;
    containers: string;
    volumes: string;
    cache: string;
  }> {
    try {
      const dfOutput = await getDockerSystemDf();
      
      // Regex for capturing relevant data from output
      const imageMatch = dfOutput.match(/Images\s+\d+\s+\d+\s+([\d.]+[A-Z]+)\s+([\d.]+[A-Z]+)/);
      const containerMatch = dfOutput.match(/Containers\s+\d+\s+\d+\s+([\d.]+[A-Z]+)\s+([\d.]+[A-Z]+)/);
      const volumeMatch = dfOutput.match(/Local Volumes\s+\d+\s+\d+\s+([\d.]+[A-Z]+)\s+([\d.]+[A-Z]+)/);
      const cacheMatch = dfOutput.match(/Build Cache\s+\d+\s+\d+\s+([\d.]+[A-Z]+)\s+([\d.]+[A-Z]+)/);
  
      const images = imageMatch ? `Size: ${imageMatch[1]}, Reclaimable: ${imageMatch[2]}` : 'N/A';
      const containers = containerMatch ? `Size: ${containerMatch[1]}, Reclaimable: ${containerMatch[2]}` : 'N/A';
      const volumes = volumeMatch ? `Size: ${volumeMatch[1]}, Reclaimable: ${volumeMatch[2]}` : 'N/A';
      const cache = cacheMatch ? `Size: ${cacheMatch[1]}, Reclaimable: ${cacheMatch[2]}` : 'N/A';
  
      return { images, containers, volumes, cache };
    } catch (error) {
      console.error('Error parsing Docker system df output:', error);
      throw error;
    }
  }
  

async function sendDiscordLog(event: DockerEvent): Promise<void> {
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

async function getDockerInfo(): Promise<{ storage: string, reclaimableStorage: string, runningContainers: number, unusedContainers: number }> {
    try {
      console.log('Fetching Docker info...');
      const info = await docker.info();
      console.log('Docker info fetched successfully');
      
      console.log('Listing containers...');
      const containers = await docker.listContainers({ all: true });
      console.log('Containers listed successfully');
  
      // Hitung penggunaan storage
      const totalMemory = info.MemTotal;
      const usedMemory = totalMemory - os.freemem();
      const storageUsage = `${(usedMemory / (1024 * 1024)).toFixed(2)}MB / ${(totalMemory / (1024 * 1024)).toFixed(2)}MB`;
      
      // Fetch reclaimable space using `docker system df` equivalent
      const df = await docker.df();
      const reclaimableStorage = df.LayersReclaimableSize;
  
      return {
        storage: storageUsage,
        reclaimableStorage: formatBytes(reclaimableStorage),
        runningContainers: info.ContainersRunning,
        unusedContainers: info.ContainersStopped
      };
    } catch (error) {
      console.error('Error fetching Docker info:', error);
      throw error;
    }
  }
  
  
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function sendHourlyReport(): Promise<void> {
    try {
      const { storage, runningContainers, unusedContainers } = await getDockerInfo();
      const { images, containers, volumes, cache } = await parseDockerSystemDf();
  
      const title = 'Docker Hourly Report';
      const description = 'Current Docker system status';
      const fields = [
        { name: 'Storage Usage', value: storage, inline: false },
        { name: 'Running Containers', value: runningContainers.toString(), inline: true },
        { name: 'Unused Containers', value: unusedContainers.toString(), inline: true },
        { name: 'Images', value: images, inline: false },       // Images Reclaimable info
        { name: 'Containers', value: containers, inline: false }, // Containers Reclaimable info
        { name: 'Volumes', value: volumes, inline: false },     // Volumes Reclaimable info
        { name: 'Build Cache', value: cache, inline: false }    // Build Cache Reclaimable info
      ];
  
      await logger.info(title, description, fields);
      console.log('Hourly report sent successfully');
    } catch (error) {
      console.error('Error sending hourly report:', error);
      logger.error('Hourly Report Error', (error as Error).message);
    }
  }

// Listen to Docker events
docker.getEvents((err, stream) => {
  if (err) {
    console.error('Error connecting to Docker events:', err);
    logger.error('Docker Connection Error', err.message);
    return;
  }

  if (!stream) {
    console.error('Docker event stream is undefined');
    logger.error('Docker Event Stream Error', 'Event stream is undefined');
    return;
  }

  stream.on('data', (chunk: Buffer) => {
    const event = JSON.parse(chunk.toString()) as DockerEvent;
    console.log('Received Docker event:', event);
    if(fullNotif){
        sendDiscordLog(event);
    }
   // 
  });

  stream.on('error', (err: Error) => {
    console.error('Error in Docker event stream:', err);
    if(fullNotif){
        logger.error('Docker Event Stream Error', err.message);
    }
   // 
  });

  stream.on('end', () => {
    console.log('Docker event stream ended');
    if(fullNotif){
        logger.info('Docker Event Stream', 'Event stream has ended');
    }
  });
});


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', name: NAME, platform: os.platform() });
});

async function testDockerConnection() {
    try {
      const info = await docker.info();
      console.log('Successfully connected to Docker. Docker version:', info.ServerVersion);
    } catch (error) {
      console.error('Failed to connect to Docker:', error);
      throw error;
    }
  }
  
  testDockerConnection()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`${NAME} is running on port ${PORT} on ${os.platform()}`);
        logger.info('Server Started', `${NAME} is running on port ${PORT} on ${os.platform()}`);
      });
  
      // Start the hourly report after successful connection
      sendHourlyReport().then(() => {
        setInterval(sendHourlyReport, 60 * 60 * 1000); // 1 hour in milliseconds
      }).catch(error => {
        console.error('Failed to send initial report:', error);
      });
    })
    .catch((error) => {
      console.error('Failed to start server due to Docker connection error:', error);
      process.exit(1);
    });