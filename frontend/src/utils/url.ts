export const getFullUrl = (url: string | undefined | null) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  
  // Use VITE_API_URL if defined, otherwise assume relative path (handled by proxy)
  const baseUrl = import.meta.env.VITE_API_URL || '';
  
  // Ensure no double slashes if baseUrl ends with / and url starts with /
  if (baseUrl.endsWith('/') && url.startsWith('/')) {
    return `${baseUrl}${url.slice(1)}`;
  }
  
  return `${baseUrl}${url}`;
};
