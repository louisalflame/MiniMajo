import api from '../../server/player-record-api.cjs';
export const onRequest = context => api.handle(context);
