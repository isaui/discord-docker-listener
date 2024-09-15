import express from 'express';
import Docker from 'dockerode';
import DiscordLogger from 'isaui-discord-logger';
import os from 'os';
import dotenv from 'dotenv';
import fs from 'fs';
import { sendHourlyReport } from './send-hourly-report';
import { sendContainerDiscordLog } from './container-log';
import { DockerEvent } from './interface';

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
        sendContainerDiscordLog(event, logger);
    }
  });

  stream.on('error', (err: Error) => {
    console.error('Error in Docker event stream:', err);
    if(fullNotif){
        logger.error('Docker Event Stream Error', err.message);
    }
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
  
      sendHourlyReport(docker, logger).then(() => {
        setInterval(sendHourlyReport, 60 * 60 * 1000); // 1 hour in milliseconds
      }).catch(error => {
        console.error('Failed to send initial report:', error);
      });
    })
    .catch((error) => {
      console.error('Failed to start server due to Docker connection error:', error);
      process.exit(1);
    });