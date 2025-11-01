
'use server';

import { db, storage } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, doc, getDoc, deleteDoc, query, where, writeBatch, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { deleteCollection } from '@/lib/utils';
import type { Property, Message } from '@/lib/types';


export async function createAgentSessionAction(userId: string): Promise<{ agentSessionId?: string; error?: string }> {
    try {
        const url = process.env.NEXT_PUBLIC_AGENT_SESSION_URL;
        if (!url) {
            throw new Error("NEXT_PUBLIC_AGENT__SESSION_URL environment variable not set.");
        }
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to create session, status: ${response.status}, body: ${errorBody}`);
        }
        
        const data = await response.json();
        const agentSessionId = data.id;

        if (!agentSessionId) {
            throw new Error("session_id not found in response");
        }

        return { agentSessionId };
    } catch (error) {
        console.error('Error creating agent session:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { error: `Failed to create agent session: ${errorMessage}` };
    }
}

export async function deleteAgentSessionAction(userId: string, agentSessionId: string): Promise<{ success?: boolean; error?: string }> {
    try {
        const url = process.env.NEXT_PUBLIC_AGENT_SESSION_URL;
        if (!url) {
            throw new Error("NEXT_PUBLIC_AGENT_SESSION_URL environment variable not set.");
        }
        
        

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({user_id: userId, session_id: agentSessionId})
        });

        if (!response.ok) {
            if (response.status === 404) {
                // If the session is already not found, we can consider it a success for the client.
                console.warn(`Agent session ${agentSessionId} not found on backend, but proceeding with UI deletion.`);
                return { success: true };
            }
            const errorBody = await response.text();
            throw new Error(`Failed to delete session, status: ${response.status}, body: ${errorBody}`);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting agent session:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { error: `Failed to delete agent session: ${errorMessage}` };
    }
}

export async function postFileToAgent(gsURI: string, userId: string): Promise<{ success: boolean; summary?: string; error?: string }> {
    try {
        const url = process.env.NEXT_RAG_FILE_UPLOAD_URL;
        if (!url) {
            throw new Error("NEXT_AGENT_URL environment variable not set.");
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                context_doc_uris: [gsURI]
            })
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to post file, status: ${response.status}, body: ${errorBody}`);
        }
        const result = await response.json();
        return { success: true, summary: result.message };

    } catch (error) {
        console.error('Error posting file to cloud function:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, error: `Failed to process file: ${errorMessage}` };
    }
}
