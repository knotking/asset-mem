import 'react-native-gifted-chat';
import type { AgentStep, PrimaryAgent } from '@homeapp/common/types';

declare module 'react-native-gifted-chat' {
  export interface IMessage {
    customData?: {
      role: 'user' | 'assistant';
      file?: {
        name: string;
        type: string;
        url: string;
        gsURI?: string;
        width?: number;
        height?: number;
      };
      agentSteps?: AgentStep[];
      originalContent?: string;
      primaryAgent?: PrimaryAgent;
    };
  }
}
