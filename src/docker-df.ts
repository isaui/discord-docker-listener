import { exec } from "child_process";

export async function getDockerSystemDf(): Promise<string> {
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

  export async function parseDockerSystemDf(): Promise<{
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