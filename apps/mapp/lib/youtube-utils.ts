/**
 * Extracts YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */
export const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // Handle youtu.be short links
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0];
    }

    // Handle youtube.com links
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      // Watch links: /watch?v=VIDEO_ID
      if (urlObj.pathname === '/watch') {
        return urlObj.searchParams.get('v');
      }

      // Embed links: /embed/VIDEO_ID
      if (urlObj.pathname.startsWith('/embed/')) {
        return urlObj.pathname.split('/')[2].split('?')[0];
      }

      // Shorts: /shorts/VIDEO_ID
      if (urlObj.pathname.startsWith('/shorts/')) {
        return urlObj.pathname.split('/shorts/')[1].split('?')[0];
      }
    }

    // Fallback: Try regex pattern
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
      return match[2];
    }

    return null;
  } catch (e) {
    // If URL parsing fails, try regex as fallback
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
      return match[2];
    }

    return null;
  }
};

/**
 * Checks if a URL is a YouTube video URL
 */
export const isYouTubeUrl = (url: string): boolean => {
  return getYouTubeVideoId(url) !== null;
};

/** Static thumbnail URL (no WebView) for preview rows. */
export const getYouTubeThumbnailUrl = (
  videoId: string,
  quality: 'hqdefault' | 'mqdefault' = 'hqdefault'
): string => {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
};

/**
 * Extracts text content from markdown nodes (recursive)
 */
export const extractText = (node: any): string => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.content) return extractText(node.content);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(extractText).join('');
  }
  return '';
};

/**
 * Finds a child node matching a test function (recursive)
 */
export const findChild = (node: any, test: (node: any) => boolean): any => {
  if (!node) return null;

  if (test(node)) return node;

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child !== 'object' || child === null) continue;
      const found = findChild(child, test);
      if (found) return found;
    }
  }

  return null;
};

/**
 * Checks if a node contains a YouTube link
 */
export const hasYouTubeLink = (node: any): boolean => {
  if (!node) return false;

  // Check if node itself has a YouTube URL
  if (node.type === 'link' && node.attributes?.href) {
    if (isYouTubeUrl(node.attributes.href)) return true;
  }

  // Check in content/text
  const text = extractText(node);
  if (text && isYouTubeUrl(text)) return true;

  return false;
};
