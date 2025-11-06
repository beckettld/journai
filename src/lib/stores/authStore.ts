import { writable } from 'svelte/store';
import type { User } from 'firebase/auth';
import { auth } from '$lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { createOrUpdateUser } from '$lib/services/firestore';

export const authUser = writable<User | null>(null);
export const authLoading = writable(true);

// Initialize auth listener
onAuthStateChanged(auth, async (user) => {
  authUser.set(user);
  authLoading.set(false);

  // Create or update user document in Firestore when authenticated
  if (user) {
    try {
      await createOrUpdateUser(user.uid, {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
    } catch (error) {
      console.error('Failed to create/update user document:', error);
      // Don't block the auth flow if this fails
    }
  }
});

