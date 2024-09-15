export interface DockerEvent {
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
  