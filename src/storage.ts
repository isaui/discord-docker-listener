import { exec } from 'child_process';
import os from 'os';

  function getSystemStorageInfo(): Promise<string> {
    return new Promise((resolve, reject) => {
      const platform = os.platform();
      let command = '';
  
      if (platform === 'win32') {
        command = 'powershell "Get-Volume | Format-Table -AutoSize"';
      } else {
        // Use df -h and pipe the output to column for tabular format
        command = 'df -h | column -t';
      }
  
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(`Error executing command: ${error.message}`);
          return;
        }
        if (stderr) {
          reject(`Command stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
        resolve(stdout.trim());
      });
    });
  }
  

export { getSystemStorageInfo };