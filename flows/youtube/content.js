// Content script to extract video/playlist information from YouTube pages
// Flow: YouTube Video/Playlist Import

function extractYouTubeData() {
  try {
    const url = window.location.href;
    const isPlaylist = url.includes('list=');
    const isVideo = url.includes('watch?v=') || url.includes('/shorts/');

    // Extract video ID
    const videoIdMatch = url.match(/[?&]v=([^&]+)/) || url.match(/shorts\/([^?]+)/);
    const videoId = videoIdMatch?.[1] || '';

    // Extract playlist ID
    const playlistIdMatch = url.match(/[?&]list=([^&]+)/);
    const playlistId = playlistIdMatch?.[1] || '';

    // Determine content type
    const contentType = isPlaylist ? 'playlist' : 'video';

    let title = '';
    let channel = '';
    let channelUrl = '';
    let description = '';
    let thumbnailUrl = '';

    if (isPlaylist) {
      // Extract playlist title - try multiple selectors for different YouTube layouts
      const playlistTitleElement = document.querySelector('yt-dynamic-sizing-formatted-string yt-formatted-string#text') ||
                                   document.querySelector('yt-formatted-string.ytd-playlist-header-renderer') ||
                                   document.querySelector('#title h1') ||
                                   document.querySelector('h1.style-scope.ytd-playlist-header-renderer') ||
                                   document.querySelector('yt-formatted-string.ytd-playlist-header-renderer#title') ||
                                   document.querySelector('h1.ytd-playlist-header-renderer') ||
                                   document.querySelector('.ytd-playlist-header-renderer #title');
      title = playlistTitleElement?.textContent?.trim() || 'YouTube Playlist';

      // Extract playlist owner/channel - try multiple selectors
      const channelElement = document.querySelector('ytd-channel-name yt-formatted-string a') ||
                            document.querySelector('ytd-channel-name a') ||
                            document.querySelector('#owner a') ||
                            document.querySelector('.ytd-channel-name a') ||
                            document.querySelector('#owner-text a');
      channel = channelElement?.textContent?.trim() || '';
      channelUrl = channelElement?.href || '';

      // Extract playlist description
      const descElement = document.querySelector('#plain-snippet-text') ||
                         document.querySelector('#description') ||
                         document.querySelector('yt-formatted-string#description-text') ||
                         document.querySelector('.ytd-playlist-header-renderer #description');
      description = descElement?.textContent?.trim() || '';

      // Playlist thumbnail - get from hero/header thumbnail (main playlist image)
      const heroThumb = document.querySelector('ytd-hero-playlist-thumbnail-renderer img') ||
                       document.querySelector('ytd-playlist-thumbnail img') ||
                       document.querySelector('.ytd-playlist-header-renderer img');
      
      thumbnailUrl = heroThumb?.src || '';
      
      // If hero thumbnail found, extract video ID and construct high-res version
      if (thumbnailUrl) {
        const videoIdMatch = thumbnailUrl.match(/\/vi\/([^\/]+)\//);
        if (videoIdMatch && videoIdMatch[1]) {
          // Use hqdefault instead of maxresdefault (more reliable for older videos)
          thumbnailUrl = `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
        }
      }
      
      // Fallback: get from first video in playlist if hero thumbnail not found
      if (!thumbnailUrl) {
        const firstVideoThumb = document.querySelector('ytd-playlist-video-renderer img#img') ||
                               document.querySelector('ytd-playlist-panel-video-renderer img');
        
        thumbnailUrl = firstVideoThumb?.src || '';
        
        if (thumbnailUrl) {
          const videoIdMatch = thumbnailUrl.match(/\/vi\/([^\/]+)\//);
          if (videoIdMatch && videoIdMatch[1]) {
            thumbnailUrl = `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
          }
        }
      }
      
      // Last resort: extract from first video link
      if (!thumbnailUrl) {
        const firstVideoLink = document.querySelector('ytd-playlist-video-renderer a#video-title') ||
                              document.querySelector('ytd-playlist-video-renderer a');
        if (firstVideoLink) {
          const videoUrl = firstVideoLink.href;
          const firstVideoId = videoUrl.match(/[?&]v=([^&]+)/)?.[1];
          if (firstVideoId) {
            thumbnailUrl = `https://i.ytimg.com/vi/${firstVideoId}/hqdefault.jpg`;
          }
        }
      }
    } else if (isVideo) {
      // Extract video title
      const videoTitleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                               document.querySelector('h1.title yt-formatted-string') ||
                               document.querySelector('#title h1');
      title = videoTitleElement?.textContent?.trim() || 'YouTube Video';

      // Extract channel name and URL
      const channelElement = document.querySelector('ytd-channel-name a') ||
                            document.querySelector('#channel-name a') ||
                            document.querySelector('ytd-video-owner-renderer a');
      channel = channelElement?.textContent?.trim() || '';
      channelUrl = channelElement?.href || '';

      // Extract video description
      const descElement = document.querySelector('ytd-text-inline-expander span.yt-core-attributed-string') ||
                         document.querySelector('#description yt-formatted-string') ||
                         document.querySelector('.ytd-video-secondary-info-renderer #description');
      description = descElement?.textContent?.trim() || '';

      // Video thumbnail
      if (videoId) {
        // Use maxresdefault for highest quality, fallback to hqdefault
        thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      } else {
        const thumbElement = document.querySelector('video') ||
                            document.querySelector('ytd-player img');
        thumbnailUrl = thumbElement?.src || thumbElement?.getAttribute('src') || '';
      }
    }

    return {
      title,
      channel,
      channelUrl,
      description,
      thumbnailUrl,
      pageUrl: url,
      videoId,
      playlistId,
      contentType,
      isPlaylist,
      flowType: 'youtube',
      success: true
    };
  } catch (error) {
    console.error('Error extracting YouTube data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractYouTubeData' || request.action === 'extractData') {
    const youtubeData = extractYouTubeData();
    sendResponse(youtubeData);
  }
  return true;
});

// Store YouTube data when page loads
window.addEventListener('load', () => {
  const youtubeData = extractYouTubeData();
  if (youtubeData.success) {
    chrome.storage.local.set({ currentYouTubeData: youtubeData });
  }
});
