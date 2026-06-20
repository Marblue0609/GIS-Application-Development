import api from './api';

const unwrapData = (payload) => payload?.data ?? payload;

export const ChatRestaurants = async (messages) => {
  const response = await api.post('/chat/restaurants', { messages });
  return unwrapData(response.data);
};
