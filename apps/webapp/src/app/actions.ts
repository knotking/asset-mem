
'use server';

import { db, storage } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, doc, getDoc, deleteDoc, query, where, writeBatch, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { deleteCollection, apiUrls } from '@/lib/utils';
import type { Property, Message } from '@/lib/types';
import {
  createAgentSession,
  deleteAgentSession,
  postFileToAgent as postFileToAgentImpl,
} from '@/lib/api-agent';

export async function createAgentSessionAction(userId: string): Promise<{ agentSessionId?: string; error?: string }> {
  return createAgentSession(userId);
}

export async function deleteAgentSessionAction(userId: string, agentSessionId: string): Promise<{ success?: boolean; error?: string }> {
  return deleteAgentSession(userId, agentSessionId);
}

export async function postFileToAgent(gsURI: string, userId: string) {
  return postFileToAgentImpl(gsURI, userId);
}
