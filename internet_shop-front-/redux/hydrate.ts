import { createAction } from '@reduxjs/toolkit';
import { HYDRATE } from 'next-redux-wrapper';
import type { AppState } from './redux-store';

// Типізований action next-redux-wrapper: payload — стан серверного store
export const hydrate = createAction<AppState>(HYDRATE);
